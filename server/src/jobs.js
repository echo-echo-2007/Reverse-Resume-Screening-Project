const express = require('express');
const prisma = require('./db');
const { requireAuth, optionalAuth, requireRole } = require('./auth');

const router = express.Router();

const toInt = (v, def) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
};

const parseId = (v) => (/^\d+$/.test(String(v)) ? BigInt(String(v)) : null);

const JOB_SELECT = {
  id: true,
  company_id: true,
  hr_user_id: true,
  title: true,
  department: true,
  salary_min: true,
  salary_max: true,
  min_education_level: true,
  min_experience_months: true,
  city_code: true,
  city_name: true,
  description: true,
  requirements: true,
  status: true,
  created_at: true,
  companies: { select: { id: true, name: true, industry: true } },
};

// POST /api/jobs  新建职位（HR）
router.post('/jobs', requireAuth, requireRole('hr'), async (req, res) => {
  try {
    const b = req.body || {};

    if (typeof b.title !== 'string' || !b.title.trim()) {
      return res.status(400).json({ error: 'title 不能为空' });
    }

    const salary_min = toInt(b.salary_min, 0);
    const salary_max = toInt(b.salary_max, 0);
    const min_education_level = toInt(b.min_education_level, 0);
    const min_experience_months = toInt(b.min_experience_months, 0);

    if (salary_min < 0 || salary_max < 0 || salary_max < salary_min) {
      return res.status(400).json({ error: '薪资区间不合法（salary_max 需 >= salary_min）' });
    }
    if (min_education_level < 0 || min_education_level > 5) {
      return res.status(400).json({ error: 'min_education_level 需在 0-5 之间' });
    }
    if (min_experience_months < 0) {
      return res.status(400).json({ error: 'min_experience_months 不能为负' });
    }
    if (!req.user.companyId) {
      return res.status(403).json({ error: '当前 HR 未绑定企业，无法发布职位' });
    }

    const job = await prisma.jobs.create({
      data: {
        company_id: req.user.companyId,
        hr_user_id: req.user.userId,
        title: b.title.trim(),
        department: b.department ? String(b.department).trim() : null,
        salary_min,
        salary_max,
        min_education_level,
        min_experience_months,
        city_code: b.city_code ? String(b.city_code).trim() : null,
        city_name: b.city_name ? String(b.city_name).trim() : null,
        description: b.description || null,
        requirements: b.requirements || null,
        // V1 创建即发布，不开放草稿/暂停/关闭，status 由后端强制赋值
        status: 'published',
      },
      select: JOB_SELECT,
    });

    return res.status(201).json({ job });
  } catch (err) {
    console.error('[jobs.create]', err);
    return res.status(500).json({ error: '发布职位失败' });
  }
});

// GET /api/jobs  公开职位列表（HR 带 mine=1 时只看本企业）
router.get('/jobs', optionalAuth, async (req, res) => {
  try {
    const { city_code, city_name, education, experience_months, mine } = req.query;

    const where = {};
    const isHrMine = mine === '1' && req.user && req.user.role === 'hr';

    if (isHrMine) {
      if (!req.user.companyId) return res.json({ jobs: [] });
      where.company_id = req.user.companyId;
    } else {
      where.status = 'published';
    }

    if (city_code) where.city_code = String(city_code);
    if (city_name) where.city_name = String(city_name);

    // 学历/经验按“求职者能否满足”过滤：职位要求 <= 传入值
    const edu = toInt(education, null);
    if (edu !== null && edu >= 0 && edu <= 5) {
      where.min_education_level = { lte: edu };
    }
    const exp = toInt(experience_months, null);
    if (exp !== null && exp >= 0) {
      where.min_experience_months = { lte: exp };
    }

    const jobs = await prisma.jobs.findMany({
      where,
      select: JOB_SELECT,
      orderBy: { created_at: 'desc' },
    });

    return res.json({ jobs });
  } catch (err) {
    console.error('[jobs.list]', err);
    return res.status(500).json({ error: '获取职位列表失败' });
  }
});

