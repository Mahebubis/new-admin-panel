// supportUtils.js — plain helpers shared by the Support queue, chat and file viewer.
import toast from 'react-hot-toast';

const EXT = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'm4v', 'ogv'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'oga'],
  pdf: ['pdf'],
  sheet: ['csv', 'tsv'],
  office: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  text: ['txt', 'log', 'json', 'md', 'xml'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz'],
};

export const extOf = (name = '') => {
  const s = String(name).split('?')[0];
  return s.includes('.') ? s.split('.').pop().toLowerCase() : '';
};

/** image | video | audio | pdf | sheet | office | text | archive | other */
export function fileKind(name = '', type = '') {
  const e = extOf(name);
  for (const [k, list] of Object.entries(EXT)) if (list.includes(e)) return k;
  const t = String(type);
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  if (t === 'application/pdf') return 'pdf';
  return 'other';
}

export function fileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}


export const BUCKET = {
  open: { label: 'Opened', tone: 'amber' },
  pending: { label: 'Pending', tone: 'blue' },
  closed: { label: 'Closed', tone: 'grey' },
};
export const bucketOf = (status) => (status === 'pending' || status === 'closed' ? status : 'open');

const parseDate = (d) => (d ? new Date(String(d).replace(' ', 'T')) : null);
export const fullStamp = (d) => parseDate(d)?.toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) || '—';


export async function copyText(text, what = 'Copied') {
  const s = String(text ?? '');
  if (!s) return;
  try {
    await navigator.clipboard.writeText(s);
  } catch {
    /* http:// pages have no async clipboard — the old way still works. */
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* nothing left to try */ }
    ta.remove();
  }
  toast.success(what);
}

