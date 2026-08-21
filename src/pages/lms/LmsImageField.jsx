// ===========================================================================
//  LmsImageField.jsx — "attach an image" for a quiz question or one of its
//  options.
//
//  Uploads straight to S3 through the editor endpoint that already exists
//  (resource=editor&action=upload_image), so there is no second storage path
//  to keep in step with the rest of the LMS: the same bucket, the same
//  lms/editor prefix, the same public URL shape a TinyMCE image gets.
//
//  Only the URL is stored — on a question that is lms_quiz_questions.image_url,
//  on an option it is an `image` key inside the options JSON. Neither needs a
//  schema change, which is why option images work on a table nobody migrated.
// ===========================================================================
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { LMS } from './lmsApi';

const MAX_MB = 5;

export default function LmsImageField({ value = '', onChange, compact = false, label = 'Add image' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    /* Clear immediately: without this, re-picking the same file after a
       failed upload fires no change event at all. */
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) return toast.error('Pick an image file');
    if (file.size > MAX_MB * 1024 * 1024) return toast.error(`Images must be under ${MAX_MB} MB`);

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const d = await LMS.uploadEditorImage(fd);
      onChange?.(d.url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`lms-imgfield${compact ? ' compact' : ''}`}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={pick} />

      {value ? (
        <div className="lms-imgfield-preview">
          <img src={value} alt="" />
          <button
            type="button"
            className="lms-imgfield-x"
            title="Remove image"
            onClick={() => onChange?.('')}
          >
            <X size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`lms-btn lms-btn-ghost ${compact ? 'lms-btn-sm' : ''}`}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={compact ? label : undefined}
        >
          {busy ? <Loader2 size={compact ? 14 : 15} className="lms-spin" /> : <ImagePlus size={compact ? 14 : 15} />}
          {!compact && (busy ? 'Uploading…' : label)}
        </button>
      )}
    </div>
  );
}
