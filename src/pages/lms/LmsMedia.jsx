// ===========================================================================
//  LmsMedia.jsx — the two media pickers the LMS uses.
//
//    <ThumbnailPicker>  course artwork: upload to S3, or paste a URL
//    <VideoPicker>      lesson video:   upload to S3, or embed Vimeo / Bunny
//                                       Stream, or point at a direct file
//
//  Both show a live preview of whatever is currently set, because "did that
//  actually work?" is the only question an admin has after picking media, and
//  a bare URL in a text box does not answer it.
//
//  Uploading to S3 always asks first. It is the one action here that costs
//  money, cannot be undone from this screen, and can take minutes on a large
//  file — so it gets a confirm step, while pasting a URL (free, instant,
//  reversible) does not.
// ===========================================================================
import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  UploadCloud, Link2, Image as ImageIcon, PlayCircle, X, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Confirm } from './LmsStyles';
import { detectVideo, unwrapIframe } from './lmsVideoSource';

const fmtBytes = (b) => {
  const n = Number(b) || 0;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 100 * 1024 * 1024 ? 1 : 0)} MB`;
};

/* ═════════════════════════ thumbnail ═════════════════════════ */
export function ThumbnailPicker({ url, onUpload, onUrlChange, busy = false, hint }) {
  const fileInput = useRef(null);
  const [mode, setMode] = useState('upload');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(null);   // the file awaiting confirmation
  const [broken, setBroken] = useState(false);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Pick an image file');
    if (file.size > 8 * 1024 * 1024) return toast.error('Images must be under 8 MB');
    setPending(file);
  };

  const applyUrl = () => {
    const v = draft.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) return toast.error('Enter a full URL starting with https://');
    setBroken(false);
    onUrlChange(v);
    setDraft('');
  };

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={pick} />

      <div className="lms-media">
        <div className="lms-media-frame" style={{ background: url && !broken ? '#101828' : 'var(--lms-bg-soft)' }}>
          {url && !broken ? (
            <img src={url} alt="Course thumbnail" onError={() => setBroken(true)} />
          ) : (
            <div className="lms-media-empty">
              <ImageIcon size={26} />
              {broken ? 'That image URL did not load' : 'No thumbnail yet'}
            </div>
          )}
        </div>

        <div className="lms-media-bar">
          <button type="button" className="lms-btn lms-btn-ghost lms-btn-sm"
            onClick={() => fileInput.current?.click()} disabled={busy}>
            <UploadCloud size={14} /> {busy ? 'Uploading…' : url ? 'Replace' : 'Upload image'}
          </button>
          <button type="button" className={`lms-btn lms-btn-sm ${mode === 'url' ? 'lms-btn-ghost' : 'lms-btn-quiet'}`}
            onClick={() => setMode(m => (m === 'url' ? 'upload' : 'url'))}>
            <Link2 size={14} /> Use a URL
          </button>
          {url && (
            <button type="button" className="lms-btn lms-btn-quiet lms-btn-sm"
              onClick={() => { setBroken(false); onUrlChange(''); }} disabled={busy}>
              <X size={14} /> Remove
            </button>
          )}
          <span className="lms-media-name">{url || hint || ''}</span>
        </div>
      </div>

      {mode === 'url' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            className="lms-input"
            placeholder="https://example.com/course-cover.jpg"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyUrl())}
          />
          <button type="button" className="lms-btn lms-btn-dark" onClick={applyUrl} disabled={!draft.trim()}>
            Use
          </button>
        </div>
      )}

      <Confirm
        open={!!pending}
        danger={false}
        title="Upload this image to S3?"
        confirmLabel="Upload"
        message={pending
          ? `"${pending.name}" (${fmtBytes(pending.size)}) will be uploaded to your S3 bucket and stored permanently. If you already host this image somewhere, paste its URL instead — that costs nothing.`
          : ''}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const file = pending;
          setPending(null);
          setBroken(false);
          await onUpload(file);
        }}
      />
    </>
  );
}

/* ═════════════════════════ lesson video ═════════════════════════ */

/* S3 upload is deliberately locked. The tab stays visible so it is obvious
   the capability exists (and so an already-uploaded S3 video still reads as
   "this came from S3"), but nothing new should go into the bucket: every play
   of an S3 file is billed to us, while Vimeo and Bunny do transcoding and
   delivery on their own plans. Flip `locked` to re-open it. */
const SOURCES = [
  { key: 'upload', label: 'Upload to S3', locked: true },
  { key: 'vimeo', label: 'Vimeo' },
  { key: 'bunny', label: 'Bunny Stream' },
  { key: 'url', label: 'Direct URL' },
];

const PLACEHOLDER = {
  vimeo: 'Paste the Vimeo link or its embed code here',
  bunny: 'Paste the Bunny Stream link or its embed code here',
  url: 'Paste a direct link to the video file',
};

/* Written for someone who has never heard the phrase "embed code": say what
   to click in the other product, not what the string is called. */
const HELP = {
  vimeo: 'Open the video on Vimeo, click Share, and copy either the link (vimeo.com/534539046) or the whole Embed box that starts with <iframe. Both work — we pull the video out for you.',
  bunny: 'In Bunny Stream open the video, click Embed / Share, and copy either the iframe code or the link inside it (iframe.mediadelivery.net/embed/…). Either one is fine.',
  url: 'A link that ends in .mp4, .mov, .webm or .m3u8 — the address of the video file itself, not the page it sits on. YouTube links work here too.',
};

export function VideoPicker({ url, provider, onChange, onUpload, uploading = false }) {
  const fileInput = useRef(null);
  const [pending, setPending] = useState(null);
  const detected = useMemo(() => detectVideo(url), [url]);

  /* Which tab opens is inferred from what is already set, so re-editing a
     lesson lands you on the source it actually uses. */
  /* Vimeo is the default landing tab. 'upload' is never chosen automatically
     — not even for a lesson whose video already lives on S3 — because that tab
     cannot be clicked, and opening on a tab you cannot leave and cannot use is
     a dead end. The existing video still shows in the preview above either way. */
  const [source, setSource] = useState(() => {
    if (detected.kind === 'bunny') return 'bunny';
    if (detected.kind === 'vimeo') return 'vimeo';
    if (url && provider !== 's3') return 'url';
    return 'vimeo';
  });

  const [draft, setDraft] = useState('');

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) return toast.error('Pick a video file');
    setPending(file);
  };

  const applyUrl = () => {
    const v = unwrapIframe(draft).trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) return toast.error('Enter a full URL starting with https://');

    const kind = detectVideo(v).kind;
    /* A gentle nudge, not a block: an admin who really wants a Vimeo link on
       the Bunny tab still gets it, because the player sniffs the URL anyway. */
    if (source === 'vimeo' && kind !== 'vimeo') toast('That does not look like a Vimeo link — saving it anyway.');
    if (source === 'bunny' && kind !== 'bunny') toast('That does not look like a Bunny Stream embed — saving it anyway.');

    onChange({ video_url: v, video_provider: source === 'upload' ? 'url' : source });
    setDraft('');
  };

  const clear = () => onChange({ video_url: '', video_provider: 'url' });

  return (
    <>
      <input ref={fileInput} type="file" accept="video/*" hidden onChange={pick} />

      <div className="lms-seg" style={{ marginBottom: 14 }}>
        {SOURCES.map(s => (
          <button
            key={s.key}
            type="button"
            className={`${source === s.key ? 'on' : ''}${s.locked ? ' locked' : ''}`}
            disabled={s.locked}
            title={s.locked ? 'Uploading to S3 is turned off — use Vimeo or Bunny Stream' : undefined}
            onClick={() => !s.locked && setSource(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="lms-media" style={{ marginBottom: 14 }}>
        <div className="lms-media-frame">
          {detected.kind === 'none' && (
            <div className="lms-media-empty" style={{ color: '#98a1ae' }}>
              <PlayCircle size={30} />
              No video attached yet
            </div>
          )}

          {(detected.kind === 'file' || detected.kind === 'hls') && (
            /* HLS will not play natively outside Safari — the learner portal
               loads hls.js for it, and this preview says so rather than
               showing a silently dead player. */
            detected.kind === 'hls'
              ? <div className="lms-media-empty" style={{ color: '#98a1ae' }}>
                  <PlayCircle size={30} />
                  HLS stream — plays in the learner portal, no preview here
                </div>
              : <video src={url} controls preload="metadata" />
          )}

          {/* The embed URL is checked twice on purpose. An <iframe> whose src is
              empty or same-origin loads the admin panel INSIDE this box — you
              end up staring at a shrunken copy of the control panel where the
              video should be. detectVideo() already refuses to hand one over;
              this guard makes it impossible to render one by accident. */}
          {['vimeo', 'bunny', 'youtube', 'iframe'].includes(detected.kind) && !!detected.embed && (
            <iframe
              src={detected.embed}
              title="Lesson video preview"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          )}

          {(detected.kind === 'unknown' || (!detected.embed && ['vimeo', 'bunny', 'youtube', 'iframe'].includes(detected.kind))) && (
            <div className="lms-media-empty" style={{ color: '#98a1ae' }}>
              <AlertTriangle size={26} />
              <div style={{ maxWidth: 340 }}>
                <b style={{ display: 'block', color: '#d0d5dd', marginBottom: 4 }}>This link can’t be previewed</b>
                It is not a Vimeo, Bunny Stream, YouTube or direct video link. The link is still
                saved — replace it below if the learner should see a player here.
              </div>
            </div>
          )}
        </div>

        {url && (
          <div className="lms-media-bar">
            <span className="lms-pill grey">{provider === 's3' ? 'S3' : detected.kind}</span>
            <span className="lms-media-name">{url}</span>
            <a className="lms-btn lms-btn-quiet lms-btn-sm" href={url} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Open
            </a>
            <button type="button" className="lms-btn lms-btn-quiet lms-btn-sm" onClick={clear} disabled={uploading}>
              <X size={14} /> Remove
            </button>
          </div>
        )}
      </div>

      {source === 'upload' ? (
        <>
          <button type="button" className="lms-dropzone" style={{ width: '100%' }}
            onClick={() => fileInput.current?.click()} disabled={uploading}>
            <UploadCloud size={22} color="var(--lms-text-3)" />
            <div className="t">{uploading ? 'Uploading…' : url && provider === 's3' ? 'Replace the uploaded video' : 'Choose a video file'}</div>
            <div className="s">MP4 / MOV / WebM — stored in your S3 bucket</div>
          </button>

          <div className="lms-warn" style={{ marginTop: 12 }}>
            <AlertTriangle size={16} className="lms-warn-ico" />
            <div className="lms-warn-body">
              <b>Uploading here costs storage and bandwidth</b>
              Every play streams from S3 and is billed to your AWS account. If the video already lives on
              Vimeo or Bunny Stream, use those tabs instead — they handle transcoding and delivery for you.
              You will be asked to confirm before anything is uploaded.
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="lms-input"
              placeholder={PLACEHOLDER[source]}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyUrl())}
            />
            <button type="button" className="lms-btn lms-btn-dark" onClick={applyUrl} disabled={!draft.trim()}>
              Attach
            </button>
          </div>
          <p className="lms-help" style={{ marginTop: 8 }}>{HELP[source]}</p>
        </>
      )}

      <Confirm
        open={!!pending}
        danger={false}
        title="Upload this video to S3?"
        confirmLabel="Upload to S3"
        message={pending
          ? `"${pending.name}" (${fmtBytes(pending.size)}) will be uploaded to your S3 bucket. Large files take a while and the tab must stay open until it finishes. Storage and every learner's playback are billed to your AWS account — a Vimeo or Bunny Stream embed avoids both.`
          : ''}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          const file = pending;
          setPending(null);
          await onUpload(file);
        }}
      />
    </>
  );
}
