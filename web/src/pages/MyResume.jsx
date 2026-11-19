import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Field, { inputClass } from '../components/Field.jsx';
import { CITY_OPTIONS, EDU_OPTIONS } from '../constants.js';

const CURRENT_YEAR = new Date().getFullYear();

// 表单里统一用字符串，提交时再转成接口要的类型；
// work_years 是「年」，库里存 work_months（月），提交时 ×12
const EMPTY_FORM = {
  full_name: '',
  contact_phone: '',
  contact_email: '',
  expected_city_code: '',
  highest_education_level: '',
  school: '',
  graduation_year: '',
  work_years: '',
  work_experience: '',
  self_evaluation: '',
};

const monthsToYears = (months) => {
  if (months === null || months === undefined) return '';
  return String(Math.round((months / 12) * 10) / 10);
};

function resumeToForm(resume) {
  return {
    full_name: resume.full_name || '',
    contact_phone: resume.contact_phone || '',
    contact_email: resume.contact_email || '',
    expected_city_code: resume.expected_city_code || '',
    highest_education_level: resume.highest_education_level
      ? String(resume.highest_education_level)
      : '',
    school: resume.school || '',
    graduation_year: resume.graduation_year ? String(resume.graduation_year) : '',
    work_years: monthsToYears(resume.work_months),
    work_experience: resume.work_experience || '',
    self_evaluation: resume.self_evaluation || '',
  };
}

// 前端校验：和文档 1.3 的规则一一对应，通过后再发请求
function validate(form) {
  const errors = {};

  if (!form.full_name.trim()) errors.full_name = '请填写姓名';
  else if (form.full_name.trim().length > 64) errors.full_name = '姓名不能超过 64 个字';

  if (!form.contact_phone.trim()) errors.contact_phone = '请填写手机号';
  else if (!/^1[3-9]\d{9}$/.test(form.contact_phone.trim()))
    errors.contact_phone = '手机号格式不对，应为 1 开头的 11 位数字';

  if (form.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim()))
    errors.contact_email = '邮箱格式不对，例如 name@example.com';

  if (!form.highest_education_level) errors.highest_education_level = '请选择最高学历';

  if (form.school.trim().length > 128) errors.school = '学校名称不能超过 128 个字';

  if (form.graduation_year.trim()) {
    const year = Number(form.graduation_year);
    if (!Number.isInteger(year)) errors.graduation_year = '毕业年份请填 4 位数字';
    else if (year < 1900 || year > CURRENT_YEAR + 10)
      errors.graduation_year = `毕业年份需在 1900 到 ${CURRENT_YEAR + 10} 之间`;
  }

  if (form.work_years.trim() === '') errors.work_years = '请填写工作年限，没有经验填 0';
  else {
    const years = Number(form.work_years);
    if (!Number.isFinite(years) || years < 0) errors.work_years = '工作年限需为 0 或正数';
    else if (years > 60) errors.work_years = '工作年限看起来不太对，请检查';
    else if (Math.abs(years * 10 - Math.round(years * 10)) > 1e-9)
      errors.work_years = '最多保留一位小数';
  }

  return errors;
}

// 全量提交：10 个字段每次都传，没填的显式传 null（PUT 是整份覆盖）
function toPayload(form) {
  const city = CITY_OPTIONS.find((item) => item.code === form.expected_city_code);
  return {
    full_name: form.full_name.trim(),
    contact_phone: form.contact_phone.trim(),
    contact_email: form.contact_email.trim() || null,
    expected_city_code: city ? city.code : null,
    expected_city_name: city ? city.name : null,
    highest_education_level: Number(form.highest_education_level),
    school: form.school.trim() || null,
    graduation_year: form.graduation_year.trim() ? Number(form.graduation_year) : null,
    work_months: Math.round(Number(form.work_years) * 12),
    work_experience: form.work_experience.trim() || null,
    self_evaluation: form.self_evaluation.trim() || null,
  };
}

