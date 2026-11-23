// HR 单个职位的投递列表（从「投递管理」的职位表点进来）
// 状态筛选 + 排序 + 分页（写进 URL）+ 投递表 + 简历抽屉
// 抽屉里做硬条件逐项对比，拒绝前按不满足项预选原因并二次确认

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api.js';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import SelectMenu from '../../components/SelectMenu.jsx';
import {
  EDU_LABEL,
  REJECT_REASON_LABEL,
  REJECT_STAGE_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  formatDateTimeShort,
} from '../../constants.js';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'applied_desc', label: '投递时间 新→旧' },
  { value: 'applied_asc', label: '投递时间 旧→新' },
];

const REJECT_REASONS = ['education', 'experience', 'city', 'other'];

// 状态机 -> 抽屉底部按钮（与后端 TRANSITIONS 一致）
const ACTIONS = {
  pending: [
    { status: 'screened', label: '通过初筛' },
    { reject: true, label: '拒绝' },
  ],
  screened: [
    { status: 'interview', label: '约面试' },
    { reject: true, label: '拒绝' },
  ],
  interview: [
    { status: 'hired', label: '标记录用' },
    { reject: true, label: '拒绝' },
  ],
};

const badgeClass = (status) =>
  `inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs ${
    STATUS_STYLE[status] || 'bg-slate-100 text-slate-600'
  }`;

// 列表接口的 formatMonths 会把 0 显示成「经验不限」，这里要区分「没填」和「不限」
const monthsText = (months) => {
  if (!months) return '未填';
  if (months % 12 === 0) return `${months / 12} 年`;
  return `${months} 个月`;
};

/**
 * 硬条件逐项对比：返回每项的「要求 / 候选人 / 结论」
 * state：ok 符合、fail 不符、skip 未比较（职位不限或候选人没填）
 */
function buildConditions(app) {
  const r = app?.resumes || {};
  const j = app?.jobs || {};

  const eduReq = j.min_education_level ?? 0;
  const expReq = j.min_experience_months ?? 0;
  const citySkipped = !j.city_code || !r.expected_city_code;

  return [
    {
      key: 'education',
      label: '学历',
      required: eduReq ? `${EDU_LABEL[eduReq]}及以上` : '不限',
      actual: EDU_LABEL[r.highest_education_level] || '未填',
      state: !eduReq ? 'skip' : (r.highest_education_level ?? 0) >= eduReq ? 'ok' : 'fail',
    },
    {
      key: 'experience',
      label: '经验',
      required: expReq ? `${monthsText(expReq)}以上` : '不限',
      actual: monthsText(r.work_months),
      state: !expReq ? 'skip' : (r.work_months ?? 0) >= expReq ? 'ok' : 'fail',
    },
    {
      key: 'city',
      label: '城市',
      required: j.city_name || '不限',
      actual: r.expected_city_name || '未填',
      state: citySkipped
        ? 'skip'
        : String(j.city_code) === String(r.expected_city_code)
          ? 'ok'
          : 'fail',
    },
  ];
}

// 拒绝原因默认值：取第一个不满足的硬条件，都不满足（或都没比较）则「其他」
function defaultRejectReason(app) {
  const firstFail = buildConditions(app).find((c) => c.state === 'fail');
  return firstFail ? firstFail.key : 'other';
}

const CONDITION_STYLE = {
  ok: { dot: 'bg-emerald-100 text-emerald-700', text: '合格', badge: 'text-emerald-700' },
  fail: { dot: 'bg-wine-100 text-wine-700', text: '不符', badge: 'text-wine-700' },
  skip: { dot: 'bg-slate-100 text-slate-400', text: '未比较', badge: 'text-slate-400' },
};

