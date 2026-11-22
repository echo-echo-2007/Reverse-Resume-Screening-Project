// 职位表单：新建 / 编辑共用（有 :id 就是编辑）
// 骨架阶段只做「填完能存」，字段级校验和离开提示留 TODO

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import Field, { inputClass } from '../../components/Field.jsx';
import SelectMenu from '../../components/SelectMenu.jsx';
import { CITY_OPTIONS, EDU_OPTIONS } from '../../constants.js';

const CITY_FIELD = [
  { value: '', label: '城市不限' },
  ...CITY_OPTIONS.map((city) => ({ value: city.code, label: city.name })),
];
// 职位侧可以要求「不限」，所以比简历多一个 0
const EDU_FIELD = [
  { value: '0', label: '学历不限' },
  ...EDU_OPTIONS.map((item) => ({ value: String(item.value), label: `${item.label}及以上` })),
];

const emptyForm = {
  title: '',
  department: '',
  city_code: '',
  min_education_level: '0',
  min_experience_years: '',
  salary_min: '',
  salary_max: '',
  description: '',
  requirements: '',
};

export default function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const update = (key) => (e) => {
    setValue(key, e.target.value);
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  useEffect(() => {
    if (!isEdit) return;
    let alive = true;

    api
      .getJob(id)
      .then(({ job }) => {
        if (!alive) return;
        // 薪资存元、界面填 K；经验存月、界面填年
        setForm({
          title: job.title || '',
          department: job.department || '',
          city_code: job.city_code || '',
          min_education_level: String(job.min_education_level ?? 0),
          min_experience_years: job.min_experience_months ? String(job.min_experience_months / 12) : '',
          salary_min: job.salary_min ? String(job.salary_min / 1000) : '',
          salary_max: job.salary_max ? String(job.salary_max / 1000) : '',
          description: job.description || '',
          requirements: job.requirements || '',
        });
      })
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [id, isEdit]);

  // 字段级校验：只在提交时跑，避免用户刚开始填就飘红
  const validate = () => {
    const next = {};
    const num = (v) => (String(v).trim() === '' ? null : Number(v));

    if (!form.title.trim()) next.title = '请填写职位名称';
    if (form.department.trim().length > 64) next.department = '部门名称不超过 64 字';

    const salaryMin = num(form.salary_min);
    const salaryMax = num(form.salary_max);
    if (salaryMin !== null && (!Number.isFinite(salaryMin) || salaryMin < 0 || salaryMin > 1000)) {
      next.salary_min = '请填 0-1000 之间的月薪（单位 K）';
    }
    if (salaryMax !== null && (!Number.isFinite(salaryMax) || salaryMax < 0 || salaryMax > 1000)) {
      next.salary_max = '请填 0-1000 之间的月薪（单位 K）';
    }
    if (
      salaryMin !== null &&
      salaryMax !== null &&
      !next.salary_min &&
      !next.salary_max &&
      salaryMax < salaryMin
    ) {
      next.salary_max = '上限不能低于下限';
    }

    const years = num(form.min_experience_years);
    if (years !== null && (!Number.isFinite(years) || years < 0 || years > 60)) {
      next.min_experience_years = '经验需在 0-60 年之间';
    }

    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      // 把第一个出错的字段带到视口中间，方便直接改
      const first = ['title', 'department', 'salary_min', 'salary_max', 'min_experience_years'].find(
        (key) => fieldErrors[key]
      );
      if (first) document.getElementById(`job-${first}`)?.scrollIntoView({ block: 'center' });
      return;
    }

    const city = CITY_OPTIONS.find((c) => c.code === form.city_code);
    const payload = {
      title: form.title.trim(),
      department: form.department.trim() || null,
      city_code: form.city_code || null,
      city_name: city ? city.name : null,
      min_education_level: Number(form.min_education_level || 0),
      min_experience_months: Math.round(Number(form.min_experience_years || 0) * 12),
      salary_min: Math.round(Number(form.salary_min || 0) * 1000),
      salary_max: Math.round(Number(form.salary_max || 0) * 1000),
      description: form.description.trim() || null,
      requirements: form.requirements.trim() || null,
    };

    setSaving(true);
    try {
      if (isEdit) await api.updateJob(id, payload);
      else await api.createJob(payload);
      // 回工作台时带一条提示，列表会顺手刷新
      navigate('/hr', { state: { notice: isEdit ? '职位已更新' : '职位已发布，求职者现在就能看到' } });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-400">加载职位信息…</div>;
  }

  return (
    // noValidate：关闭浏览器原生校验（type=number 的 max 会先弹原生气泡，onSubmit 不触发），
    // 统一由 validate() 输出中文文案
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/hr" className="text-sm text-slate-500 hover:text-brand-700">
            ← 返回工作台
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {isEdit ? '编辑职位' : '新建职位'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/hr"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? '保存中…' : isEdit ? '保存修改' : '发布职位'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 区块 1：基本信息 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">基本信息</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="职位名称" required error={errors.title}>
            <input
              id="job-title"
              className={inputClass}
              value={form.title}
              onChange={update('title')}
              placeholder="如：前端开发工程师"
              maxLength={128}
            />
          </Field>
          <Field label="所属部门" hint="选填" error={errors.department}>
            <input
              id="job-department"
              className={inputClass}
              value={form.department}
              onChange={update('department')}
              placeholder="如：技术部"
              maxLength={64}
            />
          </Field>
          <Field label="工作城市" as="div">
            <SelectMenu
              label="工作城市"
              variant="field"
              value={form.city_code}
              options={CITY_FIELD}
              onChange={(v) => setValue('city_code', v)}
            />
          </Field>
          <Field label="经验要求" hint="填年，0 表示不限" error={errors.min_experience_years}>
            <input
              id="job-min_experience_years"
              type="number"
              min="0"
              max="60"
              step="0.5"
              className={inputClass}
              value={form.min_experience_years}
              onChange={update('min_experience_years')}
              placeholder="如：3"
            />
          </Field>
        </div>
      </section>

      {/* 区块 2：硬条件 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <h2 className="mb-1 text-sm font-semibold text-slate-800">硬条件</h2>
        <p className="mb-4 text-xs text-slate-400">
          学历、经验、城市三项用于自动初筛：求职者投递时由系统判定，不满足的直接过滤，不会出现在投递管理里
        </p>
        {isEdit && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            注意：修改只影响之后投递的人，已经在流程里的投递不会被重新判定。
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="最低学历" as="div">
            <SelectMenu
              label="最低学历"
              variant="field"
              value={form.min_education_level}
              options={EDU_FIELD}
              onChange={(v) => setValue('min_education_level', v)}
            />
          </Field>
          <Field label="薪资下限" hint="单位 K" error={errors.salary_min}>
            <input
              id="job-salary_min"
              type="number"
              min="0"
              step="0.5"
              className={inputClass}
              value={form.salary_min}
              onChange={update('salary_min')}
              placeholder="如：15"
            />
          </Field>
          <Field label="薪资上限" hint="单位 K" error={errors.salary_max}>
            <input
              id="job-salary_max"
              type="number"
              min="0"
              step="0.5"
              className={inputClass}
              value={form.salary_max}
              onChange={update('salary_max')}
              placeholder="如：25"
            />
          </Field>
        </div>
      </section>

      {/* 区块 3：职位描述 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">职位内容</h2>
        <div className="space-y-4">
          <Field label="职位描述" hint="选填">
            <textarea
              rows={6}
              className={inputClass}
              value={form.description}
              onChange={update('description')}
              placeholder="工作内容、团队情况、福利等"
            />
          </Field>
          <Field label="任职要求" hint="选填">
            <textarea
              rows={5}
              className={inputClass}
              value={form.requirements}
              onChange={update('requirements')}
              placeholder="技能要求、加分项等"
            />
          </Field>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        V1 保存即发布，暂不支持草稿与暂停。
        {/* TODO: 未保存离开提示、编辑时提示「改硬条件不影响已初筛的投递」 */}
      </p>
    </form>
  );
}
