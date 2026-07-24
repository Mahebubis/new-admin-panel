/* Personalization tokens available in the campaign builder — mirrors the site-wide
   XX_..._XX convention already used by src/pages/communication/EmailTemplates.jsx's
   TinyMCE mergetags plugin, scoped to the 5 person-identity tags that are actually
   resolvable in a generic campaign context (server-side substitution lives in
   public/react-api/api/campaigns/lib/MergeTags.php). */
export const IDENTITY_MERGE_TAGS = [
  { value: 'XX_USER_FNAME_XX', title: 'First Name' },
  { value: 'XX_USER_LNAME_XX', title: 'Last Name' },
  { value: 'XX_USER_NAME_XX',  title: 'Full Name' },
  { value: 'XX_USER_EMAIL_XX', title: 'Email' },
  { value: 'XX_USER_PHONE_XX', title: 'Mobile' },
];

/* Only populated when the campaign has an "Exam" picked in the Content step (draft.exam_cit_version)
   AND the recipient actually attempted that specific exam — otherwise these render blank.
   Server-side lookup: public/react-api/api/campaigns/lib/MergeTags.php's resolve_exam_data(). */
export const EXAM_MERGE_TAGS = [
  { value: 'XX_EXAM_NAME_XX',       title: 'Exam Name' },
  { value: 'XX_EXAM_SCORE_XX',      title: 'Exam Score' },
  { value: 'XX_EXAM_PERCENTAGE_XX', title: 'Exam Percentage' },
  { value: 'XX_EXAM_RANK_XX',       title: 'Exam Rank' },
  { value: 'XX_EXAM_STATUS_XX',     title: 'Exam Status (Pass/Fail)' },
  { value: 'XX_EXAM_DATE_XX',       title: 'Exam Date' },
];

/** Splices `token` into `value` at the input's current cursor position, then
 *  restores focus/cursor just after the inserted token. Popover stays open so
 *  multiple attributes can be chained in one field. */
export function insertTokenAtCursor(inputEl, token, value, setValue) {
  const start = inputEl?.selectionStart ?? value.length;
  const end   = inputEl?.selectionEnd ?? value.length;
  const next  = value.slice(0, start) + token + value.slice(end);
  setValue(next);
  requestAnimationFrame(() => {
    if (!inputEl) return;
    const pos = start + token.length;
    inputEl.focus();
    inputEl.setSelectionRange(pos, pos);
  });
}
