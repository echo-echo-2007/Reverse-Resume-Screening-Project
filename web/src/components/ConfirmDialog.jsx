// 自绘确认弹窗。
//
// 为什么不用 window.confirm：原生弹窗由浏览器绘制，在受限 iframe（内置预览面板、
// 部分嵌入式 WebView）里会被直接忽略并返回 false，表现成「点了完全没反应」。
// 这里用普通 DOM 画一层，行为完全由我们控制，样式也能跟页面一致。

import { useEffect, useRef } from 'react';

const TONE = {
  brand: {
    bar: 'bg-brand-500',
    button: 'bg-brand-600 hover:bg-brand-700',
  },
  danger: {
    bar: 'bg-wine-600',
    button: 'bg-wine-700 hover:bg-wine-800',
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmText = '确定',
  cancelText = '取消',
  tone = 'brand',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    // 打开时把焦点放在次要按钮上：危险操作不适合让回车直接触发
    cancelRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        e.stopPropagation();
        onCancel();
      }
      // 只允许焦点在弹窗内部循环，避免 Tab 跑到背后的页面上
      if (e.key === 'Tab') {
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  const t = TONE[tone] || TONE.brand;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => !loading && onCancel()}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className={`h-1 w-full ${t.bar}`} />

        <div className="px-5 pb-1 pt-4">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
          )}
          {children}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            ref={cancelRef}
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium text-white transition disabled:opacity-60 ${t.button}`}
          >
            {loading ? '处理中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
