// 表单行：标签 + 控件 + 错误提示
export default function Field({ label, hint, error, required, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-brand-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100';
