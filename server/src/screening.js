// 硬条件初筛（后端自动执行，HR 无手动入口）
//
// 口径：学历 → 经验 → 城市，命中第一条即停；任意一边城市为空则跳过城市判断。
// 触发时机：求职者调用 POST /api/jobs/:id/apply 时，在写库前同步判定，
//          通过 → pending（进入 HR 待处理队列），不通过 → rejected 且 reject_stage='sql'。
// 可见性：reject_stage='sql' 的 rejected 记录对 HR 完全不可见
//        （概览统计、投递列表、职位卡片计数、简历详情一律过滤），
//        只在求职者自己的「我的投递」里保留，方便他看未通过原因。

const SYSTEM_STAGE = 'sql';

const EDU_NAME = { 1: '高中及以下', 2: '大专', 3: '本科', 4: '硕士', 5: '博士' };
const eduName = (level) => EDU_NAME[level] || '未填写';

// 职位侧常用「X 年以上」，候选人侧用月份更精确（2.5 年也能体现）
const expYears = (months) => {
  const y = months / 12;
  return Number.isInteger(y) ? String(y) : y.toFixed(1);
};

// 初筛判定需要的字段（jobs / resumes 各一份，投递接口直接复用）
const JOB_SCREEN_SELECT = {
  min_education_level: true,
  min_experience_months: true,
  city_code: true,
  city_name: true,
};

const RESUME_SCREEN_SELECT = {
  highest_education_level: true,
  work_months: true,
  expected_city_code: true,
  expected_city_name: true,
};

// HR 可见范围：排除被系统初筛拒掉的投递
// 用 NOT(AND(...)) 而不是 NOT({...})，避免 Prisma 把多字段 NOT 的语义读成「任一字段不满足」
const visibleFromHr = () => ({
  NOT: { AND: [{ status: 'rejected' }, { reject_stage: SYSTEM_STAGE }] },
});

/**
 * 判定一份简历是否满足职位的硬条件
 * @returns {{ passed: boolean, reason: string|null, note: string|null }}
 */
function evaluate(job, resume) {
  const r = resume || {};
  const edu = r.highest_education_level ?? 0;
  const months = r.work_months ?? 0;
  const minEdu = job.min_education_level ?? 0;
  const minExp = job.min_experience_months ?? 0;

  if (edu < minEdu) {
    return {
      passed: false,
      reason: 'education',
      note: `学历不满足：要求${eduName(minEdu)}及以上，候选人为${eduName(edu)}`,
    };
  }
  if (months < minExp) {
    return {
      passed: false,
      reason: 'experience',
      note: `经验不满足：要求 ${expYears(minExp)} 年以上，候选人 ${months} 个月`,
    };
  }
  if (job.city_code && r.expected_city_code && String(job.city_code) !== String(r.expected_city_code)) {
    return {
      passed: false,
      reason: 'city',
      note: `城市不匹配：职位在${job.city_name || job.city_code}，候选人期望${
        r.expected_city_name || r.expected_city_code
      }`,
    };
  }
  return { passed: true, reason: null, note: null };
}

/**
 * 判定结果 → 投递记录要写的字段
 * 通过时保持 pending，不写 reject_*（等 HR 处理）；不通过时落 system 拒绝。
 */
function screenFields(job, resume, at = new Date()) {
  const result = evaluate(job, resume);
  if (result.passed) {
    return {
      status: 'pending',
      reject_stage: null,
      reject_reason: null,
      reject_note: null,
      screened_at: null,
    };
  }
  return {
    status: 'rejected',
    reject_stage: SYSTEM_STAGE,
    reject_reason: result.reason,
    reject_note: result.note.slice(0, 255),
    screened_at: at,
  };
}

module.exports = {
  SYSTEM_STAGE,
  JOB_SCREEN_SELECT,
  RESUME_SCREEN_SELECT,
  visibleFromHr,
  evaluate,
  screenFields,
  eduName,
  expYears,
};
