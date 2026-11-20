import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  EDU_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  formatDateTimeShort,
  formatMonths,
  formatSalary,
} from '../constants.js';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role, isLoggedIn } = useAuth();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [needResume, setNeedResume] = useState(false);

  // 我已经投过的这条记录（有值就不再显示投递按钮）
  const [myApp, setMyApp] = useState(null);
  const [checkingApp, setCheckingApp] = useState(false);

  const loadMine = useCallback(async () => {
    if (!isLoggedIn || role !== 'seeker') return null;
    try {
      const data = await api.myApplications();
      const found = (data.applications || []).find((a) => String(a.job_id) === String(id));
      setMyApp(found || null);
      return found || null;
    } catch {
      // 查不到不影响投递，按「没投过」处理
      return null;
    }
  }, [id, isLoggedIn, role]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .getJob(id)
      .then((data) => {
        if (alive) setJob(data.job);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!isLoggedIn || role !== 'seeker') {
      setMyApp(null);
      return undefined;
    }
    let alive = true;
    setCheckingApp(true);
    loadMine().finally(() => {
      if (alive) setCheckingApp(false);
    });
    return () => {
      alive = false;
    };
  }, [isLoggedIn, role, loadMine]);

  const handleApply = async () => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: `/jobs/${id}` } });
      return;
    }
    setApplying(true);
    setApplyError('');
    setNeedResume(false);
    try {
      await api.apply(id);
      await loadMine();
    } catch (err) {
      if (err.status === 409) {
        // 后端说投过了，那就把按钮换成「已投递」
        const found = await loadMine();
        if (!found) setMyApp({ job_id: id, status: null, applied_at: null });
      } else {
        setApplyError(err.message);
        if (err.message.includes('简历')) setNeedResume(true);
      }
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-sm text-slate-400">加载中…</p>;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-slate-700 underline">
          返回职位广场
        </Link>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div>
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← 返回职位广场
      </Link>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-brown-800">{job.title}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {job.companies?.name || '未知企业'}
              {job.companies?.industry ? ` · ${job.companies.industry}` : ''}
              {job.department ? ` · ${job.department}` : ''}
            </p>
          </div>
          <span className="text-xl font-semibold text-brand-600">
            {formatSalary(job.salary_min, job.salary_max)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-y border-slate-100 py-4 text-sm sm:grid-cols-4">
          <Info label="城市" value={job.city_name || '不限'} />
          <Info
            label="学历要求"
            value={job.min_education_level ? EDU_LABEL[job.min_education_level] || '不限' : '不限'}
          />
          <Info label="经验要求" value={formatMonths(job.min_experience_months)} />
          <Info label="发布时间" value={new Date(job.created_at).toLocaleDateString('zh-CN')} />
        </div>

        <Section title="职位描述" text={job.description} />
        <Section title="任职要求" text={job.requirements} />

        <div className="mt-8 border-t border-slate-100 pt-6">
          {checkingApp ? (
            <p className="text-sm text-slate-400">正在检查这个职位的投递状态…</p>
          ) : myApp ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>
                {myApp.applied_at
                  ? `你已于 ${formatDateTimeShort(myApp.applied_at)} 投递该职位`
                  : '你已经投递过该职位'}
              </span>
              {STATUS_LABEL[myApp.status] && (
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    STATUS_STYLE[myApp.status] || 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {STATUS_LABEL[myApp.status]}
                </span>
              )}
              <Link to="/my/applications" className="ml-auto text-brand-700 underline">
                返回我的投递
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleApply}
                disabled={applying || role === 'hr'}
                className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {applying ? '投递中…' : role === 'hr' ? 'HR 账号不能投递' : isLoggedIn ? '投递简历' : '登录后投递'}
              </button>

              {applyError && (
                <span className="text-sm text-red-600">
                  {applyError}
                  {needResume && (
                    <Link to="/my/resume" className="ml-2 underline">
                      去填写简历
                    </Link>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-slate-800">{value}</p>
    </div>
  );
}

function Section({ title, text }) {
  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-brown-800">{title}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{text || '未填写'}</p>
    </div>
  );
}
