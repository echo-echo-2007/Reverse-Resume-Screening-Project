import { useEffect, useRef, useState } from 'react';

/**
 * 自绘下拉选择器。
 *
 * 为什么不用原生 <select>：原生弹出层由浏览器绘制，位置不受页面 CSS 控制，
 * 在缩放/内嵌预览下会出现错位，个别情况下还会带着页面一起滚动。
 * 这里改成绝对定位的自绘面板——面板挂在按钮正下方，不占文档流，
 * 所以展开/收起都不会推动下方列表，也不会改变滚动位置。
 */
export default function SelectMenu({
  value,
  options,
  onChange,
  label,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const current = options[selectedIndex >= 0 ? selectedIndex : 0];

  // 展开时把高亮落在当前选中项上
  useEffect(() => {
    if (open) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  // 点外面 / 按 Esc / 页面滚动 时收起
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onScroll = () => setOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, [open]);

  // 键盘上下移动时只滚面板自身，不碰页面滚动
  const scrollIntoPanel = (index) => {
    const list = listRef.current;
    const item = list?.children[index];
    if (!list || !item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  };

  const pick = (index) => {
    const opt = options[index];
    setOpen(false);
    if (opt && opt.value !== value) onChange(opt.value);
    btnRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (e) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.min(i + 1, options.length - 1);
          scrollIntoPanel(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => {
          const next = Math.max(i - 1, 0);
          scrollIntoPanel(next);
          return next;
        });
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        scrollIntoPanel(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        scrollIntoPanel(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        pick(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
        break;
    }
  };

  const isActive = value !== '';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm outline-none transition ${
          isActive
            ? 'border-brand-300 bg-brand-50/60 font-medium text-brand-800'
            : 'border-slate-200 bg-white text-slate-700 hover:border-brand-200'
        } ${open ? 'border-brand-400 ring-2 ring-brand-100' : ''} ${
          disabled ? 'cursor-not-allowed opacity-60' : ''
        }`}
      >
        <span className="truncate">{current?.label ?? ''}</span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <path
            d="M5.5 8l4.5 4.5L14.5 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-[min(21rem,55vh)] w-full min-w-max overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-200/70"
        >
          {options.map((opt, i) => {
            const selected = opt.value === value;
            const highlighted = i === activeIndex;
            return (
              <li
                key={opt.value || 'all'}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                  selected
                    ? 'bg-brand-50 font-medium text-brand-800'
                    : highlighted
                      ? 'bg-slate-50 text-slate-800'
                      : 'text-slate-600'
                }`}
              >
                <span className="whitespace-nowrap">{opt.label}</span>
                {selected && (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-brand-600">
                    <path
                      d="M4.5 10.5l3.5 3.5 7-8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
