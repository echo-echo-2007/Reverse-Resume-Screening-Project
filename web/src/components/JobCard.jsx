import { Link } from 'react-router-dom';
import { EDU_LABEL, formatMonths, formatRelativeDay, formatSalary } from '../constants.js';

export default function JobCard({ job }) {
  const company = job.companies?.name || '未知企业';
  const industry = job.companies?.industry;

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 transition duration-150 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-100/70"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-base font-semibold text-brand-700 ring-1 ring-brand-100"
          aria-hidden="true"
        >
          {company.slice(0, 1)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-[15px] font-semibold text-brown-800 transition group-hover:text-brand-700">
              {job.title}
            </h3>
            <span className="shrink-0 text-base font-semibold text-brand-600">
              {formatSalary(job.salary_min, job.salary_max)}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500">
            <span className="truncate">{company}</span>
            {job.department && (
              <>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="truncate">{job.department}</span>
              </>
            )}
            {industry && (
              <span className="rounded bg-slate-50 px-1.5 py-0.5 text-xs text-slate-500 ring-1 ring-slate-100">
                {industry}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Tag tone="brand">{job.city_name || '城市不限'}</Tag>
            <Tag>{formatMonths(job.min_experience_months)}</Tag>
            <Tag>{job.min_education_level ? EDU_LABEL[job.min_education_level] || '学历不限' : '学历不限'}</Tag>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <span className="text-slate-400">{formatRelativeDay(job.created_at)}</span>
        <span className="flex items-center gap-1 text-brand-600 transition group-hover:gap-1.5">
          查看详情
          <span aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

function Tag({ children, tone = 'default' }) {
  const cls =
    tone === 'brand'
      ? 'bg-brand-50 text-brand-700 ring-brand-100'
      : 'bg-slate-50 text-slate-600 ring-slate-100';
  return <span className={`rounded-md px-2 py-1 text-xs ring-1 ${cls}`}>{children}</span>;
}
