import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import JobCard from '../components/JobCard.jsx';
import SelectMenu from '../components/SelectMenu.jsx';
import { CITY_OPTIONS, EDU_OPTIONS, EXP_OPTIONS } from '../constants.js';

const emptyFilters = { city_code: '', education: '', experience_months: '' };

const CITY_MENU = [
  { value: '', label: '全部城市' },
  ...CITY_OPTIONS.map((c) => ({ value: c.code, label: c.name })),
];
const EDU_MENU = [
  { value: '', label: '学历不限' },
  // 第 1 档本身就是最低学历，「及以上」接在「高中及以下」后面读不通
  ...EDU_OPTIONS.map((e) => ({
    value: e.value,
    label: e.value === 1 ? '高中及以上' : `${e.label}及以上`,
  })),
];
const EXP_MENU = [
  { value: '', label: '经验不限' },
  ...EXP_OPTIONS.map((e) => ({ value: e.value, label: e.label })),
];

export default function JobList() {
  const [filters, setFilters] = useState(emptyFilters);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const firstLoad = useRef(true);

  useEffect(() => {
    let alive = true;
    // 首次进入显示骨架；后续筛选保留旧列表只做淡出，页面高度与滚动位置都不动
    if (firstLoad.current) setLoading(true);
    else setRefreshing(true);
    setError('');

    api
      .listJobs(filters)
      .then((data) => {
        if (alive) setJobs(data.jobs || []);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setRefreshing(false);
        firstLoad.current = false;
      });

    return () => {
      alive = false;
    };
  }, [filters, tick]);

  const update = (key) => (value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const hasFilter = Object.values(filters).some(Boolean);
  const retry = () => setTick((n) => n + 1);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-brown-800">
            <span className="h-4 w-1 rounded-full bg-brand-500" aria-hidden="true" />
            职位广场
          </h1>
          <p className="mt-1.5 pl-3 text-sm text-slate-500">
            共 {jobs.length} 个{hasFilter ? '符合条件' : '在招'}职位
            {refreshing && <span className="ml-2 text-brand-600">筛选中…</span>}
          </p>
        </div>
        <span className="pb-0.5 text-xs text-slate-400">按发布时间排序</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
        <SelectMenu
          label="按城市筛选"
          className="w-36"
          value={filters.city_code}
          options={CITY_MENU}
          onChange={update('city_code')}
        />
        <SelectMenu
          label="按学历筛选"
          className="w-36"
          value={filters.education}
          options={EDU_MENU}
          onChange={update('education')}
        />
        <SelectMenu
          label="按经验筛选"
          className="w-36"
          value={filters.experience_months}
          options={EXP_MENU}
          onChange={update('experience_months')}
        />

        {hasFilter && (
          <button
            onClick={() => setFilters(emptyFilters)}
            className="ml-1 rounded-lg px-2 py-1 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-brand-700"
          >
            清空筛选
          </button>
        )}
      </div>

      <div>
        {error && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={retry} className="underline">
              重试
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <JobCardSkeleton key={i} />
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div
            className={`grid gap-3 transition-opacity duration-150 lg:grid-cols-2 ${
              refreshing ? 'pointer-events-none opacity-50' : 'opacity-100'
            }`}
          >
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : error ? null : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center">
            <p className="text-sm text-slate-500">没有符合条件的职位</p>
            {hasFilter && (
              <button onClick={() => setFilters(emptyFilters)} className="mt-2 text-sm text-brand-700 underline">
                清空筛选看看
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 骨架屏照抄真实卡片的结构，高度基本一致，首次加载不会跳一下
function JobCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex animate-pulse items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="h-4 w-32 rounded bg-slate-100" />
            <div className="h-4 w-16 rounded bg-brand-50" />
          </div>
          <div className="mt-2 h-3.5 w-44 rounded bg-slate-100" />
          <div className="mt-3 flex gap-2">
            <div className="h-6 w-12 rounded-md bg-slate-100" />
            <div className="h-6 w-12 rounded-md bg-slate-100" />
            <div className="h-6 w-10 rounded-md bg-slate-100" />
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="h-3 w-14 rounded bg-slate-100" />
        <div className="h-3 w-16 rounded bg-slate-100" />
      </div>
    </div>
  );
}
