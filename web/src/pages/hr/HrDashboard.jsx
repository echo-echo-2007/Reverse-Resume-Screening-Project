// HR 工作台：只管职位本身（列表 + 新建/编辑）
// 投递进来时后端已按硬条件自动初筛过，未通过的人 HR 看不到；
// 统计和「不同职位下的投递者」都在投递管理页，这里不重复展示。

import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { formatSalary, formatRelativeDay } from '../../constants.js';

export default function HrDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // 从表单页保存后带过来的提示
  const [notice, setNotice] = useState(
    location.state?.notice ? { tone: 'success', text: location.state.notice } : null
  );

  // 提示只显示一次，读完后把 history state 清掉，刷新不再重复出现
  useEffect(() => {
    if (location.state?.notice) navigate(location.pathname, { replace: true });
  }, [location.state, location.pathname, navigate]);

  // 结果用固定在右下角的提示条：点的是列表下方的按钮，顶部提示很可能不在视口里
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), notice.tone === 'error' ? 9000 : 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await api.hrOverview());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 概览接口只用来取职位列表，统计数字在投递管理页展示
  const jobs = data?.jobs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">HR 工作台</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.name}，这里管理本企业的职位；候选人进度与统计请到「投递管理」查看
          </p>
        </div>
        <Link
          to="/hr/jobs/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          + 新建职位
        </Link>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="rounded border border-red-300 px-2 py-1 text-xs">
            重试
          </button>
        </div>
      )}

      {/* 提示条固定在视口右下角，滚动到哪都能看到 */}
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 w-[min(22rem,calc(100vw-3rem))]" role="status">
          <div
            className={`overflow-hidden rounded-xl border bg-white shadow-xl ${
              notice.tone === 'error' ? 'border-red-200' : 'border-slate-200'
            }`}
          >
            <div className={`h-1 w-full ${notice.tone === 'error' ? 'bg-red-400' : 'bg-brand-500'}`} />
            <div className="flex items-start gap-3 px-4 py-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  notice.tone === 'error' ? 'bg-red-400' : 'bg-brand-500'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-slate-700">{notice.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="关闭提示"
                className="shrink-0 rounded px-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">
            本企业职位
            {data && <span className="ml-1.5 font-normal text-slate-400">{jobs.length} 个</span>}
          </h2>
          <span className="text-xs text-slate-400">按创建时间倒序</span>
        </div>

        {!data && !error && (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        )}

        {data && jobs.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500">还没有发布职位</p>
            <Link to="/hr/jobs/new" className="mt-2 inline-block text-sm text-brand-700 hover:underline">
              去建第一个职位 →
            </Link>
          </div>
        )}

        {jobs.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50/70"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                    >
                      {job.title}
                    </Link>
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                      在招
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{job.department || '未填部门'}</span>
                    <span className="text-slate-300">·</span>
                    <span>{job.city_name || '城市不限'}</span>
                    <span className="text-slate-300">·</span>
                    <span>{formatSalary(job.salary_min, job.salary_max)}</span>
                    <span className="text-slate-300">·</span>
                    <span>{formatRelativeDay(job.created_at)}</span>
                  </div>
                </div>

                {/* 投递人数与状态统计统一在投递管理页看，职位行不再显示 */}
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/hr/jobs/${job.id}/edit`}
                    className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                  >
                    编辑
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
