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

// 拒绝原因：系统初筛 / HR 操作 · 原因（备注），空的部分直接跳过
function rejectText(app) {
  const stage = REJECT_STAGE_LABEL[app.reject_stage] || '';
  const reason = REJECT_REASON_LABEL[app.reject_reason] || '';
  const head = [stage, reason].filter(Boolean).join(' · ');
  const note = (app.reject_note || '').trim();
  if (!head && !note) return '';
  if (!note) return head;
  // HR 有时把备注直接写成和原因一样的词，别显示成「经验不足（经验不足）」
  const duplicated = reason && (note === reason || note.includes(reason) || reason.includes(note));
  if (duplicated) return head;
  return head ? `${head}（${note}）` : note;
}

export default function MyApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasResume, setHasResume] = useState(true); // 空列表时用来决定提示哪个按钮

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
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({ app }) {
  const job = app.jobs || {};
  const offline = job.status && job.status !== 'published';
  const reject = app.status === 'rejected' ? rejectText(app) : '';

  return (
    <Link
      to={`/jobs/${app.job_id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md"
    >
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

        <span
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium ${
            STATUS_STYLE[app.status] || 'bg-slate-100 text-slate-600'
          }`}
        >
          {STATUS_LABEL[app.status] || app.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <span className="text-sm font-semibold text-brand-600">
          {formatSalary(job.salary_min, job.salary_max)}
        </span>
        <span className="text-xs text-slate-400">{formatDateTimeShort(app.applied_at)} 投递</span>
      </div>

      {reject && (
        <p className="mt-3 rounded-lg bg-wine-50 px-3 py-2 text-xs leading-5 text-wine-700">
          拒绝原因：{reject}
        </p>
      )}
    </Link>
  );
}
