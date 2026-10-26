import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

// A fully styled dropdown that replaces the browser's native <select>, so every list looks the same
// on every phone and computer, in light and dark mode. It works with keyboards and screen readers.
//
//   <Select value={v} onChange={setV} options={[{ value: 'a', label: 'Apple' }]} />      controlled
//   <Select name="role" defaultValue="staff" options={...} />                              inside a <form> (posts via FormData)
//
// variant: 'field' (default, full width) | 'auto' (shrinks to its content, for filters) | 'pill' (header language picker)
export default function Select({
  options, value, defaultValue = '', onChange, name, id, placeholder = '', disabled = false, required = false,
  variant = 'field', className = '', minMenuWidth = 0, ...aria
}) {
  const uid = useId();
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = controlled ? value : inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const menu = useRef(null);
  const typed = useRef({ text: '', at: 0 });

  const selectedIndex = options.findIndex((o) => String(o.value) === String(current));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const place = useCallback(() => {
    const b = btn.current; if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth; const vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, minMenuWidth), vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const below = vh - r.bottom - 12; const above = r.top - 12;
    const up = below < 200 && above > below;
    const maxHeight = Math.max(120, Math.min(320, up ? above : below));
    setPos(up ? { left, width, bottom: vh - r.top + 6, maxHeight } : { left, width, top: r.bottom + 6, maxHeight });
  }, [minMenuWidth]);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!btn.current?.contains(e.target) && !menu.current?.contains(e.target)) setOpen(false); };
    const onMove = (e) => { if (!menu.current?.contains(e.target)) place(); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onMove, true);
    return () => { document.removeEventListener('pointerdown', onDown); window.removeEventListener('resize', place); window.removeEventListener('scroll', onMove, true); };
  }, [open, place]);

  // Keep the highlighted option in view while using the arrow keys.
  useEffect(() => { if (open && active >= 0) menu.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [open, active]);

  const openMenu = () => { if (disabled) return; setActive(selectedIndex >= 0 ? selectedIndex : 0); setOpen(true); };
  const choose = (i) => {
    const o = options[i]; if (!o || o.disabled) return;
    if (!controlled) setInner(o.value);
    onChange?.(o.value, o);
    setOpen(false); btn.current?.focus({ preventScroll: true });
  };
  const step = (dir) => { const n = options.length; if (!n) return; let i = active; for (let k = 0; k < n; k++) { i = (i + dir + n) % n; if (!options[i].disabled) break; } setActive(i); };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { // type a few letters to jump to an option
      const now = Date.now(); const t = typed.current;
      t.text = now - t.at > 700 ? e.key.toLowerCase() : t.text + e.key.toLowerCase(); t.at = now;
      const hit = options.findIndex((o) => String(o.label).toLowerCase().startsWith(t.text));
      if (hit >= 0) setActive(hit);
    }
  };

  const listId = `${uid}-list`;
  return (
    <div className={`sel ${variant} ${className}`}>
      {name && <input type="hidden" name={name} value={current ?? ''} />}
      <button
        ref={btn} type="button" id={id} className="sel-btn" disabled={disabled}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${uid}-o${active}` : undefined} aria-required={required || undefined}
        onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKeyDown} {...aria}
      >
        <span className={`sel-text ${selected ? '' : 'ph'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="sel-chev" aria-hidden="true" />
      </button>
      {open && pos && createPortal(
        <div ref={menu} id={listId} role="listbox" className="sel-pop" data-theme-scope style={{ ...pos }}>
          {options.length === 0 && <div className="sel-empty">—</div>}
          {options.map((o, i) => (
            <div
              key={`${o.value}-${i}`} id={`${uid}-o${i}`} data-i={i} role="option" aria-selected={i === selectedIndex} aria-disabled={o.disabled || undefined}
              lang={o.lang} className={`sel-opt ${i === active ? 'active' : ''} ${i === selectedIndex ? 'sel-on' : ''}`}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}
            >
              <span>{o.label}</span>{i === selectedIndex && <Check size={15} aria-hidden="true" />}
            </div>
          ))}
        </div>, document.body,
      )}
    </div>
  );
}
