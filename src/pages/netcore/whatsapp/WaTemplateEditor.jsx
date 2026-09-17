import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../../api/axios';
import toast from 'react-hot-toast';
import ConfirmDialog from '../ConfirmDialog';
import SearchableSelect from './SearchableSelect';
import WaPhonePreview from './WaPhonePreview';
import { WA_TPL_API, WA_SET_API, ATTR_API, FORM, WA, WA_CSS, inp, label, card, waPhoneE164, waPhoneHasToken } from './waShared';
import WaAttributeField from './WaAttributeField';
import { buildCustomAttributeTags } from '../campaignMergeTags';
import { Spinner, WhatsAppIcon, Notice, ApprovalBadge } from './WaUi';

// Same base + fallback as src/api/axios.js — the tracked link shown here is the real public URL
// WhatsApp will open, which is never localhost even in dev.
const API_BASE = import.meta.env.VITE_API_URL || 'https://cit3.internshipstudio.com/admin/react-api';


const LANGUAGES = [
  { value: 'en', label: 'English', sublabel: 'en' },
  { value: 'en_US', label: 'English (US)', sublabel: 'en_US' },
  { value: 'en_GB', label: 'English (UK)', sublabel: 'en_GB' },
  { value: 'hi', label: 'Hindi', sublabel: 'hi' },
  { value: 'mr', label: 'Marathi', sublabel: 'mr' },
  { value: 'gu', label: 'Gujarati', sublabel: 'gu' },
  { value: 'ta', label: 'Tamil', sublabel: 'ta' },
  { value: 'te', label: 'Telugu', sublabel: 'te' },
  { value: 'bn', label: 'Bengali', sublabel: 'bn' },
  { value: 'kn', label: 'Kannada', sublabel: 'kn' },
  { value: 'ml', label: 'Malayalam', sublabel: 'ml' },
  { value: 'pa', label: 'Punjabi', sublabel: 'pa' },
];

const CATEGORIES = [
  { value: 'utility', label: 'Utility', sublabel: 'order/exam updates, reminders' },
  { value: 'marketing', label: 'Marketing', sublabel: 'offers, announcements' },
  { value: 'authentication', label: 'Authentication', sublabel: 'one-time passcodes' },
];

const HEADER_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'Document' },
];

const APPROVALS = [
  { value: 'pending', label: 'Pending with Meta', sublabel: 'submitted, not yet usable' },
  { value: 'approved', label: 'Approved', sublabel: 'ready to send' },
  { value: 'rejected', label: 'Rejected', sublabel: 'needs changes' },
  { value: 'unknown', label: 'Unknown', sublabel: 'status not tracked' },
];

/*
 * Hosts this business controls — and therefore the only ones a click can be tracked on.
 *
 * Tracking works by handing the landing page a campaign id it can store, so it only means
 * anything where we own the page reading it. A link to someone else's site can be tapped all day
 * and nobody will ever tell us, so ticking the box there would promise a number that stays zero.
 *
 * Add a domain here if the platform grows one; subdomains are matched automatically.
 */
const TRACKABLE_HOSTS = ['internshipstudio.com'];

function isTrackableUrl(url) {
  try {
    const host = new URL(String(url || '').trim()).hostname.toLowerCase();
    return TRACKABLE_HOSTS.some(d => host === d || host.endsWith('.' + d));
  } catch {
    return false;   // still being typed, or not a URL at all
  }
}

const BUTTON_TYPES = [
  { value: 'url', label: 'Visit website', sublabel: 'opens a link' },
  { value: 'phone', label: 'Call phone number', sublabel: 'dials a number' },
  { value: 'quick_reply', label: 'Quick reply', sublabel: 'sends a canned reply' },
];

const EMPTY = {
  id: null, meta_template_id: '', name: '', display_name: '', category: 'utility', language: 'en',
  header_type: 'none', header_text: '', header_media_url: '',
  body_text: '', footer_text: '', buttons: [], click_target_url: '', link_id: null,
  sample_values: { header: [], body: [] },
  var_defaults: {},
  approval_status: 'pending',
};

function countVars(text) {
  const m = String(text || '').match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return m.reduce((max, tok) => Math.max(max, parseInt(tok.replace(/\D/g, ''), 10) || 0), 0);
}

/*
 * What you READ versus what Meta STORES.
 *
 * Meta only understands {{1}}, {{2}} … and the body it approves must contain exactly those. But
 * "Hi {{1}}, your link is {{11}}" is unreadable — you cannot check the copy without also holding
 * eleven numbers in your head. So the editor shows [FIRST_NAME] and [PC_LINK] in their places and
 * converts back on every keystroke. The stored body never changes shape.
 *
 * The pair is a true round trip because the mapping is one-to-one: each {{n}} has at most one
 * attribute, and toStored() only recognises a bracket token that some {{n}} actually claims. A
 * token you type by hand that nothing is mapped to stays literal text, which is correct — nothing
 * would have filled it.
 */
function toDisplay(body, varDefaults) {
  return String(body || '').replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => (varDefaults || {})[String(n)] || m);
}

function toStored(display, varDefaults) {
  /*
   * Variable numbers are consumed IN ORDER, which is what makes a repeated attribute survive.
   *
   * A first-wins lookup looked fine until the same attribute filled two slots — "Hi [FIRST_NAME],
   * … Name: [FIRST_NAME]" would turn BOTH into {{1}} and {{2}} would vanish from the body, taking
   * a variable Meta had approved with it. Walking the numbers in order instead gives the first
   * occurrence {{1}} and the second {{2}}, which is the mapping the operator actually set.
   *
   * Numeric keys only: 'button_url_suffix' and 'button_destination_attr' share this map and are
   * not body variables.
   */
  const slots = Object.entries(varDefaults || {})
    .filter(([n, tok]) => /^\d+$/.test(n) && tok)
    .map(([n, tok]) => ({ n: parseInt(n, 10), tok, used: false }))
    .sort((a, b) => a.n - b.n);

  return String(display || '').replace(/\[[A-Z0-9_]+\]/g, m => {
    const slot = slots.find(s => !s.used && s.tok === m);
    if (!slot) return m;         // nothing claims this token — leave it as the literal text it is
    slot.used = true;
    return `{{${slot.n}}}`;
  });
}

/*
 * The two faces of a tracked link. Mirrors lib/WaLinks.php — the server is what actually rewrites
 * the stored URL; these only keep the editor honest about which form it is showing.
 *
 *   what you type      https://dashboard.internshipstudio.com/login
 *   what Meta approves https://dashboard.internshipstudio.com/login/23
 *
 * 23 is this template's permanent link id (wa_links). The path form is what Meta actually approved
 * (exam_live_link_v3), after refusing every version whose link carried a variable — so it is the
 * shape generated here. The dashboard also reads a "?id=23" query form, which needs no route, but
 * nothing is generated in that shape while the approved templates are in this one.
 *
 * plainUrl() strips both forms and the "{{1}}" ending from the abandoned variable-based scheme, so
 * any older template opens showing a clean, retypeable address.
 */
