import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  REJECT_REASON_LABEL,
  REJECT_STAGE_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  formatDateTimeShort,
  formatSalary,
} from '../constants.js';

// 每个状态给一句人话，求职者不用猜「初筛通过」之后会发生什么
// 已拒绝不写：原因就在下方，多一句「很遗憾」只是重复
const STATUS_HINT = {
  pending: 'HR 正在查看你的简历，有进展会在这里更新。',
  screened: '简历已通过初筛，HR 会与你联系安排后续面试。',
  interview: '你已进入面试环节，请留意 HR 的沟通。',
  hired: '恭喜，你已被录用，请留意 HR 的入职通知。',
};

export default function MyApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasResume, setHasResume] = useState(true); // 空列表时用来决定提示哪个按钮
  const [detail, setDetail] = useState(null); // 非空即打开投递详情

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.myApplications();
      const list = data.applications || [];
      setApplications(list);

      if (list.length === 0) {
        // 没投递时顺带确认有没有简历，提示文案不一样
        try {
          await api.getMyResume();
          setHasResume(true);
        } catch (err) {
          if (err.status === 404) setHasResume(false);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-brown-800">我的投递</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? '正在加载…' : error ? '加载失败' : `共 ${applications.length} 条投递记录`}
          </p>
        </div>
        <Link
          to="/"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
        >
          去职位广场
        </Link>
      </div>

      {error && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={load}
            className="rounded-md border border-red-300 bg-white px-3 py-1 text-sm text-red-700 transition hover:bg-red-100"
          >
            重试
          </button>
        </div>
      )}

      {loading && !error && <p className="py-16 text-center text-sm text-slate-400">加载中…</p>}

      {!loading && !error && applications.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-sm text-slate-600">还没有投递记录</p>
          {hasResume ? (
            <Link
              to="/"
              className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              去职位广场看看
            </Link>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">先去填一份简历，才能投递职位。</p>
              <Link
                to="/my/resume"
                className="mt-4 inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                去填写简历
              </Link>
            </>
          )}
        </div>
      )}

      {!loading && !error && applications.length > 0 && (
        <div className="space-y-3">
          {applications.map((app) => (
            <ApplicationCard key={app.id} app={app} onOpen={() => setDetail(app)} />
          ))}
        </div>
      )}

      {detail && <ApplicationDrawer app={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ApplicationCard({ app, onOpen }) {
  const job = app.jobs || {};
  const offline = job.status && job.status !== 'published';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-brown-800">
              {job.title || '职位已删除'}
            </h2>
            {offline && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                已下线
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            {job.companies?.name || '未知企业'} · {job.city_name || '不限'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              STATUS_STYLE[app.status] || 'bg-slate-100 text-slate-600'
            }`}
          >
            {STATUS_LABEL[app.status] || app.status}
          </span>

          <button
            type="button"
            onClick={onOpen}
            title="查看投递详情"
            aria-label="查看投递详情"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <EyeIcon />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm font-semibold text-brand-600">
          {formatSalary(job.salary_min, job.salary_max)}
        </span>
        <span className="text-xs text-slate-400">{formatDateTimeShort(app.applied_at)} 投递</span>
      </div>
    </div>
  );
}

// 右侧抽屉：状态说明 + 职位信息 +（已拒绝时）原因与备注
function ApplicationDrawer({ app, onClose }) {
  const job = app.jobs || {};
  const rejected = app.status === 'rejected';
  const reason = REJECT_REASON_LABEL[app.reject_reason] || '';
  const stage = REJECT_STAGE_LABEL[app.reject_stage] || '';
  const note = (app.reject_note || '').trim();

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="投递详情"
    >
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-brown-800">投递详情</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">{job.title || '职位已删除'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          <section>
            <div className="flex items-center justify-between gap-3">
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  STATUS_STYLE[app.status] || 'bg-slate-100 text-slate-600'
                }`}
              >
                {STATUS_LABEL[app.status] || app.status}
              </span>
              <span className="text-xs text-slate-400">
                {formatDateTimeShort(app.applied_at)} 投递
              </span>
            </div>
            {STATUS_HINT[app.status] && (
              <p className="mt-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm leading-6 text-slate-600">
                {STATUS_HINT[app.status]}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium text-slate-400">职位信息</h3>
            <div className="rounded-xl border border-slate-200 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-brown-800">{job.title || '职位已删除'}</span>
                {job.status && job.status !== 'published' && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    已下线
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {job.companies?.name || '未知企业'} · {job.city_name || '不限'}
              </div>
              <div className="mt-2 text-sm font-semibold text-brand-600">
                {formatSalary(job.salary_min, job.salary_max)}
              </div>
            </div>
          </section>

          {rejected && (
            <section>
              <h3 className="mb-2 text-xs font-medium text-slate-400">拒绝原因</h3>
              <div className="rounded-xl bg-wine-50 px-3.5 py-3 text-wine-700">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium">{reason || '未填写原因'}</span>
                  {stage && (
                    <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] text-wine-600">
                      {stage}
                    </span>
                  )}
                </div>

                {note && (
                  <div className="mt-2.5 rounded-lg bg-white/60 px-3 py-2">
                    <div className="text-[11px] text-wine-600/80">备注</div>
                    <p className="mt-1 whitespace-pre-line break-words text-sm leading-6">{note}</p>
                  </div>
                )}

                {app.screened_at && (
                  <p className="mt-2 text-[11px] text-wine-600/70">
                    处理于 {formatDateTimeShort(app.screened_at)}
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        <footer className="border-t border-slate-100 px-5 py-3">
          <Link
            to={`/jobs/${app.job_id}`}
            className="flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            查看职位详情
          </Link>
        </footer>
      </aside>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M2.2 10S5 5.2 10 5.2 17.8 10 17.8 10 15 14.8 10 14.8 2.2 10 2.2 10Z" />
      <circle cx="10" cy="10" r="2.3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
    </svg>
  );
}
