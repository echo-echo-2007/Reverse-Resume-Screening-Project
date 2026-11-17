import { Link } from 'react-router-dom';
import { formatMonths, formatSalary, EDU_LABEL } from '../constants.js';

export default function JobCard({ job }) {
  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-brown-800">{job.title}</h3>
          <p className="mt-1 truncate text-sm text-slate-500">
            {job.companies?.name || '未知企业'}
            {job.department ? ` · ${job.department}` : ''}
          </p>
        </div>
        <span className="shrink-0 text-base font-semibold text-brand-600">
          {formatSalary(job.salary_min, job.salary_max)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
        {job.city_name && <Tag>{job.city_name}</Tag>}
        <Tag>{formatMonths(job.min_experience_months)}</Tag>
        <Tag>{job.min_education_level ? EDU_LABEL[job.min_education_level] || '学历不限' : '学历不限'}</Tag>
      </div>
    </Link>
  );
}

function Tag({ children }) {
  return <span className="rounded-md bg-brand-50 px-2 py-1 text-brand-700">{children}</span>;
}
