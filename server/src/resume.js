const express = require('express');
const prisma = require('./db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

const RESUME_SELECT = {
  id: true,
  user_id: true,
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
  created_at: true,
  updated_at: true,
};

const toInt = (v, def) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
};

const trimOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

// GET /api/resume  读取自己的简历（求职者）
router.get('/resume', requireAuth, requireRole('seeker'), async (req, res) => {
  try {
    const resume = await prisma.resumes.findUnique({
      where: { user_id: req.user.userId },
      select: RESUME_SELECT,
    });
    if (!resume) return res.status(404).json({ error: '尚未填写简历' });
    return res.json({ resume });
  } catch (err) {
    console.error('[resume.get]', err);
    return res.status(500).json({ error: '获取简历失败' });
  }
});

// PUT /api/resume  新增 / 更新自己的简历（求职者）
router.put('/resume', requireAuth, requireRole('seeker'), async (req, res) => {
  try {
    const b = req.body || {};

    if (typeof b.full_name !== 'string' || !b.full_name.trim()) {
      return res.status(400).json({ error: 'full_name 不能为空' });
    }
    if (typeof b.contact_phone !== 'string' || !b.contact_phone.trim()) {
      return res.status(400).json({ error: 'contact_phone 不能为空' });
    }
    const highest_education_level = toInt(b.highest_education_level, null);
    if (highest_education_level === null || highest_education_level < 1 || highest_education_level > 5) {
      return res.status(400).json({ error: 'highest_education_level 需在 1-5 之间' });
    }

    const work_months = toInt(b.work_months, 0);
    if (work_months < 0) {
      return res.status(400).json({ error: 'work_months 不能为负' });
    }

    const graduation_year = b.graduation_year === undefined || b.graduation_year === null || b.graduation_year === ''
      ? null
      : toInt(b.graduation_year, null);
    if (b.graduation_year !== undefined && b.graduation_year !== null && b.graduation_year !== '' && graduation_year === null) {
      return res.status(400).json({ error: 'graduation_year 必须是整数' });
    }

    const data = {
      full_name: b.full_name.trim(),
      contact_phone: b.contact_phone.trim(),
      contact_email: trimOrNull(b.contact_email),
      expected_city_code: trimOrNull(b.expected_city_code),
      expected_city_name: trimOrNull(b.expected_city_name),
      highest_education_level,
      school: trimOrNull(b.school),
      graduation_year,
      work_months,
      work_experience: trimOrNull(b.work_experience),
      self_evaluation: trimOrNull(b.self_evaluation),
    };

    // user_id 唯一，一人一份简历：有则更新，无则新建
    const resume = await prisma.resumes.upsert({
      where: { user_id: req.user.userId },
      update: data,
      create: { user_id: req.user.userId, ...data },
      select: RESUME_SELECT,
    });

    return res.json({ resume });
  } catch (err) {
    console.error('[resume.put]', err);
    return res.status(500).json({ error: '保存简历失败' });
  }
});

module.exports = { router };
