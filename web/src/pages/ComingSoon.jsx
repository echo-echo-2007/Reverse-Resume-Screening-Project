import { Link } from 'react-router-dom';

// P2-P4 的页面占位：保证导航能点、不出现 404
export default function ComingSoon({ title, items }) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-brown-800">{title}</h1>
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="text-sm text-slate-500">这个页面还没做（下一阶段实现）</p>
        {items && (
          <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-slate-400">
            {items.map((item) => (
              <li key={item} className="flex gap-2">
                <span>·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/" className="mt-6 inline-block text-sm text-brand-700 underline">
          先去职位广场
        </Link>
      </div>
    </div>
  );
}