// MySQL 的 updated_at 写的是「本地墙上时间」，接口返回时被序列化成带 Z 的 ISO 串，
// 直接 new Date() 会再叠一次 +8；所以这里按 UTC 取各位数字，显示的才是用户当时的本地时间
function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export default function MyResume() {
  const { user } = useAuth();

  const [form, setForm] = useState(EMPTY_FORM);
  const [snapshot, setSnapshot] = useState(EMPTY_FORM); // 上次加载/保存的值，用来判断有没有改动
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [hasResume, setHasResume] = useState(false);

  const savedTimer = useRef(null);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');
    api
      .getMyResume()
      .then(({ resume }) => {
        if (!alive) return;
        const next = resumeToForm(resume);
        setForm(next);
        setSnapshot(next);
        setSavedAt(resume.updated_at);
        setHasResume(true);
      })
      .catch((err) => {
        if (!alive) return;
        if (err.status === 404) {
          // 还没填过：用登录账号的姓名、手机号预填，不算「有改动」
          const next = { ...EMPTY_FORM, full_name: user?.name || '', contact_phone: user?.phone || '' };
          setForm(next);
          setSnapshot(next);
          setHasResume(false);
        } else {
          setLoadError(err.message);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  useEffect(() => load(), [load]);

  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    []
  );

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(snapshot), [form, snapshot]);

  // 有未保存修改时：刷新/关标签页拦一下
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // 有未保存修改时：点站内链接（顶部导航、职位卡片）也拦一下
  useEffect(() => {
    if (!dirty) return undefined;
    const onClick = (e) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (link.target === '_blank' || /^https?:/i.test(href)) return;
      if (!window.confirm('有未保存的修改，确定离开？')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [dirty]);

  const update = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
    setJustSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner('');

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const { resume } = await api.saveMyResume(toPayload(form));
      const next = resumeToForm(resume);
      setForm(next);
      setSnapshot(next);
      setSavedAt(resume.updated_at);
      setHasResume(true);
      setJustSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      setBanner(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-16 text-center text-sm text-slate-400">加载中…</p>;

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{loadError}</p>
        <button
          onClick={load}
          className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm text-red-700 hover:bg-red-50"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-brown-800">我的简历</h1>
          <p className="mt-1 text-sm text-slate-500">
            {hasResume
              ? savedAt && `上次保存：${formatTime(savedAt)}`
              : '还没填过简历，填完点下面的「保存简历」'}
          </p>
        </div>
        {dirty && <span className="text-xs text-brand-700">有未保存的修改</span>}
      </div>

      {banner && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{banner}</p>
      )}

      <div className="space-y-4">
        <Card title="基本信息">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="姓名" required error={errors.full_name}>
              <input
                className={inputClass}
                value={form.full_name}
                onChange={update('full_name')}
                placeholder="真实姓名"
                maxLength={64}
              />
            </Field>

            <Field label="手机号" required error={errors.contact_phone}>
              <input
                className={inputClass}
                value={form.contact_phone}
                onChange={update('contact_phone')}
                placeholder="11 位手机号"
                maxLength={11}
                inputMode="numeric"
              />
            </Field>

            <Field label="邮箱" hint="选填" error={errors.contact_email}>
              <input
                className={inputClass}
                value={form.contact_email}
                onChange={update('contact_email')}
                placeholder="name@example.com"
                maxLength={255}
              />
            </Field>

            <Field label="期望城市" hint="选填">
              <select
                className={inputClass}
                value={form.expected_city_code}
                onChange={update('expected_city_code')}
              >
                <option value="">不限</option>
                {CITY_OPTIONS.map((city) => (
                  <option key={city.code} value={city.code}>
                    {city.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="最高学历" required error={errors.highest_education_level}>
              <select
                className={inputClass}
                value={form.highest_education_level}
                onChange={update('highest_education_level')}
              >
                <option value="">请选择</option>
                {EDU_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Card title="教育背景">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="学校" hint="选填" error={errors.school}>
                <input
                  className={inputClass}
                  value={form.school}
                  onChange={update('school')}
                  placeholder="如：上海交通大学"
                  maxLength={128}
                />
              </Field>
            </div>

            <Field label="毕业年份" hint="选填" error={errors.graduation_year}>
              <input
                className={inputClass}
                type="number"
                value={form.graduation_year}
                onChange={update('graduation_year')}
                placeholder="如：2024"
                min={1900}
                max={CURRENT_YEAR + 10}
              />
            </Field>
          </div>
        </Card>

        <Card title="工作经历">
          <div className="grid gap-4">
            <div className="sm:w-1/3">
              <Field
                label="工作年限"
                hint="按年填，如 2 年 6 个月填 2.5"
                required
                error={errors.work_years}
              >
                <input
                  className={inputClass}
                  type="number"
                  value={form.work_years}
                  onChange={update('work_years')}
                  placeholder="如：2"
                  min={0}
                  max={60}
                  step={0.5}
                />
              </Field>
            </div>

            <Field label="经历描述" hint="选填" error={errors.work_experience}>
              <textarea
                className={`${inputClass} resize-y`}
                rows={6}
                value={form.work_experience}
                onChange={update('work_experience')}
                placeholder="公司 / 职位 / 时间 / 做了什么，一行一段"
              />
            </Field>
          </div>
        </Card>

        <Card title="自我评价">
          <Field label="评价内容" hint="选填" error={errors.self_evaluation}>
            <textarea
              className={`${inputClass} resize-y`}
              rows={4}
              value={form.self_evaluation}
              onChange={update('self_evaluation')}
              placeholder="一段话介绍自己的优势即可"
            />
          </Field>
        </Card>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {justSaved && <span className="text-sm text-emerald-600">已保存</span>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存简历'}
        </button>
      </div>

      <p className="mt-3 text-right text-xs text-slate-400">
        保存时会整份更新，清空的项会存为空
      </p>
    </form>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-brown-800">{title}</h2>
      {children}
    </section>
  );
}
