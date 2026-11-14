const express = require('express');
const prisma = require('./db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

const parseId = (v) => (/^\d+$/.test(String(v)) ? BigInt(String(v)) : null);

const REJECT_REASONS = ['education', 'experience', 'city', 'other'];

// 文档允许的状态流转：pending -> screened/rejected；screened -> interview/rejected；interview -> hired/rejected
const TRANSITIONS = {
  pending: ['screened', 'rejected'],
  screened: ['interview', 'rejected'],
  interview: ['hired', 'rejected'],
};

const APPLICATION_SELECT = {
  id: true,
  job_id: true,
  resume_id: true,
  seeker_user_id: true,
  status: true,
  reject_stage: true,
  reject_reason: true,
  reject_note: true,
  applied_at: true,
  screened_at: true,
  hr_viewed_at: true,
  updated_at: true,
};

// POST /api/jobs/:id/apply  投递职位（求职者）
router.post('/jobs/:id/apply', requireAuth, requireRole('seeker'), async (req, res) => {
  try {
    const jobId = parseId(req.params.id);
    if (!jobId) return res.status(400).json({ error: '职位 id 不合法' });

    const job = await prisma.jobs.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    });
    if (!job) return res.status(404).json({ error: '职位不存在' });
    if (job.status !== 'published') {
      return res.status(400).json({ error: '该职位未开放投递' });
    }

    const resume = await prisma.resumes.findUnique({
      where: { user_id: req.user.userId },
      select: { id: true },
    });
    if (!resume) return res.status(400).json({ error: '请先完善简历再投递' });

    const existed = await prisma.applications.findFirst({
      where: { job_id: jobId, resume_id: resume.id },
      select: { id: true },
    });
    if (existed) return res.status(409).json({ error: '已投递过该职位，不能重复投递' });

    const application = await prisma.applications.create({
      data: {
        job_id: jobId,
        resume_id: resume.id,
        seeker_user_id: req.user.userId,
        status: 'pending',
      },
      select: APPLICATION_SELECT,
    });

    return res.status(201).json({ application });
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ error: '已投递过该职位，不能重复投递' });
    }
    console.error('[apply]', err);
    return res.status(500).json({ error: '投递失败' });
  }
});

// GET /api/my/applications  我的投递（求职者）
router.get('/my/applications', requireAuth, requireRole('seeker'), async (req, res) => {
  try {
    const applications = await prisma.applications.findMany({
      where: { seeker_user_id: req.user.userId },
      select: {
        ...APPLICATION_SELECT,
        jobs: {
          select: {
            id: true,
            title: true,
            city_name: true,
            salary_min: true,
            salary_max: true,
            status: true,
            companies: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { applied_at: 'desc' },
    });

    return res.json({ applications });
  } catch (err) {
    console.error('[my.applications]', err);
    return res.status(500).json({ error: '获取我的投递失败' });
  }
});

// GET /api/jobs/:id/applications  HR 查看某职位的投递（仅本企业职位）
router.get('/jobs/:id/applications', requireAuth, requireRole('hr'), async (req, res) => {
  try {
    const jobId = parseId(req.params.id);
    if (!jobId) return res.status(400).json({ error: '职位 id 不合法' });

    const job = await prisma.jobs.findUnique({
      where: { id: jobId },
      select: { id: true, company_id: true, title: true },
    });
    if (!job) return res.status(404).json({ error: '职位不存在' });
    if (!req.user.companyId || String(job.company_id) !== String(req.user.companyId)) {
      return res.status(403).json({ error: '无权查看该职位的投递' });
    }

    const applications = await prisma.applications.findMany({
      where: { job_id: jobId },
      select: {
        ...APPLICATION_SELECT,
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
            work_experience: true,
            self_evaluation: true,
          },
        },
      },
      orderBy: { applied_at: 'desc' },
    });

    return res.json({ job, applications });
  } catch (err) {
    console.error('[job.applications]', err);
    return res.status(500).json({ error: '获取投递列表失败' });
  }
});

// PATCH /api/applications/:id/status  HR 修改投递状态
router.patch('/applications/:id/status', requireAuth, requireRole('hr'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: '投递 id 不合法' });

    const { status, reject_reason, reject_note } = req.body || {};
    const application = await prisma.applications.findUnique({
      where: { id },
      select: { id: true, status: true, job_id: true, jobs: { select: { company_id: true } } },
    });
    if (!application) return res.status(404).json({ error: '投递记录不存在' });

    if (!req.user.companyId || String(application.jobs.company_id) !== String(req.user.companyId)) {
      return res.status(403).json({ error: '无权操作该投递' });
    }

    const allowed = TRANSITIONS[application.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: `当前状态 ${application.status} 不能改为 ${status}，允许：${allowed.join(' / ') || '无'}`,
      });
    }

    const data = { status };
    if (status === 'rejected') {
      const reason = REJECT_REASONS.includes(reject_reason) ? reject_reason : 'other';
      data.reject_stage = 'manual';
      data.reject_reason = reason;
      data.reject_note = reject_note ? String(reject_note).slice(0, 255) : null;
    } else {
      // 转为通过类状态时清空拒绝信息
      data.reject_stage = null;
      data.reject_reason = null;
      data.reject_note = null;
    }

    const updated = await prisma.applications.update({
      where: { id },
      data,
      select: APPLICATION_SELECT,
    });

    return res.json({ application: updated });
  } catch (err) {
    console.error('[application.status]', err);
    return res.status(500).json({ error: '修改投递状态失败' });
  }
});

module.exports = { router };
