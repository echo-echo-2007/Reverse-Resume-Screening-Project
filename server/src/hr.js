// HR 端专用接口（P3 工作台 / P4 投递管理）
// 骨架说明：只做「够页面跑起来」的最小实现，
// 筛选、分页、统计口径等细节留 TODO，等页面定型后再补。

const express = require('express');
const prisma = require('./db');
const { requireAuth, requireRole } = require('./auth');
const { visibleFromHr } = require('./screening');

const router = express.Router();

const parseId = (v) => (/^\d+$/.test(String(v)) ? BigInt(String(v)) : null);

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

// 本文件下所有接口都要求 HR 身份
router.use('/hr', requireAuth, requireRole('hr'));

// 工作台的职位卡片：够渲染一行，不带 description/requirements 两个大字段
const JOB_CARD_SELECT = {
  id: true,
  title: true,
  department: true,
  city_code: true,
  city_name: true,
  // 初筛弹窗要展示判定条件，缺了这两个字段会显示成「不限」
  min_education_level: true,
  min_experience_months: true,
  salary_min: true,
  salary_max: true,
  status: true,
  created_at: true,
  _count: { select: { applications: true } },
};

const emptyStats = () => ({
  open_jobs: 0,
  pending: 0,
  screened: 0,
  interview: 0,
  hired: 0,
  rejected: 0,
});

// GET /api/hr/overview  工作台：5 个统计数字 + 本企业全部职位
// 口径：只统计 HR 可见的投递（被系统初筛拒掉的不进入任何数字）
// TODO: 统计与职位列表目前一次拉全量，职位多了要加分页或汇总表
router.get('/hr/overview', async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.json({ stats: emptyStats(), jobs: [] });
    }
    const companyId = BigInt(req.user.companyId);
    const visible = visibleFromHr();

    // 4 次查询：职位 / 按状态分组计数 / 按职位统计待处理数 / 按职位统计可见投递数
    const [jobs, grouped, pendingByJob, visibleByJob] = await Promise.all([
      prisma.jobs.findMany({
        where: { company_id: companyId },
        select: JOB_CARD_SELECT,
        orderBy: { created_at: 'desc' },
      }),
      prisma.applications.groupBy({
        by: ['status'],
        where: { jobs: { company_id: companyId }, ...visible },
        _count: { _all: true },
      }),
      prisma.applications.groupBy({
        by: ['job_id'],
        where: { status: 'pending', jobs: { company_id: companyId } },
        _count: { _all: true },
      }),
      prisma.applications.groupBy({
        by: ['job_id'],
        where: { jobs: { company_id: companyId }, ...visible },
        _count: { _all: true },
      }),
    ]);

    const stats = emptyStats();
    stats.open_jobs = jobs.filter((j) => j.status === 'published').length;
    for (const row of grouped) {
      if (row.status in stats) stats[row.status] = row._count._all;
    }

    const pendingMap = new Map(pendingByJob.map((r) => [String(r.job_id), r._count._all]));
    const visibleMap = new Map(visibleByJob.map((r) => [String(r.job_id), r._count._all]));
    const jobList = jobs.map((j) => ({
      ...j,
      // 卡片上的「投递 N 人」只数 HR 看得到的，避免和列表条数对不上
      _count: { applications: visibleMap.get(String(j.id)) || 0 },
      pending_count: pendingMap.get(String(j.id)) || 0,
    }));

    return res.json({ stats, jobs: jobList });
  } catch (err) {
    console.error('[hr.overview]', err);
    return res.status(500).json({ error: '获取工作台数据失败' });
  }
});

