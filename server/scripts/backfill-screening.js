/**
 * 一次性回填：对存量 pending 投递补跑自动初筛（口径与投递接口一致）
 *
 * 背景：初筛从「HR 手动一键执行」改成「投递时后端自动执行」，
 *      改动前已存在的 pending 记录没被判定过，需要补一遍，
 *      否则不达标的人会继续留在 HR 的待处理队列里。
 *
 * 用法：cd server && node scripts/backfill-screening.js [--dry]
 */
const { PrismaClient } = require('@prisma/client');
const { evaluate } = require('../src/screening');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

(async () => {
  const pending = await prisma.applications.findMany({
    where: { status: 'pending' },
    select: {
      id: true,
      applied_at: true,
      jobs: {
        select: {
          id: true,
          title: true,
          min_education_level: true,
          min_experience_months: true,
          city_code: true,
          city_name: true,
        },
      },
      resumes: {
        select: {
          full_name: true,
          highest_education_level: true,
          work_months: true,
          expected_city_code: true,
          expected_city_name: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`待补判定的 pending 投递：${pending.length} 条${DRY ? '（dry-run，不写库）' : ''}\n`);

  let rejected = 0;
  for (const app of pending) {
    const job = app.jobs;
    const resume = app.resumes || {};
    const result = evaluate(job, resume);
    const who = resume.full_name || `#${app.id}`;
    const tag = result.passed ? '通过 → 留在待处理' : `拒绝（${result.reason}）${result.note}`;
    console.log(`app ${String(app.id).padEnd(3)} ${who.padEnd(6)} ${String(job?.title || '-').padEnd(10)} ${tag}`);

    if (!result.passed) {
      rejected += 1;
      if (!DRY) {
        await prisma.applications.update({
          where: { id: app.id },
          data: {
            status: 'rejected',
            reject_stage: 'sql',
            reject_reason: result.reason,
            reject_note: result.note.slice(0, 255),
            screened_at: new Date(),
          },
        });
      }
    }
  }

  console.log(`\n合计：通过 ${pending.length - rejected} 条，拒绝 ${rejected} 条`);
})().finally(() => prisma.$disconnect());
