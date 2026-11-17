import { useEffect, useState } from 'react';
import { api } from '../api.js';
import JobCard from '../components/JobCard.jsx';
import { CITY_OPTIONS, EDU_OPTIONS, EXP_OPTIONS } from '../constants.js';

const emptyFilters = { city_code: '', education: '', experience_months: '' };

export default function JobList() {
  const [filters, setFilters] = useState(emptyFilters);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .listJobs(filters)
      .then((data) => {
        if (alive) setJobs(data.jobs || []);
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
  }, [filters]);

  const update = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }));
  const hasFilter = Object.values(filters).some(Boolean);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-brown-800">职位广场</h1>
        <p className="mt-1 text-sm text-slate-500">共 {jobs.length} 个在招职位</p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <select className={selectClass} value={filters.city_code} onChange={update('city_code')}>
          <option value="">全部城市</option>
          {CITY_OPTIONS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>

        <select className={selectClass} value={filters.education} onChange={update('education')}>
          <option value="">学历不限</option>
          {EDU_OPTIONS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}及以上
            </option>
          ))}
        </select>

        <select className={selectClass} value={filters.experience_months} onChange={update('experience_months')}>
          <option value="">经验不限</option>
          {EXP_OPTIONS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={() => setFilters(emptyFilters)}
            className="text-sm text-slate-500 underline hover:text-brand-700"
          >
            清空筛选
          </button>
        )}
      </div>

      {loading && <p className="py-16 text-center text-sm text-slate-400">加载中…</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <p className="text-sm text-slate-500">没有符合条件的职位</p>
          {hasFilter && (
            <button onClick={() => setFilters(emptyFilters)} className="mt-2 text-sm text-slate-700 underline">
              清空筛选看看
            </button>
          )}
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition hover:border-brand-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-100';
