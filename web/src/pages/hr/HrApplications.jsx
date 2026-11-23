// HR 投递管理首页：一个职位一个方框（卡片），点卡片进入该职位的投递列表
// 用卡片而不是表格：职位少时横向列会把「已录用 / 已拒绝」挤出屏幕，
// 卡片里六项数字按两行三列排，窄屏也不会出现横向滚动。

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';

const METRICS = [
  { key: 'total', label: '全部' },
  { key: 'pending', label: '待处理', accent: true },
  { key: 'screened', label: '初筛通过' },
  { key: 'interview', label: '面试中' },
  { key: 'hired', label: '已录用' },
  { key: 'rejected', label: '已拒绝' },
];

const STATUS_KEYS = ['pending', 'screened', 'interview', 'hired', 'rejected'];

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="hidden h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-brand-500 sm:block"
    >
      <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] leading-4 text-slate-400">{label}</div>
      <div
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          !value ? 'text-slate-300' : accent ? 'text-brand-700' : 'text-slate-800'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

// 六项数字：宽屏一行排开，窄屏退回三列两行
function MetricRow({ source }) {
  return (
    <div className="grid flex-1 grid-cols-3 gap-x-3 gap-y-3 sm:grid-cols-6">
      {METRICS.map((m) => (
        <Metric key={m.key} label={m.label} value={source(m.key)} accent={m.accent} />
      ))}
    </div>
  );
}

export default function HrApplications() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.hrBreakdown());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const jobs = data?.job_stats || [];
  const stats = data?.stats;
  const totalCount = stats ? STATUS_KEYS.reduce((s, k) => s + (stats[k] || 0), 0) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">投递管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            只统计通过自动初筛的投递。点一个职位进去，查看候选人并处理简历
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {data ? (
            <>
              {jobs.length} 个职位 · 共 <span className="font-medium text-slate-800">{totalCount}</span> 条投递
            </>
          ) : (
            '加载中…'
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="rounded border border-red-300 px-2 py-1 text-xs">
            重试
          </button>
        </div>
      )}

      {/* 全部职位：跨职位汇总，样式上比单个职位轻一档，避免抢注意力 */}
      <Link
        to="/hr/applications/all"
        className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4 transition hover:border-brand-200 hover:bg-white hover:shadow-sm sm:flex-row sm:items-center sm:gap-6"
      >
        <div className="min-w-0 sm:w-52 sm:shrink-0">
          <div className="text-[15px] font-medium text-slate-700 group-hover:text-brand-800">全部职位</div>
          <div className="mt-1 text-xs text-slate-400">跨职位合计</div>
        </div>
        <MetricRow source={(key) => (key === 'total' ? totalCount : stats?.[key] ?? 0)} />
        <Chevron />
      </Link>

      {/* 一个职位一个方框 */}
      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            key={job.job_id}
            to={`/hr/applications/${job.job_id}`}
            className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-100 transition hover:-translate-y-px hover:border-brand-200 hover:shadow-md sm:flex-row sm:items-center sm:gap-6"
          >
            <div className="min-w-0 sm:w-52 sm:shrink-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-medium text-slate-800 group-hover:text-brand-800">
                  {job.title}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                    job.status === 'published'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {job.status === 'published' ? '在招' : '已下线'}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-400">{job.city_name || '城市不限'}</div>
            </div>
            <MetricRow source={(key) => job[key] || 0} />
            <Chevron />
          </Link>
        ))}

        {!data && !error && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}

        {data && jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
            还没有发布职位
          </div>
        )}
      </div>
    </div>
  );
}
