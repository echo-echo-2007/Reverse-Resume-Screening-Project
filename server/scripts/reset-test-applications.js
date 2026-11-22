/**
 * 测试数据复位脚本：把「张招聘（13841110001 / 初筛测试公司）」名下所有投递
 * 重置为 pending，并清空 reject_* / screened_at / hr_viewed_at，投递时间错峰。
 *
 * 用法：cd server && node scripts/reset-test-applications.js
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const HR_NAME = '张招聘'
const HR_PHONE = '13841110001'

;(async () => {
  const hr = await prisma.users.findFirst({
    where: { name: HR_NAME, phone: HR_PHONE },
    select: { id: true, name: true, company_id: true, companies: { select: { name: true } } },
  })
  if (!hr) throw new Error('未找到张招聘')

  const jobs = await prisma.jobs.findMany({
    where: { hr_user_id: hr.id },
    select: { id: true, title: true, status: true },
    orderBy: { id: 'asc' },
  })
  const jobIds = jobs.map((j) => j.id)

  const before = await prisma.applications.findMany({
    where: { job_id: { in: jobIds } },
    select: { id: true, job_id: true, status: true, reject_reason: true, reject_note: true },
    orderBy: { id: 'asc' },
  })
  console.log('恢复前：', JSON.stringify(before.map((a) => [Number(a.id), a.status]), null, 0))

  // 应用时间错峰：让「最新投递 / 最早投递」排序有区分度
  const now = Date.now()
  const H = 3600 * 1000
  const D = 24 * H
  const offsetByApp = {
    5: 6 * D,
    6: 5 * D,
    7: 5 * D - 3 * H,
    8: 4 * D,
    9: 4 * D - 2 * H,
    10: 3 * D,
    11: 2 * D,
    12: D - 5 * H,
    13: D - 2 * H,
    14: 5 * H,
  }

  let changed = 0
  for (const app of before) {
    const id = Number(app.id)
    const offset = offsetByApp[id]
    const appliedAt = new Date(now - (offset ?? 3 * D))
    await prisma.applications.update({
      where: { id: app.id },
      data: {
        status: 'pending',
        reject_stage: null,
        reject_reason: null,
        reject_note: null,
        screened_at: null,
        hr_viewed_at: null,
        applied_at: appliedAt,
        updated_at: appliedAt,
      },
    })
    changed += 1
  }

  console.log(`\n✅ 已初始化 ${changed} 条投递为 pending（岗位：${jobs.map((j) => `${j.id}-${j.title}`).join('、')}）`)

  const after = await prisma.applications.findMany({
    where: { job_id: { in: jobIds } },
    select: {
      id: true, job_id: true, status: true, applied_at: true, screened_at: true,
      reject_reason: true, reject_note: true, hr_viewed_at: true,
      resumes: { select: { full_name: true, highest_education_level: true, work_months: true, expected_city_name: true } },
    },
    orderBy: [{ job_id: 'asc' }, { applied_at: 'desc' }],
  })
  console.log('\nid  岗位  姓名      学历 经验  期望城市  状态     投递时间')
  for (const a of after) {
    const r = a.resumes
    console.log(
      `${String(a.id).padEnd(3)} ${String(a.job_id).padEnd(4)} ${(r.full_name || '').padEnd(8)} ${r.highest_education_level}    ${String(r.work_months).padStart(3)}  ${(r.expected_city_name || '-').padEnd(8)} ${a.status.padEnd(8)} ${a.applied_at.toISOString().slice(0, 16).replace('T', ' ')}`
    )
  }
  const byJob = {}
  for (const a of after) byJob[a.job_id] = (byJob[a.job_id] || 0) + 1
  console.log('\n各岗位投递数：', JSON.stringify(byJob))
})().finally(() => prisma.$disconnect())
