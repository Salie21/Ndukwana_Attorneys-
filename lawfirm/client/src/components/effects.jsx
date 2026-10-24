import { useEffect, useRef, useState } from 'react';

// Small, dependency-free versions of the SmoothUI effects (fluid hover highlight, tilt card, reveal on scroll).
// The project uses plain CSS rather than Tailwind, so these are written for it directly.

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// A highlight pill that glides to whichever item the mouse (or keyboard focus) is on.
// Wrap a list of links/buttons; items matching `itemSelector` get the pill.
export function FluidHighlight({ as: Tag = 'div', itemSelector = 'a, button.nav-item', className = '', children, ...rest }) {
  const host = useRef(null);
  const [box, setBox] = useState(null);

  const move = (e) => {
    if (reducedMotion()) return;
    const el = e.target.closest?.(itemSelector);
    if (!el || !host.current?.contains(el)) return;
    const h = host.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setBox({ x: r.left - h.left, y: r.top - h.top + host.current.scrollTop, w: r.width, h: r.height });
  };
  const hide = () => setBox(null);

  return (
    <Tag ref={host} className={`fluid ${className}`} onMouseOver={move} onFocus={move} onMouseLeave={hide} onBlur={hide} {...rest}>
      <span className={`fluid-pill ${box ? 'on' : ''}`} aria-hidden="true" style={box ? { transform: `translate(${box.x}px, ${box.y}px)`, width: box.w, height: box.h } : undefined} />
      {children}
    </Tag>
  );
}

// Card that tilts toward the pointer. Does nothing on touch screens or when reduced motion is on.
export function TiltCard({ as: Tag = 'div', max = 7, className = '', children, ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!canHover() || reducedMotion() || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transition = 'transform .08s ease-out, border-color .2s, box-shadow .2s';
    ref.current.style.transform = `perspective(800px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-3px)`;
  };
  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.transition = '';
    ref.current.style.transform = '';
  };
  return <Tag ref={ref} className={`tilt ${className}`} onMouseMove={onMove} onMouseLeave={onLeave} {...rest}>{children}</Tag>;
}

// Fades and lifts its content in when it scrolls into view. `delay` (ms) staggers siblings.
export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined' || reducedMotion());
  useEffect(() => {
    if (shown || !ref.current) return undefined;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return <Tag ref={ref} className={`reveal ${shown ? 'is-in' : ''} ${className}`} style={{ transitionDelay: shown ? `${delay}ms` : '0ms' }} {...rest}>{children}</Tag>;
}