// GET /api/hr/applications?job_id=&status=&page=&page_size=&sort=
// 投递列表 + 全局统计 + 按职位细分（一次请求给全，页面顶部不用再单独拉概览）
router.get('/hr/applications', async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.json({
        applications: [],
        jobs: [],
        job_stats: [],
        stats: emptyStats(),
        total: 0,
        page: 1,
        page_size: PAGE_SIZE_DEFAULT,
      });
    }
    const companyId = BigInt(req.user.companyId);

    const jobId = req.query.job_id ? parseId(req.query.job_id) : null;
    if (req.query.job_id && !jobId) {
      return res.status(400).json({ error: '职位 id 不合法' });
    }

    // 被系统初筛拒掉的投递不进 HR 列表，也不进任何筛选结果
    const where = { jobs: { company_id: companyId }, ...visibleFromHr() };
    if (jobId) where.job_id = jobId;
    if (req.query.status) where.status = String(req.query.status);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, parseInt(req.query.page_size, 10) || PAGE_SIZE_DEFAULT)
    );
    // 只开放两种排序：投递时间新→旧 / 旧→新；同秒投递用 id 兜底保证翻页稳定
    const order = req.query.sort === 'applied_asc' ? 'asc' : 'desc';

    const [applications, total, jobs, byJobStatus] = await Promise.all([
      prisma.applications.findMany({
        where,
        select: {
          id: true,
          job_id: true,
          status: true,
          reject_stage: true,
          reject_reason: true,
          reject_note: true,
          applied_at: true,
          updated_at: true,
          hr_viewed_at: true,
          jobs: { select: { id: true, title: true } },
          // 列表只要概览字段，工作经历/自评这些长文本等抽屉再取
          resumes: {
            select: {
              id: true,
              full_name: true,
              contact_phone: true,
              contact_email: true,
              expected_city_name: true,
              highest_education_level: true,
              school: true,
              graduation_year: true,
              work_months: true,
            },
          },
        },
        orderBy: [{ applied_at: order }, { id: order }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.applications.count({ where }),
      prisma.jobs.findMany({
        where: { company_id: companyId },
        select: { id: true, title: true, status: true },
        orderBy: { created_at: 'desc' },
      }),
      // 按「职位 × 状态」聚合一次，页面的统计卡和职位细分表都从这份数据算
      prisma.applications.groupBy({
        by: ['job_id', 'status'],
        where: { jobs: { company_id: companyId }, ...visibleFromHr() },
        _count: { _all: true },
      }),
    ]);

    const stats = emptyStats();
    stats.open_jobs = jobs.filter((j) => j.status === 'published').length;

    // 先把职位全部铺进去，没有投递的职位也要出现在细分表里（显示 0）
    const jobStats = jobs.map((j) => ({
      job_id: j.id,
      title: j.title,
      status: j.status,
      total: 0,
      pending: 0,
      screened: 0,
      interview: 0,
      hired: 0,
      rejected: 0,
    }));
    const jobStatsMap = new Map(jobStats.map((r) => [String(r.job_id), r]));

    for (const row of byJobStatus) {
      const count = row._count._all;
      const entry = jobStatsMap.get(String(row.job_id));
      if (entry) {
        entry.total += count;
        if (row.status in entry && row.status !== 'total') entry[row.status] = count;
      }
      if (row.status in stats) stats[row.status] += count;
    }

    return res.json({
      applications,
      jobs,
      job_stats: jobStats,
      stats,
      total,
      page,
      page_size: pageSize,
    });
  } catch (err) {
    console.error('[hr.applications]', err);
    return res.status(500).json({ error: '获取投递列表失败' });
  }
});

// GET /api/hr/applications/:id  简历抽屉详情（含工作经历/自评等长文本）
// TODO: 是否顺手写 hr_viewed_at 待定（设计说明待定问题 3），先不写
router.get('/hr/applications/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: '投递 id 不合法' });

    const application = await prisma.applications.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        reject_stage: true,
        reject_reason: true,
        reject_note: true,
        applied_at: true,
        screened_at: true,
        hr_viewed_at: true,
        updated_at: true,
        jobs: {
          select: {
            id: true,
            title: true,
            city_code: true,
            city_name: true,
            salary_min: true,
            salary_max: true,
            min_education_level: true,
            min_experience_months: true,
            company_id: true,
          },
        },
        resumes: {
          select: {
            id: true,
            full_name: true,
            contact_phone: true,
            contact_email: true,
            expected_city_code: true,
            expected_city_name: true,
            highest_education_level: true,
            school: true,
            graduation_year: true,
            work_months: true,
            work_experience: true,
            self_evaluation: true,
            updated_at: true,
          },
        },
      },
    });

    if (!application) return res.status(404).json({ error: '投递记录不存在' });
    // 系统初筛拒掉的记录对 HR 不可见，直接当不存在处理（猜 id 也打不开）
    if (application.status === 'rejected' && application.reject_stage === 'sql') {
      return res.status(404).json({ error: '投递记录不存在' });
    }
    if (!req.user.companyId || String(application.jobs.company_id) !== String(req.user.companyId)) {
      return res.status(403).json({ error: '无权查看该投递' });
    }

    return res.json({ application });
  } catch (err) {
    console.error('[hr.application.detail]', err);
    return res.status(500).json({ error: '获取简历详情失败' });
  }
});

module.exports = { router };