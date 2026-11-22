// 学历、经验、城市、状态的对照表与格式化函数
// 集中放这里，避免各页面各写一套

export const EDU_OPTIONS = [
  { value: 1, label: '高中及以下' },
  { value: 2, label: '大专' },
  { value: 3, label: '本科' },
  { value: 4, label: '硕士' },
  { value: 5, label: '博士' },
];

export const EDU_LABEL = EDU_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

// 常用城市，code 与数据库 city_code 一致（GB/T 2260 前 6 位）
export const CITY_OPTIONS = [
  { code: '310100', name: '上海' },
  { code: '110100', name: '北京' },
  { code: '440300', name: '深圳' },
  { code: '440100', name: '广州' },
  { code: '330100', name: '杭州' },
  { code: '320100', name: '南京' },
  { code: '510100', name: '成都' },
  { code: '420100', name: '武汉' },
];

export const EXP_OPTIONS = [
  { value: 12, label: '1 年以上' },
  { value: 24, label: '2 年以上' },
  { value: 36, label: '3 年以上' },
  { value: 60, label: '5 年以上' },
];

export const STATUS_LABEL = {
  // 投递时后端已自动跑过硬条件初筛，pending = 通过初筛、等 HR 处理
  pending: '待处理',
  screened: '初筛通过',
  rejected: '已拒绝',
  interview: '面试中',
  hired: '已录用',
};

export const STATUS_STYLE = {
  pending: 'bg-slate-100 text-slate-600',
  screened: 'bg-sky-50 text-sky-700',
  rejected: 'bg-wine-50 text-wine-700',
  interview: 'bg-indigo-50 text-indigo-700',
  hired: 'bg-emerald-50 text-emerald-700',
};

// 拒绝原因：谁拒的 + 为什么
export const REJECT_STAGE_LABEL = {
  sql: '系统初筛',
  manual: 'HR 操作',
};

export const REJECT_REASON_LABEL = {
  education: '学历不符',
  experience: '经验不足',
  city: '城市不符',
  other: '其他',
};

// 职位状态（V1 创建即发布，其余值留给后续版本）
export const JOB_STATUS_LABEL = {
  draft: '草稿',
  published: '在招',
  closed: '已关闭',
};

// 投递管理的状态筛选卡在页面内定义（要带顺序和「全部」项），这里不再保留一份

export function formatSalary(min, max) {
  if (!min && !max) return '薪资面议';
  const k = (n) => `${Math.round(n / 1000)}K`;
  if (min && max) return `${k(min)}-${k(max)}`;
  return `${k(min || max)} 起`;
}

export function formatMonths(months) {
  if (!months) return '经验不限';
  if (months % 12 === 0) return `${months / 12} 年`;
  return `${months} 个月`;
}

// 短时间「MM-DD HH:mm」：库里存 UTC、接口返回带 Z，new Date() 会自动转成本地时区
export function formatDateTimeShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 发布时间：今天 / 昨天 / N 天前 / MM-DD，超过一周直接给日期
export function formatRelativeDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dayStart = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / 86400000);
  if (diff <= 0) return '今天发布';
  if (diff === 1) return '昨天发布';
  if (diff < 7) return `${diff} 天前发布`;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} 发布`;
}