function ResumeDrawer({ id, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('other');
  const [rejectNote, setRejectNote] = useState('');
  // 拒绝前的二次确认弹窗（自绘，不用 window.confirm：iframe 里会被静默忽略）
  const [confirmingReject, setConfirmingReject] = useState(false);

  useEffect(() => {
    let alive = true;
    setDetail(null);
    setError('');
    setRejecting(false);
    setConfirmingReject(false);
    setRejectNote('');

    api
      .hrApplicationDetail(id)
      .then((res) => {
        if (!alive) return;
        setDetail(res.application);
        setRejectReason(defaultRejectReason(res.application));
      })
      .catch((err) => alive && setError(err.message));

    return () => {
      alive = false;
    };
  }, [id]);

  const changeStatus = async (payload) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.updateApplicationStatus(id, payload);
      setDetail((prev) => (prev ? { ...prev, ...res.application } : prev));
      setRejecting(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // 拒绝前二次确认：把原因和「不可撤销」都说清楚
  const doReject = () => {
    const note = rejectNote.trim();
    setConfirmingReject(false);
    changeStatus({
      status: 'rejected',
      reject_reason: rejectReason,
      reject_note: note || undefined,
    });
  };

  const resume = detail?.resumes;
  const job = detail?.jobs;
  const actions = detail ? ACTIONS[detail.status] : null;
  const conditions = detail ? buildConditions(detail) : [];

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} aria-hidden />

        <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-base font-semibold text-slate-900">
                  {resume?.full_name || '候选人'}
                </h2>
                {detail && <span className={badgeClass(detail.status)}>{STATUS_LABEL[detail.status]}</span>}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                应聘 {job?.title || '—'}
                {detail && <span className="ml-2 text-slate-400">投递于 {formatDateTimeShort(detail.applied_at)}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              关闭
            </button>
          </header>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {!detail && !error && (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            )}

            {detail && (
              <>
                <section>
                  <h3 className="mb-2 text-xs font-medium text-slate-400">联系方式</h3>
                  <dl className="space-y-1.5 text-slate-700">
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slate-500">手机</dt>
                      <dd>{resume?.contact_phone || '—'}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slate-500">邮箱</dt>
                      <dd className="break-all">{resume?.contact_email || '—'}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slate-500">期望城市</dt>
                      <dd>{resume?.expected_city_name || '不限'}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-medium text-slate-400">教育与经验</h3>
                  <dl className="space-y-1.5 text-slate-700">
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slate-500">学历</dt>
                      <dd>{EDU_LABEL[resume?.highest_education_level] || '—'}</dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slate-500">学校</dt>
                      <dd>
                        {resume?.school || '—'}
                        {resume?.graduation_year && (
                          <span className="ml-2 text-xs text-slate-400">{resume.graduation_year} 年毕业</span>
                        )}
                      </dd>
                    </div>
                    <div className="flex gap-3">
                      <dt className="w-16 shrink-0 text-slate-500">工作年限</dt>
                      <dd>{resume?.work_months ? monthsText(resume.work_months) : '未填'}</dd>
                    </div>
                  </dl>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-medium text-slate-400">硬条件对比</h3>
                    <span className="text-xs text-slate-400">
                      投递时已按 学历 → 经验 → 城市 自动初筛
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {conditions.map((c) => {
                      const style = CONDITION_STYLE[c.state];
                      return (
                        <li key={c.key} className="flex items-start gap-3 px-3 py-2.5">
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${style.dot}`}
                          >
                            {c.state === 'ok' ? '✓' : c.state === 'fail' ? '✕' : '—'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-slate-800">
                              <span className="font-medium">{c.label}</span>
                              <span className={`text-xs ${style.badge}`}>{style.text}</span>
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              要求 {c.required}
                              <span className="mx-1.5 text-slate-300">·</span>
                              候选人 {c.actual}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                {detail.status === 'rejected' && (
                  <section>
                    <h3 className="mb-2 text-xs font-medium text-slate-400">拒绝原因</h3>
                    <div className="rounded-xl bg-wine-50 px-3.5 py-3 text-wine-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {REJECT_REASON_LABEL[detail.reject_reason] ||
                            detail.reject_reason ||
                            '未填写原因'}
                        </span>
                        {REJECT_STAGE_LABEL[detail.reject_stage] && (
                          <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] text-wine-600">
                            {REJECT_STAGE_LABEL[detail.reject_stage]}
                          </span>
                        )}
                      </div>
                      {detail.reject_note && (
                        <div className="mt-2.5 rounded-lg bg-white/60 px-3 py-2">
                          <div className="text-[11px] text-wine-600/80">备注</div>
                          <p className="mt-1 whitespace-pre-line break-words text-sm leading-6">
                            {detail.reject_note}
                          </p>
                        </div>
                      )}
                      {detail.screened_at && (
                        <p className="mt-2 text-[11px] text-wine-600/70">
                          处理于 {formatDateTimeShort(detail.screened_at)}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-xs font-medium text-slate-400">工作经历</h3>
                  <p className="whitespace-pre-line text-slate-700">
                    {resume?.work_experience || '未填写'}
                  </p>
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-medium text-slate-400">自我评价</h3>
                  <p className="whitespace-pre-line text-slate-700">
                    {resume?.self_evaluation || '未填写'}
                  </p>
                </section>
              </>
            )}
          </div>

          {detail && (
            <footer className="border-t border-slate-100 px-5 py-3">
              {rejecting ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">拒绝原因</span>
                    <span className="text-xs text-slate-400">已按不满足的硬条件预选</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {REJECT_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setRejectReason(reason)}
                        className={`rounded-md border px-2.5 py-1 text-xs transition ${
                          rejectReason === reason
                            ? 'border-wine-300 bg-wine-50 text-wine-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {REJECT_REASON_LABEL[reason]}
                      </button>
                    ))}
                  </div>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-wine-300 focus:ring-2 focus:ring-wine-100"
                    placeholder="备注（选填，会显示给求职者）"
                    maxLength={255}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingReject(true)}
                      className="flex-1 rounded-lg bg-wine-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-wine-800 disabled:opacity-60"
                    >
                      {busy ? '提交中…' : '确认拒绝'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejecting(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : actions ? (
                <div className="flex gap-2">
                  {actions.map((action) =>
                    action.reject ? (
                      <button
                        key="reject"
                        type="button"
                        onClick={() => setRejecting(true)}
                        className="rounded-lg border border-wine-200 px-3 py-2 text-sm text-wine-700 transition hover:bg-wine-50"
                      >
                        拒绝
                      </button>
                    ) : (
                      <button
                        key={action.status}
                        type="button"
                        disabled={busy}
                        onClick={() => changeStatus({ status: action.status })}
                        className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
                      >
                        {busy ? '处理中…' : action.label}
                      </button>
                    )
                  )}
                </div>
              ) : (
                <p className="py-1 text-center text-xs text-slate-400">
                  {detail.status === 'hired' ? '该候选人已录用，流程结束' : '该投递已拒绝，流程结束'}
                </p>
              )}
            </footer>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmingReject}
        tone="danger"
        title="确认拒绝这份投递？"
        description={detail ? `候选人「${resume?.full_name || '—'}」` : ''}
        confirmText="确认拒绝"
        loading={busy}
        onConfirm={doReject}
        onCancel={() => !busy && setConfirmingReject(false)}
      >
        <dl className="mt-3 space-y-1.5 rounded-lg bg-wine-50 px-3 py-2.5 text-xs text-wine-700">
          <div className="flex gap-3">
            <dt className="w-14 shrink-0 text-wine-600/80">拒绝原因</dt>
            <dd className="font-medium">{REJECT_REASON_LABEL[rejectReason] || '其他'}</dd>
          </div>
          {rejectNote.trim() && (
            <div className="flex gap-3">
              <dt className="w-14 shrink-0 text-wine-600/80">备注</dt>
              <dd className="whitespace-pre-line break-words leading-5">{rejectNote.trim()}</dd>
            </div>
          )}
        </dl>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          拒绝后不可撤销，求职者会在「我的投递」的详情里看到该原因。
        </p>
      </ConfirmDialog>
    </>
  );
}

// 状态胶囊：既是概览也是筛选（顺序即展示顺序）
const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理', accent: true },
  { value: 'screened', label: '初筛通过' },
  { value: 'interview', label: '面试中' },
  { value: 'hired', label: '已录用' },
  { value: 'rejected', label: '已拒绝' },
];

export default function HrJobApplications() {
  // 路由参数即职位：/hr/applications/5 → 只看 5 号职位；all → 全部职位
  const { jobId: jobParam } = useParams();
  const jobId = !jobParam || jobParam === 'all' ? '' : jobParam;

  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const sort = searchParams.get('sort') || 'applied_desc';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.hrApplications({
        job_id: jobId,
        status,
        sort,
        page,
        page_size: PAGE_SIZE,
      });
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  }, [jobId, status, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  // 改筛选/排序时回到第 1 页；翻页时保留其它条件
  const setFilter = (patch, resetPage = false) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage) next.delete('page');
    setSearchParams(next, { replace: true });
  };

  const applications = data?.applications || [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const jobStats = data?.job_stats || [];
  const currentJob = jobStats.find((j) => String(j.job_id) === jobId);
  // 路由里的职位不在本企业职位列表里（手改 URL / 职位被删）
  const jobMissing = Boolean(data) && Boolean(jobId) && !currentJob;

  // 胶囊上的数字：指定职位取该职位的分状态计数，全部职位取全局统计
  // （始终是「不筛状态」的基数，切换筛选时数字不跟着变）
  const statusAllCount = jobId
    ? currentJob?.total ?? 0
    : ['pending', 'screened', 'interview', 'hired', 'rejected'].reduce(
        (s, k) => s + (data?.stats?.[k] || 0),
        0
      );
  const tabCount = (value) => {
    if (!value) return statusAllCount;
    if (jobId) return currentJob?.[value] ?? 0;
    return data?.stats?.[value] ?? 0;
  };

  const title = currentJob?.title || (jobId ? '该职位' : '全部职位');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/hr/applications"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[15px] font-medium text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-[18px] w-[18px]">
              <path
                d="M11.5 5l-5 5 5 5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            返回投递管理
          </Link>
          <h1 className="mt-2.5 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900">
            <span className="truncate">{title}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
              投递 {statusAllCount} 人
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            只显示通过自动初筛的投递，点「查看简历」查看硬条件对比与完整简历
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">排序</span>
          <SelectMenu
            label="排序"
            value={sort}
            options={SORT_OPTIONS}
            onChange={(v) => setFilter({ sort: v === 'applied_desc' ? '' : v }, true)}
            className="w-44"
          />
        </div>
      </div>

      {/* 状态胶囊：数字是这个职位下各状态的条数，点一下只看该状态 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          const count = tabCount(tab.value);
          return (
            <button
              key={tab.value || 'all'}
              type="button"
              onClick={() => setFilter({ status: tab.value }, true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition ${
                active
                  ? 'border-brand-300 bg-brand-50 font-medium text-brand-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:text-brand-700'
              }`}
            >
              {tab.label}
              <span
                className={`tabular-nums ${
                  active ? 'text-brand-700' : count ? 'text-slate-500' : 'text-slate-300'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="rounded border border-red-300 px-2 py-1 text-xs">
            重试
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">候选人</th>
                {/* 单职位视角下「应聘职位」每行都一样，没必要占一列 */}
                {!jobId && <th className="px-4 py-2.5 font-medium">应聘职位</th>}
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">学历 / 经验</th>
                <th className="px-4 py-2.5 font-medium">投递时间</th>
                <th className="px-4 py-2.5 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.map((app) => (
                <tr key={app.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{app.resumes?.full_name || '—'}</div>
                    <div className="mt-0.5 text-xs text-slate-400">{app.resumes?.contact_phone || ''}</div>
                  </td>
                  {!jobId && <td className="px-4 py-3 text-slate-700">{app.jobs?.title || '—'}</td>}
                  <td className="px-4 py-3">
                    <span className={badgeClass(app.status)}>{STATUS_LABEL[app.status] || app.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {EDU_LABEL[app.resumes?.highest_education_level] || '—'} ·{' '}
                    {monthsText(app.resumes?.work_months)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTimeShort(app.applied_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setActiveId(app.id)}
                      className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                    >
                      查看简历
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data && !error && (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        )}

        {data && applications.length === 0 && (
          <div className="px-4 py-14 text-center text-sm text-slate-500">
            {jobMissing
              ? '该职位不存在或已被删除'
              : status
                ? '当前状态下没有投递'
                : jobId
                  ? '这个职位还没有投递'
                  : '还没有投递'}
            {status && !jobMissing && (
              <button
                type="button"
                onClick={() => setFilter({ status: '' }, true)}
                className="ml-2 text-brand-700 hover:underline"
              >
                清空状态筛选
              </button>
            )}
          </div>
        )}

        {data && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>
              共 {total} 条 · 第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setFilter({ page: String(page - 1) })}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setFilter({ page: String(page + 1) })}
                className="rounded-md border border-slate-200 px-2.5 py-1.5 transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {activeId && (
        <ResumeDrawer id={activeId} onClose={() => setActiveId(null)} onChanged={load} />
      )}
    </div>
  );
}
