import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import { initials } from '../lib/format';

export function Avatar({ src, name, size = 38 }) {
  return src ? <img className="avatar" style={{ '--s': `${size}px` }} src={src} alt="" /> : <span className="avatar" style={{ '--s': `${size}px` }} aria-hidden="true">{initials(name)}</span>;
}
export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;
export const Loading = () => <div className="empty"><Spinner /></div>;
export const Status = ({ value }) => <span className={`badge ${value}`}><span>{String(value).replace('_', ' ')}</span></span>;
export const Empty = ({ title, children }) => <div className="empty"><h4>{title}</h4>{children && <p>{children}</p>}</div>;

export function PasswordField({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input {...props} className={`input ${className}`} type={visible ? 'text' : 'password'} />
      <button className="password-toggle" type="button" onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function Modal({ title, onClose, children, className = '' }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="card-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, kind = 'ok') => {
    const id = crypto.randomUUID();
    setItems((l) => [...l, { id, text, kind }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}

// Run an async action with a busy flag and toast on error.
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) toast(okMsg); return r ?? true; }
    catch (e) { toast(e.message, 'bad'); return false; }
    finally { setBusy(false); }
  }, [toast]);
  return [run, busy];
}
