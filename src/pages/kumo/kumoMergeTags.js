/*
 * Personalisation tokens for the Kumo campaign builder.
 *
 * Two families, deliberately different in shape so they read apart at a glance:
 *
 *   {{first_name}}   fixed identity tags, substituted by kumo_merge() in Mailer.php
 *   [COURSE]         attributes from Audience → Attributes, resolved at send time
 *                    by AttributeResolver.php (the same bracket syntax Netcore uses)
 *
 * Anything this file emits has to have a matching substitution on the server, or
 * the raw token reaches the inbox.
 */

export const IDENTITY_TAGS = [
  { value: '{{first_name}}', title: 'First name' },
  { value: '{{last_name}}', title: 'Last name' },
  { value: '{{full_name}}', title: 'Full name' },
  { value: '{{email}}', title: 'Email' },
  { value: '{{unsubscribe_url}}', title: 'Unsubscribe link' },
];

/** campaign_attributes / kumo_attributes rows → {value, title} for the picker. */
export function buildAttributeTags(attributes) {
  return (attributes || [])
    .filter((a) => a && a.name)
    .map((a) => ({ value: `[${a.name}]`, title: String(a.name).replace(/_/g, ' '), raw: a.name }));
}

/**
 * Splices `token` in at the input's cursor, then puts the caret just after it so
 * a second attribute can be added without re-clicking into the field.
 */
export function insertTokenAtCursor(inputEl, token, value, setValue) {
  const start = inputEl?.selectionStart ?? value.length;
  const end = inputEl?.selectionEnd ?? value.length;
  setValue(value.slice(0, start) + token + value.slice(end));
  requestAnimationFrame(() => {
    if (!inputEl) return;
    const pos = start + token.length;
    try {
      inputEl.focus();
      inputEl.setSelectionRange(pos, pos);
    } catch { /* a non-text input has no selection range */ }
  });
}