// GET /api/jobs/:id  职位详情（非 published 仅本企业 HR 可见）
router.get('/jobs/:id', optionalAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: '职位 id 不合法' });

    const job = await prisma.jobs.findUnique({ where: { id }, select: JOB_SELECT });
    if (!job) return res.status(404).json({ error: '职位不存在' });

    if (job.status !== 'published') {
      const isOwnerHr =
        req.user &&
        req.user.role === 'hr' &&
        req.user.companyId &&
        String(req.user.companyId) === String(job.company_id);
      if (!isOwnerHr) return res.status(404).json({ error: '职位不存在' });
    }

    return res.json({ job });
  } catch (err) {
    console.error('[jobs.detail]', err);
    return res.status(500).json({ error: '获取职位详情失败' });
  }
});

// PATCH /api/jobs/:id  HR 修改自己的职位（只能改本企业职位）
router.patch('/jobs/:id', requireAuth, requireRole('hr'), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: '职位 id 不合法' });

    const existing = await prisma.jobs.findUnique({
      where: { id },
      select: {
        id: true,
        company_id: true,
        salary_min: true,
        salary_max: true,
        min_education_level: true,
        min_experience_months: true,
      },
    });
    if (!existing) return res.status(404).json({ error: '职位不存在' });
    if (!req.user.companyId || String(existing.company_id) !== String(req.user.companyId)) {
      return res.status(403).json({ error: '无权修改该职位' });
    }

    const b = req.body || {};
    const data = {};

    if (b.title !== undefined) {
      if (typeof b.title !== 'string' || !b.title.trim()) {
        return res.status(400).json({ error: 'title 不能为空' });
      }
      data.title = b.title.trim().slice(0, 128);
    }

    // 可空文本：传 null / 空串都统一存 NULL
    const nullIfBlank = (v, max) =>
      v === null || v === undefined || String(v).trim() === '' ? null : String(v).trim().slice(0, max);

    if (b.department !== undefined) data.department = nullIfBlank(b.department, 64);
    if (b.city_code !== undefined) data.city_code = nullIfBlank(b.city_code, 6);
    if (b.city_name !== undefined) data.city_name = nullIfBlank(b.city_name, 64);
    if (b.description !== undefined) data.description = b.description === null ? null : String(b.description);
    if (b.requirements !== undefined) data.requirements = b.requirements === null ? null : String(b.requirements);

    if (b.salary_min !== undefined) {
      const v = toInt(b.salary_min, null);
      if (v === null || v < 0) return res.status(400).json({ error: 'salary_min 不合法' });
      data.salary_min = v;
    }
    if (b.salary_max !== undefined) {
      const v = toInt(b.salary_max, null);
      if (v === null || v < 0) return res.status(400).json({ error: 'salary_max 不合法' });
      data.salary_max = v;
    }
    if (b.min_education_level !== undefined) {
      const v = toInt(b.min_education_level, null);
      if (v === null || v < 0 || v > 5) {
        return res.status(400).json({ error: 'min_education_level 需在 0-5 之间' });
      }
      data.min_education_level = v;
    }
    if (b.min_experience_months !== undefined) {
      const v = toInt(b.min_experience_months, null);
      if (v === null || v < 0) return res.status(400).json({ error: 'min_experience_months 不能为负' });
      data.min_experience_months = v;
    }

    // 只改单边时，用合并后的值校验区间，避免把薪资区间改坏
    const nextMin = data.salary_min !== undefined ? data.salary_min : existing.salary_min;
    const nextMax = data.salary_max !== undefined ? data.salary_max : existing.salary_max;
    if (nextMax < nextMin) {
      return res.status(400).json({ error: '薪资区间不合法（salary_max 需 >= salary_min）' });
    }

    // company_id / hr_user_id / status 一律不接受前端传入：V1 职位创建即 published
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段（status/company_id/hr_user_id 不可修改）' });
    }

    const job = await prisma.jobs.update({ where: { id }, data, select: JOB_SELECT });
    return res.json({ job });
  } catch (err) {
    console.error('[jobs.update]', err);
    return res.status(500).json({ error: '修改职位失败' });
  }
});

module.exports = { router };
