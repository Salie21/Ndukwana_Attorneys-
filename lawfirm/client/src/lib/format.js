const TZ = 'Africa/Johannesburg';
const toDate = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);
export const fmtDateTime = (v) => { const d = toDate(v); return d ? d.toLocaleString('en-ZA', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' }) : ''; };
export const fmtDate = (v) => { const d = toDate(v); return d ? d.toLocaleDateString('en-ZA', { timeZone: TZ, dateStyle: 'medium' }) : ''; };
export const fmtTime = (v) => { const d = toDate(v); return d ? d.toLocaleTimeString('en-ZA', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : ''; };
export const millis = (v) => toDate(v)?.getTime() ?? 0;
export const ago = (v) => {
  const d = toDate(v); if (!d) return '';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`; return fmtDate(d);
};
export const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
// Resize an image in the browser to a small square JPEG data URL (stored on the profile).
export function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Choose a JPG, PNG or WebP image.'));
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read.')); };
    img.src = url;
  });
}
