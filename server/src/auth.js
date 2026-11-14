const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('./db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 未配置，请检查 server/.env');
}

const PHONE_RE = /^1[3-9]\d{9}$/;
const ROLES = ['hr', 'seeker'];

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id.toString(),
      role: user.role,
      companyId: user.company_id === null ? null : user.company_id.toString(),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(user) {
  return {
    id: user.id.toString(),
    role: user.role,
    company_id: user.company_id === null ? null : user.company_id.toString(),
    name: user.name,
    phone: user.phone,
  };
}

/**
 * JWT 鉴权中间件：校验 Authorization: Bearer <token>
 * 通过后把 userId / role / companyId 挂到 req.user
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: '缺少 Authorization: Bearer <token>' });
  }

  try {
    const payload = jwt.verify(parts[1], JWT_SECRET);
    req.user = {
      userId: payload.userId,
      role: payload.role,
      companyId: payload.companyId === undefined ? null : payload.companyId,
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
}

/**
 * 可选鉴权：带 token 就解析，不带也放行（用于公开列表里识别 HR）
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');

  if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
    try {
      const payload = jwt.verify(parts[1], JWT_SECRET);
      req.user = {
        userId: payload.userId,
        role: payload.role,
        companyId: payload.companyId === undefined ? null : payload.companyId,
      };
    } catch (err) {
      // token 无效时按未登录处理，不拦截公开接口
    }
  }
  return next();
}

/**
 * 角色校验：必须放在 requireAuth 之后
 */
function requireRole(role) {
  return function (req, res, next) {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `该接口仅限 ${role} 访问` });
    }
    return next();
  };
}

// POST /api/register  注册（HR 或求职者）
router.post('/register', async (req, res) => {
  try {
    const { role, phone, password, name, company_name } = req.body || {};

    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: 'role 必须是 hr 或 seeker' });
    }
    if (typeof phone !== 'string' || !PHONE_RE.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 64) {
      return res.status(400).json({ error: '姓名不能为空且不超过 64 字' });
    }
    if (role === 'hr') {
      if (typeof company_name !== 'string' || !company_name.trim()) {
        return res.status(400).json({ error: 'HR 注册必须提供 company_name' });
      }
      if (company_name.trim().length > 200) {
        return res.status(400).json({ error: '企业名称不超过 200 字' });
      }
    }

    const existed = await prisma.users.findUnique({ where: { phone } });
    if (existed) {
      return res.status(409).json({ error: '该手机号已注册' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    let user;
    if (role === 'hr') {
      // 事务：先建企业拿 company_id，再建 HR 用户，任一步失败整体回滚
      user = await prisma.$transaction(async (tx) => {
        const company = await tx.companies.create({
          data: { name: company_name.trim() },
        });
        return tx.users.create({
          data: {
            role: 'hr',
            company_id: company.id,
            name: name.trim(),
            phone,
            password_hash,
          },
        });
      });
    } else {
      user = await prisma.users.create({
        data: {
          role: 'seeker',
          company_id: null,
          name: name.trim(),
          phone,
          password_hash,
        },
      });
    }

    return res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err && err.code === 'P2002') {
      return res.status(409).json({ error: '该手机号已注册' });
    }
    console.error('[register]', err);
    return res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/login  手机号 + 密码登录
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body || {};

    if (typeof phone !== 'string' || !phone || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: '手机号和密码不能为空' });
    }

    const user = await prisma.users.findUnique({ where: { phone } });
    if (!user) {
      return res.status(401).json({ error: '手机号或密码错误' });
    }

    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) {
      return res.status(401).json({ error: '手机号或密码错误' });
    }

    return res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: '登录失败' });
  }
});

module.exports = { router, requireAuth, optionalAuth, requireRole };