function plainUrl(url, linkId) {
  let s = String(url || '').replace(/[?&/]?\{\{\s*\d+\s*\}\}\s*$/, '');
  if (linkId) {
    s = s.replace(new RegExp('[?&]id=' + linkId + '(?=$|[&#])'), '');
    s = s.replace(new RegExp('/' + linkId + '(?=$|[?#])'), '');
  }
  return s;
}

function trackedUrl(url, linkId) {
  const s = plainUrl(url, linkId);
  if (!s || !linkId) return s;
  // The id goes in before any query string — appending it to "…/login?next=x" would change that
  // query value rather than the path.
  const cut = s.search(/[?#]/);
  const path = (cut === -1 ? s : s.slice(0, cut)).replace(/\/+$/, '');
  const tail = cut === -1 ? '' : s.slice(cut);
  return path + '/' + linkId + tail;
}

export default function WaTemplateEditor() {
  const { id: routeId } = useParams();
  const nav = useNavigate();
  const [tpl, setTpl] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(!!routeId);
  const [saving, setSaving] = useState(false);
  const [metaBusy, setMetaBusy] = useState(false);
  const [confirmBackOpen, setConfirmBackOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const bodyRef = useRef(null);
  const lastSavedRef = useRef(JSON.stringify(EMPTY));

  /* Your attributes, for the body and button-URL pickers. Fetched here because the editor is
     reachable directly by URL and has no parent holding the list. */
  const [customAttrTags, setCustomAttrTags] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(ATTR_API, new URLSearchParams({ action: 'list', per_page: 200 }), FORM);
        if (res.data.success) setCustomAttrTags(buildCustomAttributeTags(res.data.data.attributes));
      } catch { /* the editor still works without the picker */ }
    })();
  }, []);

  /* The business's own WhatsApp numbers, to choose a Call button's destination from rather than
     typing one. See the Call button field for why choosing beats typing here. */
  const [ownNumbers, setOwnNumbers] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post(WA_SET_API, new URLSearchParams({ action: 'get' }), FORM);
        if (res.data.success) setOwnNumbers(res.data.data.senders || []);
      } catch { /* typing one by hand still works */ }
    })();
  }, []);

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'get', id: routeId }), FORM);
        if (res.data.success) {
          const t = res.data.data.template;
          const loaded = {
            ...EMPTY, ...t,
            id: Number(t.id),
            buttons: t.buttons || [],
            click_target_url: t.click_target_url || '',
            link_id: t.link_id ? Number(t.link_id) : null,
            sample_values: {
              header: t.sample_values?.header || [],
              body: t.sample_values?.body || [],
            },
            var_defaults: t.var_defaults && typeof t.var_defaults === 'object' ? t.var_defaults : {},
          };
          setTpl(loaded);
          lastSavedRef.current = JSON.stringify(loaded);
        } else toast.error('Template not found');
      } catch { toast.error('Could not load the template'); }
      finally { setLoading(false); }
    })();
  }, [routeId]);

  const set = (k, v) => setTpl(t => ({ ...t, [k]: v }));
  // Meta already holds this one's approved wording, so it can only be saved locally.
  const alreadyApproved = !!tpl.meta_template_id && tpl.approval_status === 'approved';
  const bodyVars = countVars(tpl.body_text);
  const headerVars = tpl.header_type === 'text' ? countVars(tpl.header_text) : 0;

  /*
   * One click on a sample row does both jobs: names the attribute that fills {{n}} at send time,
   * and supplies the example Meta insists on for approval.
   *
   * An example the operator has already typed is never overwritten — theirs is more realistic than
   * anything derivable from an attribute name, and Meta compares the example against the copy.
   */
  /*
   * Typing or pasting [ATTRIBUTE] into the body MAKES it a variable.
   *
   * Before this, a bracket token only became {{n}} if some slot was already mapped to it, so the
   * ordinary way of working — paste the finished copy, then say what fills each slot — left the
   * brackets as literal words. The counter read "0 variables" and Meta would have approved
   * "Hi [FIRST_NAME]," as that exact text, with the brackets, for every recipient.
   *
   * Now an unclaimed token that names a real attribute takes the next free number and records
   * itself, so the body and the mapping cannot disagree however the copy arrived. A bracket word
   * that is NOT one of your attributes is left alone, which keeps "[see below]" as prose.
   */
  const setBodyFromDisplay = (display) => {
    setTpl(t => {
      const defaults = { ...(t.var_defaults || {}) };
      const slots = Object.entries(defaults)
        .filter(([n, tok]) => /^\d+$/.test(n) && tok)
        .map(([n, tok]) => ({ n: parseInt(n, 10), tok, used: false }))
        .sort((a, b) => a.n - b.n);
      let maxN = slots.reduce((m, s) => Math.max(m, s.n), 0);
      const known = new Set(customAttrTags.map(x => x.value));
      const added = [];

      const body = String(display || '').replace(/\[[A-Z0-9_]+\]/g, m => {
        const slot = slots.find(s => !s.used && s.tok === m);
        if (slot) { slot.used = true; return `{{${slot.n}}}`; }
        if (!known.has(m)) return m;
        maxN += 1;
        defaults[String(maxN)] = m;
        added.push(maxN);
        return `{{${maxN}}}`;
      });

      // Meta refuses a submission with a blank example, so a newly created slot gets one.
      const samples = { header: [...(t.sample_values?.header || [])], body: [...(t.sample_values?.body || [])] };
      added.forEach(n => {
        if (!String(samples.body[n - 1] || '').trim()) samples.body[n - 1] = (defaults[String(n)] || '').replace(/[[\]]/g, '');
      });

      return { ...t, body_text: body, var_defaults: defaults, sample_values: samples };
    });
  };

  const setSampleAttribute = (i, token) => {
    setTpl(t => {
      const s = { header: [...(t.sample_values?.header || [])], body: [...(t.sample_values?.body || [])] };
      if (!String(s.body[i] || '').trim()) s.body[i] = token.replace(/[[\]]/g, '');
      return { ...t, sample_values: s, var_defaults: { ...(t.var_defaults || {}), [String(i + 1)]: token } };
    });
  };

  const setVarDefault = (n, token) =>
    setTpl(t => ({ ...t, var_defaults: { ...(t.var_defaults || {}), [String(n)]: token } }));

  /*
   * Picking an attribute in the body adds a VARIABLE, not the token itself.
   *
   * Meta approves the body text and then renders it from its own copy, so `[PC_LINK]` typed into
   * the body would be approved as those nine literal characters and delivered as those nine
   * literal characters. The only thing WhatsApp personalises is a {{n}} parameter, whose value
   * travels with each individual send.
   *
   * So one click does three things: writes {{n}} where the cursor is, records that {{n}} means
   * this attribute, and seeds a sample value so Meta has something to approve against. Campaigns
   * read the recording and start pre-filled.
   */
  const pickBodyAttribute = (token, el) => {
    const n = bodyVars + 1;
    const marker = `{{${n}}}`;
    /*
     * The cursor is in the DISPLAYED text, which is not the stored text — [FIRST_NAME] occupies
     * twelve characters where {{1}} occupies five. So the insert is done on the display string and
     * converted back, rather than applying a display offset to the stored one and landing in the
     * middle of a token.
     */
    const shown = toDisplay(tpl.body_text, tpl.var_defaults);
    const start = el?.selectionStart ?? shown.length;
    const end = el?.selectionEnd ?? start;
    const nextDefaults = { ...(tpl.var_defaults || {}), [String(n)]: token };
    const body = toStored(shown.slice(0, start) + marker + shown.slice(end), nextDefaults);

    const samples = { ...(tpl.sample_values || { header: [], body: [] }) };
    const bodySamples = [...(samples.body || [])];
    // Meta rejects a submission with a blank example, so the attribute's own name stands in.
    bodySamples[n - 1] = bodySamples[n - 1] || token.replace(/[[\]]/g, '');
    samples.body = bodySamples;

    setTpl(t => ({
      ...t,
      body_text: body,
      sample_values: samples,
      var_defaults: { ...(t.var_defaults || {}), [String(n)]: token },
    }));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      // The caret lands after the DISPLAYED token, since that is what the field now holds.
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  /*
   * An attribute on a button URL becomes Meta's URL-SUFFIX variable, not inline text.
   *
   * Meta will not approve a URL with a variable in the middle, but it does allow one at the very
   * end — the dynamic-URL button. So the address is written as "<your url>{{1}}" and the campaign
   * supplies the tail per recipient, which is the machinery already behind
   * variables.button_url_suffix in the send worker.
   *
   * Be warned: this build's own history records Meta rejecting dynamic-URL templates on this
   * account, and Netcore accepting a button parameter and then never delivering it (WhatsApp then
   * refuses the message with 131008). If the approval comes back rejected, that is why, and the
   * reliable alternative is the same attribute in a BODY variable, where WhatsApp auto-links it.
   */
  /*
   * A per-person button destination, done the only way Meta allows.
   *
   * My first attempt appended the attribute to whatever address you typed, which is wrong for the
   * case that matters. PC_LINK is not a suffix — it is a WHOLE URL on someone else's domain,
   * chat.whatsapp.com, different for every student. Meta approves a button URL once and permits a
   * variable only at the very end, so the domain is identical in every copy of the message. A
   * per-person address can never be the button URL itself.
   *
   * It can be the other side of a redirect, and that redirector already exists. The button points
   * at c.php with this recipient's own token on the end — one fixed domain, which Meta is happy
   * to approve — c.php records the tap and then forwards them to whatever the attribute resolved
   * to for them.
   *
   * That also answers click tracking, which was otherwise impossible here: Meta and Netcore both
   * report nothing at all for a URL button, so a tap is only ever observable if it crosses our own
   * server first. Sending everyone through c.php is what makes the count exist.
   */
  const pickButtonAttribute = (i, b, token) => {
    setButton(i, { url: `${API_BASE}/api/whatsapp/c.php?t={{1}}`, dynamic: true, dynamicTouched: true });
    setTpl(t => ({
      ...t,
      var_defaults: {
        ...(t.var_defaults || {}),
        button_destination_attr: token,
        // The campaign fills {{1}} with this recipient's id — see wa_render_for_recipient().
        button_url_suffix: 'XX_WA_CLICK_TOKEN_XX',
      },
    }));
  };

  const clearButtonAttribute = (i, b) => {
    setButton(i, { url: '', dynamic: false, dynamicTouched: true });
    setTpl(t => {
      const next = { ...(t.var_defaults || {}) };
      delete next.button_destination_attr;
      delete next.button_url_suffix;
      return { ...t, var_defaults: next };
    });
  };

  /* Appends the next placeholder at the cursor. WhatsApp requires a consecutive 1..N run, so
     the number is derived from what's already used rather than being typed by hand. */
  const insertVariable = () => {
    const el = bodyRef.current;
    const next = bodyVars + 1;
    const token = `{{${next}}}`;
    const start = el?.selectionStart ?? (tpl.body_text || '').length;
    const end = el?.selectionEnd ?? start;
    const text = (tpl.body_text || '');
    set('body_text', text.slice(0, start) + token + text.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const setSample = (group, i, v) => {
    setTpl(t => {
      const s = { header: [...(t.sample_values?.header || [])], body: [...(t.sample_values?.body || [])] };
      s[group][i] = v;
      return { ...t, sample_values: s };
    });
  };

  const addButton = () => {
    if ((tpl.buttons || []).length >= 3) return toast.error('WhatsApp allows at most 3 buttons');
    /*
     * A new URL button starts at the tracked destination, because that is what it is for in almost
     * every template here: a plain message and one button that sends people to your platform.
     * Typing the same URL a second time on the same screen only creates a chance to mistype it —
     * and a button whose URL differs from the tracked destination by one character is the exact
     * failure that reports zero conversions while looking perfectly configured.
     */
    const dest = String(tpl.click_target_url || '').trim();
    set('buttons', [...(tpl.buttons || []), {
      type: 'url', text: '', url: dest, phone: '', dynamic: !!dest && isTrackableUrl(dest),
    }]);
  };
  const setButton = (i, patch) => set('buttons', tpl.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const removeButton = i => set('buttons', tpl.buttons.filter((_, j) => j !== i));

  const validate = () => {
    if (!tpl.name.trim()) return 'Template name is required';
    if (!/^[a-z0-9_]+$/.test(tpl.name.trim())) return 'Template name may only contain lowercase letters, numbers and underscores';
    if (!tpl.body_text.trim()) return 'Message body is required';
    // Mirrors the server check — a body using {{1}} and {{3}} but never {{2}} is rejected by Meta.
    const used = [...new Set((tpl.body_text.match(/\{\{\s*\d+\s*\}\}/g) || []).map(t => parseInt(t.replace(/\D/g, ''), 10)))].sort((a, b) => a - b);
    if (used.length && used.join(',') !== used.map((_, i) => i + 1).join(',')) {
      return `Body placeholders must run consecutively from {{1}} — found {{${used.join('}}, {{')}}}`;
    }
    /*
     * Meta refuses a body that BEGINS or ENDS with a variable — "Variables can't be at the start
     * or end of the template" (code 100). Caught here because the alternative is a round trip to
     * Meta, a rejection, and an edit allowance spent on a one-word fix.
     *
     * Trailing punctuation is stripped before the check: a body ending "…here: {{1}}." satisfies
     * Meta, and refusing it would be stricter than the rule it is enforcing.
     */
    const trimmedBody = tpl.body_text.trim();
    if (/^\{\{\s*\d+\s*\}\}/.test(trimmedBody)) {
      return 'Meta does not allow the body to START with a variable — put some words before {{1}}';
    }
    if (/\{\{\s*\d+\s*\}\}[\s.,!?;:)"']*$/.test(trimmedBody)) {
      return 'Meta does not allow the body to END with a variable — add a line after it, e.g. "Thank you."';
    }
    for (const b of tpl.buttons || []) {
      if (!b.text.trim()) return 'Every button needs a label';
      if (b.type === 'url' && !b.url.trim()) return 'A "Visit website" button needs a URL';
      if (b.type === 'phone' && !b.phone.trim()) return 'A "Call phone number" button needs a number';
      /*
        A literal number is put into international form here, so what is saved is what Meta accepts.
        A number holding an attribute is left exactly as written — it is the author's choice, the
        field says what Meta does with it, and mangling the token would help nobody.
      */
      if (b.type === 'phone' && !waPhoneHasToken(b.phone) && !waPhoneE164(b.phone)) {
        return `The Call button number "${b.phone.trim()}" is not a phone number Meta will accept — `
             + 'write it with the country code, like +918237850238';
      }
    }
    return null;
  };

  /** Writes the local copy and returns its id, without navigating — so the combined
   *  save-and-submit flow can chain straight into the Meta call. */
  const persist = async () => {
    const err = validate();
    if (err) { toast.error(err); return null; }
    setSaving(true);
    try {
      const body = new URLSearchParams({
        action: 'save',
        id: tpl.id || '',
        name: tpl.name.trim(),
        display_name: tpl.display_name || tpl.name.trim(),
        category: tpl.category, language: tpl.language,
        header_type: tpl.header_type, header_text: tpl.header_text || '', header_media_url: tpl.header_media_url || '',
        body_text: tpl.body_text, footer_text: tpl.footer_text || '',
        // dynamicTouched is UI bookkeeping — it records that the admin overrode the auto-tick in
        // this editing session, and has no meaning once saved. Stripped so it never lands in the
        // stored button JSON or gets sent to Meta.
        buttons: JSON.stringify((tpl.buttons || []).map(b => {
          const { dynamicTouched: _ignored, ...rest } = b;
          return rest;
        })),
        click_target_url: tpl.click_target_url || '',
        sample_values: JSON.stringify(tpl.sample_values || {}),
        var_defaults: JSON.stringify(tpl.var_defaults || {}),
        approval_status: tpl.approval_status,
      });
      const res = await api.post(WA_TPL_API, body, FORM);
      if (res.data.success) {
        const savedId = res.data.data.id;
        // The link id is minted server-side on the first save of a template that has a tracked
        // destination. Taking it back into state here is what lets a brand-new template show its
        // real approved URL immediately, instead of only after being reopened.
        const linkId = res.data.data.link_id ? Number(res.data.data.link_id) : null;
        setTpl(t => ({ ...t, id: savedId, link_id: linkId || t.link_id }));
        lastSavedRef.current = JSON.stringify({ ...tpl, id: savedId, link_id: linkId || tpl.link_id });
        return savedId;
      }
      toast.error(res.data.message || 'Could not save');
      return null;
    } catch (e) { toast.error(e?.response?.data?.message || 'Network error'); return null; }
    finally { setSaving(false); }
  };

  /* Local-only save. Used for templates Meta has already approved, where submitting again would
     just be a duplicate-name rejection. */
  const saveOnly = async () => {
    const id = await persist();
    if (!id) return;
    toast.success('Template saved');
    nav('/netcore/whatsapp/templates');
  };

  /*
   * One button does both, in the only order that works: our copy is written first, then that
   * saved version is what gets submitted. Two separate buttons meant you could submit yesterday's
   * wording after editing today's and get no hint that you had.
   */
  const saveAndSubmit = async () => {
    const id = await persist();
    if (!id) return;

    setMetaBusy(true);
    const t = toast.loading('Saved — submitting to Meta for approval…');
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'submit_to_meta', id }), FORM);
      if (res.data.success) {
        const d = res.data.data;
        toast.success(`Submitted to Meta — status "${d.approval_status}". Usually approved within minutes.`, { id: t, duration: 8000 });
        nav('/netcore/whatsapp/templates');
      } else {
        // The local copy IS saved at this point, so the message says so — otherwise a Meta
        // rejection reads as if the whole edit was lost.
        toast.error(`Saved locally, but Meta rejected it: ${res.data.message || 'unknown reason'}`, { id: t, duration: 14000 });
        set('id', id);
      }
    } catch (e) {
      toast.error(`Saved locally, but Meta rejected it: ${e?.response?.data?.message || 'network error'}`, { id: t, duration: 14000 });
      set('id', id);
    } finally { setMetaBusy(false); }
  };

  const refreshStatus = async () => {
    setMetaBusy(true);
    const t = toast.loading('Checking with Meta…');
    try {
      const res = await api.post(WA_TPL_API, new URLSearchParams({ action: 'refresh_status', id: tpl.id }), FORM);
      if (res.data.success) {
        set('approval_status', res.data.data.approval_status);
        toast.success(`Status: ${res.data.data.approval_status}`, { id: t });
      } else toast.error(res.data.message || 'Could not check', { id: t, duration: 10000 });
    } catch (e) { toast.error(e?.response?.data?.message || 'Could not check', { id: t, duration: 10000 }); }
    finally { setMetaBusy(false); }
  };

  const requestBack = () => {
    if (JSON.stringify(tpl) !== lastSavedRef.current) setConfirmBackOpen(true);
    else nav('/netcore/whatsapp/templates');
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><Spinner /></div>;
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", minHeight: '100vh', background: '#f8fafc' }}>
      <style>{WA_CSS}</style>

      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 26px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={requestBack} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: WA.green, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <WhatsAppIcon size={18} color="#fff" />
          </span>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{tpl.id ? 'Edit template' : 'Create WhatsApp template'}</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{tpl.id ? `ID ${tpl.id} · ${tpl.name}` : 'Compose the message, then submit it to Meta for approval'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ApprovalBadge status={tpl.approval_status} />
          {tpl.id && tpl.meta_template_id && (
            <button onClick={refreshStatus} disabled={metaBusy}
              title="Ask Meta for this template's current approval status"
              style={{ padding: '10px 16px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: metaBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              Refresh status
            </button>
          )}
          {/*
           * One action, not two. For a template Meta has ALREADY approved it saves locally only —
           * re-submitting that is a guaranteed duplicate-name rejection, and the wording Meta
           * holds is what actually gets sent regardless. For everything else it saves and then
           * submits, in that order.
           */}
          {/* Always confirms first. Submitting to Meta is not undoable — an approved template
              can't be renamed or un-submitted — so it should never happen on a single click. */}
          {/*
            Save without submitting.

            Meta approval is one-way — once a template is submitted its name and language are
            fixed — so writing several templates in advance and approving them when you are ready
            needs a way to stop short of that. This is the same local save the editor already does
            for an approved template, exposed on its own rather than only reachable as a side
            effect of the Meta button.
          */}
          {!alreadyApproved && (
            <button onClick={async () => { const err = validate(); if (err) return toast.error(err); await saveOnly(); }}
              disabled={saving || metaBusy}
              title="Stores this template here only. Nothing is sent to Meta, so you can keep editing it."
              style={{ padding: '10px 18px', border: '1.5px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: (saving || metaBusy) ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'SAVE AS DRAFT'}
            </button>
          )}
          <button onClick={() => { const err = validate(); if (err) return toast.error(err); setConfirmSaveOpen(true); }}
            disabled={saving || metaBusy}
            title={alreadyApproved ? 'Updates the local copy — Meta already holds the approved wording' : 'Saves your copy and sends it to Meta for approval'}
            style={{ padding: '10px 24px', border: 'none', background: WA.green, color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: (saving || metaBusy) ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Saving…' : metaBusy ? 'Submitting…' : alreadyApproved ? 'SAVE TEMPLATE' : 'SAVE & SEND TO META'}
          </button>
        </div>
      </div>

      {/* Full width: the form is dense (three-column detail rows, a buttons builder) and capping
          it at 1180px left a large dead margin on the right of any normal monitor. */}
      <div style={{ display: 'flex', gap: 24, padding: '24px 26px 80px', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* An already-approved template is Meta's copy, not ours. Editing the body here changes
              only the preview — WhatsApp sends the wording Meta approved — and re-submitting it
              is rejected as a duplicate name+language. Saying so up front avoids both traps. */}
          {alreadyApproved ? (
            <Notice tone="warn" style={{ marginBottom: 18 }} title="This template is already approved by Meta — edit with care">
              <b>Save</b> updates our local copy only: the preview and the sample values. It does <b>not</b>
              change what WhatsApp sends — Meta holds the approved wording, and we send the template's
              <i> name</i>, not its text. So editing the body here only makes the preview differ from reality.
              <div style={{ marginTop: 8 }}>
                To genuinely change the wording, create a <b>new</b> template with a new name (e.g.
                <code> {tpl.name}_v2</code>) and submit that one. Re-submitting this one is rejected by Meta
                as a duplicate.
              </div>
              <div style={{ marginTop: 8 }}>
                What is worth editing here: <b>sample values</b>, so the preview and the campaign's variable
                mapping show something realistic.
              </div>
            </Notice>
          ) : (
            <Notice tone="info" style={{ marginBottom: 18 }} title="Save & send to Meta does both">
              One button: it stores your copy here (preview, sample values, variable mapping) and then sends
              the template to Meta for approval.
              <div style={{ marginTop: 8 }}>
                Meta reviews within about 48 hours, usually minutes. The badge above tracks it and updates on
                its own if the Template webhook is registered — or press <b>Refresh status</b>.
              </div>
              <div style={{ marginTop: 8 }}>
                Every variable needs a <b>sample value</b> below, or Meta rejects the submission outright. If
                Meta does reject it, your copy is still saved here so you can fix it and try again.
              </div>
            </Notice>
          )}

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Template details</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={label}>Template name <span style={{ color: '#dc2626' }}>*</span></label>
                <input style={inp} value={tpl.name} placeholder="exam_reminder_1"
                  onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Lowercase, numbers and underscores only — exactly as approved by Meta.</div>
              </div>
              <div>
                <label style={label}>Display name</label>
                <input style={inp} value={tpl.display_name} placeholder="Exam reminder"
                  onChange={e => set('display_name', e.target.value)} />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Friendly label shown in this admin panel only.</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>Category</label>
                <SearchableSelect value={tpl.category} onChange={v => set('category', v)} options={CATEGORIES} searchPlaceholder="Search categories…" />
              </div>
              <div>
                <label style={label}>Language</label>
                <SearchableSelect value={tpl.language} onChange={v => set('language', v)} options={LANGUAGES} searchPlaceholder="Search languages…" />
              </div>
              <div>
                <label style={label}>Approval status</label>
                <SearchableSelect value={tpl.approval_status} onChange={v => set('approval_status', v)} options={APPROVALS} searchPlaceholder="Search…" />
              </div>
            </div>
          </div>

          <div style={card}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Header <span style={{ fontSize: 11.5, fontWeight: 500, color: '#94a3b8' }}>optional</span></div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>A short title or a piece of media above the message.</div>
            <div style={{ maxWidth: 240, marginBottom: 14 }}>
              <SearchableSelect value={tpl.header_type} onChange={v => set('header_type', v)} options={HEADER_TYPES} searchPlaceholder="Search…" />
            </div>
            {tpl.header_type === 'text' && (
              <div>
                <label style={label}>Header text</label>
                <input style={inp} value={tpl.header_text} maxLength={60} onChange={e => set('header_text', e.target.value)}
                  placeholder="Exam Reminder" />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Max 60 characters. May contain one {'{{1}}'} placeholder.</div>
              </div>
            )}
            {['image', 'video', 'document'].includes(tpl.header_type) && (
              <div>
                <label style={label}>Media URL</label>
                <input style={inp} value={tpl.header_media_url} onChange={e => set('header_media_url', e.target.value)}
                  placeholder="https://…/banner.jpg" />
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Must be a publicly reachable URL — WhatsApp fetches it directly.</div>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Message body <span style={{ color: '#dc2626' }}>*</span></div>
              <button type="button" onClick={insertVariable}
                style={{ padding: '7px 12px', border: '1.5px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 7, fontSize: 11, fontWeight: 700, color: WA.primary, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add variable {`{{${bodyVars + 1}}}`}
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
              Supports *bold*, _italic_ and ~strikethrough~. Use variables for anything that changes per contact.
            </div>
            {/*
              Body composer: the formatting markers WhatsApp understands, an emoji palette, and
              your own attributes — all acting on the same plain text that is sent to Meta.

              Inserting an attribute writes its [NAME] token straight into the copy, so the body
              reads the way it will arrive and there is no separate mapping table to keep in step.
              A token is resolved per recipient at send time by the same resolver the email side
              uses, so [PC_LINK] becomes that student's own group link.
            */}
            <WaAttributeField
              fieldRef={bodyRef}
              multiline
              rows={8}
              maxLength={1024}
              value={toDisplay(tpl.body_text, tpl.var_defaults)}
              onChange={setBodyFromDisplay}
              customTags={customAttrTags}
              showTrackedLink
              onPickAttribute={pickBodyAttribute}
              placeholder={'Hi {{1}},\n\nOur records show you have not completed your exam. Please log in to your dashboard to complete it before the deadline.\n\nReply "STOP" to unsubscribe.'}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{bodyVars} variable(s)</span>
            </div>

            {/*
              What each variable will be filled with, stated where you wrote it.

              Meta approves the body text and then renders it itself, so a variable is the ONLY
              place personalisation can live. Picking an attribute above writes {{n}} into the copy
              and records the attribute here; every campaign built on this template starts with
              these already filled in, and can still override any of them.
            */}
            {bodyVars > 0 && (
              <div style={{ marginTop: 10, border: '1.5px solid #eef2ff', background: '#fbfcff', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: '#4338ca', letterSpacing: '.3px', marginBottom: 6 }}>
                  WHAT FILLS EACH VARIABLE
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Array.from({ length: bodyVars }, (_, k) => k + 1).map(n => {
                    const token = (tpl.var_defaults || {})[String(n)] || '';
                    return (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#1e3a8a', flexShrink: 0, width: 44 }}>{`{{${n}}}`}</span>
                        {token ? (
                          <>
                            <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 9px' }}>{token}</span>
                            <button type="button" onClick={() => setVarDefault(n, '')}
                              style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 4px' }}>×</button>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>chosen per campaign — pick an attribute above to set it here instead</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label style={label}>Footer <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional, max 60 chars)</span></label>
              <input style={inp} value={tpl.footer_text} maxLength={60} onChange={e => set('footer_text', e.target.value)}
                placeholder="Internship Studio" />
            </div>

            {/*
              The real page behind a tracked button.

              Lives on the template rather than the campaign because the button URL is part of what
              Meta approved — its destination is the same for every campaign that uses this
              template, and asking per campaign would invite a different answer each time.

              Only meaningful when the button URL routes through c.php, which is what makes the tap
              observable at all; WhatsApp reports nothing for a link button that goes straight out.
            */}
            {/*
              A tracked button is TWO things and both have to be right, so they are spelled out
              rather than described: the URL Meta approves, and the variable the campaign fills.
              Getting either wrong produces a link that works perfectly and reports nothing.
            */}
            {/* Deliberately short. The whole setup is now one checkbox on the button below —
                everything else is derived, so instructions that list steps would be describing
                work the panel already does. */}
            {/*
              The tracked-link destination.

              Kept as a field on the TEMPLATE rather than the campaign because the link's target is
              a property of the message, and asking per campaign would invite a different answer
              each time. It applies to both routes into the tracker — a URL button, or a short link
              written into the body — so it is no longer hidden inside the button section.
            */}
            <div style={{ marginTop: 16 }}>
              <label style={label}>
                Tracked link destination <span style={{ fontWeight: 500, color: '#94a3b8' }}>(optional)</span>
              </label>
              <input style={inp} value={tpl.click_target_url || ''}
                onChange={e => set('click_target_url', e.target.value)}
                placeholder="https://dashboard.internshipstudio.com/login" />
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5, lineHeight: 1.6 }}>
                Where people end up after tapping a link in this template. Write this same plain link
                into your body text (or a button) — a short number is added to the end when the template
                is saved, and that number is what carries the campaign.
              </div>

              {/*
                The tracked link, once it exists.

                It cannot be shown before the first save because the id is a wa_links primary key —
                the row has to exist for the number to be real, and inventing one here would print a
                link that resolves to nothing.
              */}
              {tpl.link_id ? (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '9px 11px', marginTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#0369a1', letterSpacing: '.3px', marginBottom: 4 }}>
                    SENT TO META AS
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#0f172a', wordBreak: 'break-all' }}>
                    {trackedUrl(tpl.click_target_url, tpl.link_id)}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#0c4a6e', marginTop: 6, lineHeight: 1.6 }}>
                    Link <b>#{tpl.link_id}</b> belongs to this template permanently. It points at whichever
                    campaign sent the template last, so the tap is recorded and the goal is credited exactly
                    as it is for a tracked email link. No variables and no parameters — which is what Meta
                    approves.
                  </div>
                </div>
              ) : !!String(tpl.click_target_url || '').trim() && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '9px 11px', marginTop: 8, fontSize: 10.5, color: '#92400e', lineHeight: 1.6 }}>
                  Save the template once and the tracked link appears here — the number is issued at save
                  time. Submit to Meta after that, never before, or the version Meta reviews will be the
                  untracked one.
                </div>
              )}
            </div>
          </div>

          {(headerVars > 0 || bodyVars > 0) && (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Sample values</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                Used for the preview here and on the template card — and it's what Meta asks for when you
                submit the template for approval. Real values are chosen per campaign.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {Array.from({ length: headerVars }).map((_, i) => (
                  <div key={`h${i}`}>
                    <label style={label}>Header {`{{${i + 1}}}`}</label>
                    <input style={inp} value={tpl.sample_values?.header?.[i] || ''} onChange={e => setSample('header', i, e.target.value)} placeholder="e.g. iCAT 174" />
                  </div>
                ))}
                {/*
                  Each sample row is also where a variable gets its ATTRIBUTE.

                  Picking one in the body only records the mapping when the {{n}} is inserted by
                  the picker. Paste a finished body — which is the normal way to bring copy over —
                  and every slot reads "chosen per campaign", because nothing ever said what fills
                  it. Here every slot is listed by number whether it was typed or pasted, so the
                  mapping can always be completed, and the sample Meta needs is filled at the same
                  time from the same click.
                */}
                {Array.from({ length: bodyVars }).map((_, i) => {
                  const token = (tpl.var_defaults || {})[String(i + 1)] || '';
                  return (
                    <div key={`b${i}`}>
                      <label style={label}>Body {`{{${i + 1}}}`}</label>
                      <WaAttributeField
                        format={false}
                        customTags={customAttrTags}
                        value={tpl.sample_values?.body?.[i] || ''}
                        onChange={v => setSample('body', i, v)}
                        onPickAttribute={tok => setSampleAttribute(i, tok)}
                        placeholder="e.g. Rahul"
                      />
                      {token
                        ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11 }}>
                            <span style={{ color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 8px', fontFamily: 'monospace' }}>{token}</span>
                            <span style={{ color: '#94a3b8' }}>fills this for every recipient</span>
                            <button type="button" onClick={() => setVarDefault(i + 1, '')}
                              style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px' }}>×</button>
                          </div>
                        )
                        : <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>Pick an attribute to fill this per recipient</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Buttons <span style={{ fontSize: 11.5, fontWeight: 500, color: '#94a3b8' }}>optional, up to 3</span></div>
              <button type="button" onClick={addButton}
                style={{ padding: '7px 14px', border: '1.5px dashed #a5b4fc', background: '#f5f3ff', borderRadius: 7, fontSize: 11, fontWeight: 700, color: WA.primary, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add button
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Buttons are part of the approved template — they can't be changed per campaign.</div>

            {(tpl.buttons || []).length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#cbd5e1', fontSize: 12, border: '1px dashed #e2e8f0', borderRadius: 8 }}>No buttons</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tpl.buttons.map((b, i) => (
                  <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: WA.primary }}>BUTTON {i + 1}</span>
                      <button type="button" onClick={() => removeButton(i)}
                        style={{ border: 'none', background: 'none', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Remove</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={label}>Type</label>
                        <SearchableSelect value={b.type} onChange={v => setButton(i, { type: v })} options={BUTTON_TYPES} searchPlaceholder="Search…" />
                      </div>
                      <div>
                        <label style={label}>Button text</label>
                        <input style={inp} value={b.text} maxLength={25} onChange={e => setButton(i, { text: e.target.value })} placeholder="Log in" />
                      </div>
                      {b.type === 'url' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={label}>Where this button goes</label>
                          {/*
                            A PLAIN url, always. The tracked-link id is machinery, not a decision:
                            it is appended on save (wa_templates.php) and stripped for display here,
                            so the two can never drift apart and nobody has to retype a number.
                          */}
                          {/*
                            The picker here offers the TRACKED LINK, not attributes.

                            Meta freezes a button URL at approval and refuses any that carries a
                            variable, so a per-recipient address in a button is not something this
                            panel is choosing not to do — it is not available. The tracked link is
                            the one form that works: a fixed URL whose landing page identifies the
                            visitor. For a genuinely per-person link like PC_LINK, put it in a body
                            variable, where WhatsApp auto-links whatever arrives.
                          */}
                          <WaAttributeField
                            customTags={customAttrTags}
                            showTrackedLink
                            format={false}
                            onPickAttribute={token => pickButtonAttribute(i, b, token)}
                            value={plainUrl(b.url, tpl.link_id)}
                            onChange={raw => {
                              const url = plainUrl(raw, tpl.link_id);
                              /*
                               * A link to our own platform is trackable and almost always should
                               * be, so it ticks itself — forgetting the box is the single mistake
                               * that makes a campaign report zero conversions while looking
                               * perfectly configured.
                               *
                               * Stops the moment the admin touches the checkbox: after that it is
                               * their decision, and a form that keeps overriding you is worse than
                               * one that never helped.
                               */
                              const patch = { url };
                              if (!b.dynamicTouched) patch.dynamic = isTrackableUrl(url);
                              setButton(i, patch);
                            }}
                            placeholder={String(tpl.click_target_url || '').trim() || 'https://dashboard.internshipstudio.com/login'} />

                          {/* The suffix is shown as its own row because it is a second, separately
                              removable half of the address — not part of what you typed. */}
                          {!!(tpl.var_defaults || {}).button_destination_attr && (
                            <div style={{ marginTop: 6, fontSize: 11.5, color: '#166534', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '9px 11px', lineHeight: 1.6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <b>Goes to each recipient's own</b>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{(tpl.var_defaults || {}).button_destination_attr}</span>
                                <button type="button" onClick={() => clearButtonAttribute(i, b)}
                                  style={{ marginLeft: 'auto', border: 'none', background: 'none', color: '#15803d', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                              </div>
                              <div style={{ color: '#15803d', marginTop: 3 }}>
                                Meta approves one fixed address for a button, so this one points at our own
                                redirector. The tap is recorded there and the person is forwarded to their own
                                link — which is also the only way a WhatsApp button tap can be counted at all.
                              </div>
                            </div>
                          )}
                          {!String(b.url || '').trim() && !!String(tpl.click_target_url || '').trim() && (
                            <div style={{ fontSize: 10.5, color: '#0369a1', marginTop: 5, lineHeight: 1.5 }}>
                              Leave this blank and the button uses your <b>Tracked link destination</b> above —
                              one place to change it, so the two can't drift apart.
                            </div>
                          )}
                          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!b.dynamic}
                              onChange={e => setButton(i, { dynamic: e.target.checked, dynamicTouched: true })} />
                            <span style={{ fontSize: 11.5, color: '#334155' }}>
                              <b>Track clicks and conversions</b> — record who tapped, and credit the campaign
                              when they complete the goal
                            </span>
                          </label>

                          {/* Says why the box moved on its own, so it doesn't read as a glitch. */}
                          {!!b.dynamic && !b.dynamicTouched && isTrackableUrl(b.url) && (
                            <div style={{ fontSize: 10.5, color: '#15803d', marginTop: 5, paddingLeft: 22 }}>
                              Turned on automatically — this link points at your own platform, so clicks can be
                              tracked. Untick it if you don't want them counted.
                            </div>
                          )}
                          {!b.dynamic && !!String(b.url || '').trim() && !isTrackableUrl(b.url) && (
                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5, paddingLeft: 22, lineHeight: 1.5 }}>
                              This link goes to a site you don't control, so a tap can't be reported back —
                              tracking would always show zero.
                            </div>
                          )}

                          {/* The derived URL, shown read-only. One field to edit, one thing to
                              check — change the link above and this follows immediately. */}
                          {/* The blank button falls back to the tracked destination, exactly as the
                              server does on save — so this preview shows the URL Meta will really
                              receive rather than going blank and looking unconfigured. */}
                          {/*
                            Silent when the button is attribute-backed, because this panel's advice
                            is actively harmful there. It tells you to copy the address into Tracked
                            link destination, which issues a link id — and a template WITH a link id
                            takes the static branch on submit, stripping the {{1}} the per-recipient
                            redirect depends on. Following the hint would quietly turn a dynamic
                            button back into a fixed one, with nothing on screen to say so. The green
                            row above already explains what this button does.
                          */}
                          {!(tpl.var_defaults || {}).button_destination_attr
                            && !!b.dynamic && !!(String(b.url || '').trim() || String(tpl.click_target_url || '').trim()) && (
                            <div style={{ marginTop: 8, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '9px 11px' }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: '#0369a1', letterSpacing: '.3px', marginBottom: 4 }}>
                                SENT TO META AS
                              </div>
                              <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#0f172a', wordBreak: 'break-all' }}>
                                {(() => {
                                  const eff = String(b.url || '').trim() || String(tpl.click_target_url || '').trim();
                                  return tpl.link_id ? trackedUrl(eff, tpl.link_id) : plainUrl(eff, tpl.link_id);
                                })()}
                              </div>
                              <div style={{ fontSize: 10.5, color: '#0c4a6e', marginTop: 5, lineHeight: 1.5 }}>
                                {tpl.link_id
                                  ? <>The number on the end is this template's tracked link. It records the tap and
                                      credits the campaign when the goal is completed — nothing else to configure.</>
                                  : <>Set the <b>Tracked link destination</b> above to this same address and save once;
                                      the tracking number is added here automatically.</>}
                              </div>
                              {/*
                                WHAT A TRACKED LINK CANNOT DO, said here because the line above reads as
                                though it can.

                                This URL is one fixed string, identical in every copy of the message — that
                                is exactly what gets it approved by Meta — so the tap arrives carrying
                                nothing about who made it. It is counted, and the visitor gets the cookie
                                that credits a later conversion, but the report cannot put a name to it
                                until that person signs in. Reading "it records the tap" and expecting a
                                named click is the single most common misreading of this screen.

                                A per-person button is a different thing and is offered right here: pick an
                                attribute for the button and it points at our redirector carrying a token
                                unique to that one message, which names the tap instantly with no sign-in.
                              */}
                              {!!tpl.link_id && (
                                <div style={{ fontSize: 10.5, color: '#0c4a6e', marginTop: 6, lineHeight: 1.5,
                                              borderTop: '1px solid #bae6fd', paddingTop: 6 }}>
                                  <b>This address is the same for everyone</b>, so a tap is counted but not named —
                                  the report can only say who tapped once that person signs in. For a click credited
                                  to the individual straight away, use <b>Attribute</b> on the button instead: it
                                  sends each recipient through a link carrying their own message's token.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {b.type === 'phone' && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                            <label style={label}>Phone number</label>
                            {ownNumbers.length > 0 && (
                              /*
                                PICK A NUMBER instead of typing one.

                                Meta checks this against the real numbering plan and answers with
                                "Param components[2]['buttons'][1]['phone_number'] is not a valid
                                phone number" — an array index, no field name, and it arrives once
                                per business account, so a missing country code reads as three
                                separate failures. Every number offered here is one Meta already
                                knows, complete with its country code.
                              */
                              <select
                                value=""
                                onChange={(e) => { if (e.target.value) setButton(i, { phone: e.target.value }); }}
                                style={{ ...inp, width: 'auto', maxWidth: 240, fontSize: 11.5, padding: '4px 8px' }}
                              >
                                <option value="">Use one of our numbers…</option>
                                {ownNumbers.map((s) => {
                                  const num = waPhoneE164(s.number || s.display_phone_number || '');
                                  if (!num) return null;
                                  return <option key={s.id} value={num}>{(s.label || s.verified_name || 'Number') + ' · ' + num}</option>;
                                })}
                              </select>
                            )}
                          </div>
                          {/*
                            The same Attribute picker the website button has.

                            A number picked from here goes in as a token, and a token typed into a
                            template is delivered as the token: Meta approves the button once and
                            then renders the stored value for every recipient, so it cannot resolve
                            per person. It is offered because it was asked for, and the line under
                            the field says plainly what Meta will do with it.

                            A literal number typed or picked from the account's own numbers is
                            tidied into international form on the way out — see waPhoneE164 — which
                            is what stops the (#192) rejection.
                          */}
                          <WaAttributeField
                            customTags={customAttrTags}
                            format={false}
                            value={b.phone}
                            onChange={v => setButton(i, { phone: v })}
                            placeholder="+918237850238"
                          />
                          {waPhoneHasToken(b.phone) ? (
                            /*
                              This used to say Meta would refuse the button, which was true of what was
                              being sent and not of what had to be sent. A Call button really is approved
                              once and dials one number for everyone, so the token cannot travel to Meta
                              — but it does not have to. It is replaced with the number the attribute
                              holds at the moment the template is submitted, and Meta receives a literal
                              number like any other. Submitting template 166 this way was accepted by both
                              business accounts.
                            */
                            <div style={{ fontSize: 10.5, color: '#0c4a6e', marginTop: 5, lineHeight: 1.5,
                                          background: '#f0f9ff', border: '1px solid #bae6fd',
                                          borderRadius: 7, padding: '7px 9px' }}>
                              <b>The number saved in this attribute is what gets submitted.</b> A Call
                              button is approved once and dials the same number for everyone, so the
                              attribute is resolved when you send the template to Meta rather than per
                              recipient. Change the attribute under <b>Audience → Attributes</b> and
                              resubmit, and every template using it follows. If it has no number saved,
                              the submit stops and says so.
                              {' '}For a number that differs per recipient, put the attribute in a body
                              variable instead, where WhatsApp turns whatever arrives into a tappable link.
                            </div>
                          ) : (
                            <div style={{ fontSize: 10.5, color: WA.sub, marginTop: 5, lineHeight: 1.5 }}>
                              Country code and nothing else, like <b>+918237850238</b>. A ten-digit number
                              is given <b>+91</b> when the template is saved.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 360, flexShrink: 0 }}>
          <div style={{ ...card, position: 'sticky', top: 88, marginBottom: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Live preview</div>
            <WaPhonePreview
              headerType={tpl.header_type}
              headerText={tpl.header_text}
              headerValues={tpl.sample_values?.header || []}
              bodyText={tpl.body_text}
              bodyValues={tpl.sample_values?.body || []}
              footerText={tpl.footer_text}
              buttons={tpl.buttons || []}
              destinationAttr={(tpl.var_defaults || {}).button_destination_attr || ''}
              trackedUrl={tpl.click_target_url || ''}
              height={470}
              emptyHint="Start writing the message body to see it here"
            />
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 10, lineHeight: 1.5 }}>
              Rendered from the sample values above. Each campaign supplies its own real values for these variables.
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmBackOpen}
        tone="warn"
        title="Leave without saving?"
        message="This template has unsaved changes. Going back now will discard them."
        confirmLabel="Leave anyway"
        cancelLabel="Stay"
        onConfirm={() => { setConfirmBackOpen(false); nav('/netcore/whatsapp/templates'); }}
        onCancel={() => setConfirmBackOpen(false)}
      />

      <ConfirmDialog
        open={confirmSaveOpen}
        tone="warn"
        busy={saving || metaBusy}
        title={alreadyApproved ? 'Save this template?' : 'Send this template to Meta?'}
        message={alreadyApproved
          ? `This saves your local copy of "${tpl.name}" — the preview and sample values. It does not change the wording Meta approved, which is what WhatsApp actually sends.`
          : `"${tpl.name}" will be saved here and submitted to Meta for approval in ${tpl.language}. Once submitted the name and language are fixed — changing the wording later means creating a new template. Meta usually reviews within minutes.`}
        confirmLabel={alreadyApproved ? 'Save' : 'Save & send to Meta'}
        cancelLabel="Keep editing"
        onConfirm={async () => {
          setConfirmSaveOpen(false);
          if (alreadyApproved) await saveOnly();
          else await saveAndSubmit();
        }}
        onCancel={() => setConfirmSaveOpen(false)}
      />
    </div>
  );
}
