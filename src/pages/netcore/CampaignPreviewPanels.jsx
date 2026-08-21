import { useMemo } from 'react';

/*
 * The Preview tab's panels: setup, audience, schedule, goal, tracking and the actual content.
 *
 * Read-only by construction — it renders the stored campaign row and offers no save path at all,
 * because the one thing nobody should be able to do from a report is edit a campaign that has
 * already gone out.
 *
 * Both channels share the layout: the questions are the same (what was sent, to whom, when, from
 * where) even though the answers live in different columns. A field with no value renders
 * nothing rather than an empty label — a column of blank labels reads as broken, and the absence
 * of, say, a reply-to address is itself the answer.
 */

// Display names for email_campaigns.esp_transport, which is stored as a machine value.
// 'mailwizz' is retired but still legal on campaigns created before it was removed.
const ROUTE_LABELS = { sendgrid: 'SendGrid', elasticemail: 'Elastic Email', ses: 'Amazon SES', mailwizz: 'MailWizz (retired)' };

const CSS = `
.cpp-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }
@media (max-width:900px) { .cpp-grid { grid-template-columns:1fr; } }

.cpp-card { background:#fff; border:1px solid #e4e7ec; border-radius:12px; overflow:hidden;
  box-shadow:0 1px 2px rgba(16,24,40,.05); }
.cpp-card > h3 { font-size:12.5px; font-weight:750; color:#101828; margin:0; padding:12px 15px;
  border-bottom:1px solid #f2f4f7; background:#fcfcfd; display:flex; align-items:center; gap:8px; }
.cpp-card > div { padding:13px 15px; }

.cpp-row { display:grid; grid-template-columns:140px 1fr; gap:10px; padding:6px 0; align-items:baseline; }
.cpp-row dt { font-size:11.5px; color:#667085; }
.cpp-row dd { font-size:12.5px; color:#101828; margin:0; font-weight:550; word-break:break-word; }
.cpp-row dd.mono { font-variant-numeric:tabular-nums; }

.cpp-tag { display:inline-block; font-size:10.5px; font-weight:650; color:#3730a3; background:#eef2ff;
  border:1px solid #c7d7fe; border-radius:5px; padding:1px 7px; margin:0 4px 4px 0; }

.cpp-frame { border:1px solid #e4e7ec; border-radius:9px; overflow:hidden; background:#fff; height:420px; }
.cpp-frame iframe { width:100%; height:100%; border:0; display:block; }
.cpp-wa { background:#ECE5DD; padding:16px; border-radius:9px; }
.cpp-bubble { background:#fff; border-radius:9px 9px 9px 2px; padding:11px 13px; max-width:88%;
  font-size:12.5px; line-height:1.55; color:#101828; white-space:pre-wrap; word-break:break-word;
  box-shadow:0 1px 2px rgba(16,24,40,.14); }
.cpp-btnrow { margin-top:7px; display:flex; flex-direction:column; gap:5px; max-width:88%; }
.cpp-wabtn { background:#fff; border-radius:7px; padding:8px; text-align:center; font-size:12px;
  font-weight:650; color:#128C7E; box-shadow:0 1px 2px rgba(16,24,40,.14); }
.cpp-none { font-size:12px; color:#98a2b3; margin:0; line-height:1.6; }
`;

const fmtDt = s => {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(s);
  const p = n => String(n).padStart(2, '0');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${M} ${p(d.getDate())}, ${d.getFullYear()} ${p(d.getHours() % 12 || 12)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};
const n0 = v => (v == null ? null : Number(v).toLocaleString('en-IN'));

/*
 * Anything that is meant to be a list of ids → an actual array.
 *
 * These columns hold JSON that the API json_decodes before sending, and what comes back is not
 * reliably an array: a row saved as `5` decodes to a number, one saved with non-sequential keys
 * decodes to a PHP associative array and arrives as a JSON object, and older rows hold a plain
 * comma-separated string. Calling .join() on any of those threw and took the entire Preview tab
 * down with it — which is how a blank page with a console error happens.
 *
 * Normalising here rather than in the API on purpose: the API's shape is what it is across
 * several endpoints and years of stored rows, and the display layer is the cheapest place to be
 * tolerant. Nothing downstream cares beyond wanting something it can render.
 */
function asList(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.filter(x => x !== null && x !== '');
  if (typeof v === 'object') return Object.values(v).filter(x => x !== null && x !== '');
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
}

/** Renders nothing at all when there is no value — no empty labels. */
const Row = ({ k, children, mono }) =>
  (children === null || children === undefined || children === '' || children === 'NA')
    ? null
    : <div className="cpp-row"><dt>{k}</dt><dd className={mono ? 'mono' : undefined}>{children}</dd></div>;

export default function CampaignPreviewPanels({ channel, row, full, loading }) {
  const isWa = channel === 'whatsapp';

  const tags = useMemo(() => {
    if (row?.tag_list?.length) return row.tag_list;
    return String(full?.tags || '').split(',').map(s => s.trim()).filter(Boolean);
  }, [row, full]);

  return (
    <>
      <style>{CSS}</style>
      <div className="cpp-grid">
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="cpp-card">
            <h3>Campaign details</h3>
            <div>
              <dl style={{ margin: 0 }}>
                <Row k="Campaign ID" mono>{row.id}</Row>
                <Row k="Campaign name">{row.name}</Row>
                {/* Falls back to the raw value: this panel is shared with the WhatsApp channel,
                    whose provider strings come from a different table entirely. */}
                <Row k="Sending route">{ROUTE_LABELS[row.provider] || row.provider}</Row>
                {isWa ? (
                  <>
                    <Row k="Template">{full?.template_name}</Row>
                    <Row k="Category">{full?.template_category}</Row>
                    <Row k="Business number" mono>{full?.business_number}</Row>
                  </>
                ) : (
                  <>
                    <Row k="Sender name">{full?.sender_name}</Row>
                    <Row k="Email ID">{full?.sender_email}</Row>
                    <Row k="Sending domain">{full?.sending_domain}</Row>
                    <Row k="Reply email">{full?.reply_to}</Row>
                    <Row k="Subject line">{full?.subject}</Row>
                    <Row k="Pre-header">{full?.preheader}</Row>
                  </>
                )}
                <Row k="Tags">{tags.length ? tags.map(t => <span className="cpp-tag" key={t}>{t}</span>) : null}</Row>
              </dl>
            </div>
          </div>

          <div className="cpp-card">
            <h3>Advance options</h3>
            <div>
              <dl style={{ margin: 0 }}>
                <Row k="Source (utm_source)">{full?.ga_source}</Row>
                <Row k="Medium (utm_medium)">{full?.ga_medium}</Row>
                <Row k="Campaign (utm_campaign)">{full?.ga_campaign}</Row>
                <Row k="Content (utm_content)">{full?.ga_content}</Row>
                <Row k="Term (utm_term)">{full?.ga_term}</Row>
              </dl>
              {!full?.ga_source && <p className="cpp-none">Link tagging is off for this campaign.</p>}

              <div style={{ borderTop: '1px solid #f2f4f7', marginTop: 12, paddingTop: 10 }}>
                <dl style={{ margin: 0 }}>
                  <Row k="Conversion goal">{row.goal_event_name ? 'On' : 'Off'}</Row>
                  <Row k="Conversion tracking">{row.goal_event_name}</Row>
                  <Row k="Conversion window">{full?.goal_window_days ? `${full.goal_window_days} days` : null}</Row>
                  <Row k="Revenue parameter">{full?.goal_revenue_param}</Row>
                </dl>
              </div>
            </div>
          </div>

          <div className="cpp-card">
            <h3>Audience</h3>
            <div>
              <dl style={{ margin: 0 }}>
                <Row k="Audience type">{full?.audience_type}</Row>
                <Row k="Segments / lists" mono>{asList(full?.segment_ids).join(', ') || null}</Row>
                <Row k="Lists" mono>{asList(full?.list_ids).join(', ') || null}</Row>
                <Row k="Excluded" mono>{asList(full?.exclude_segment_ids).join(', ') || null}</Row>
                <Row k="Domain filter">{full?.domain_filter}</Row>
                <Row k="Total published" mono>{n0(row.published)}</Row>
                {isWa && <Row k="Skipped as duplicate" mono>{n0(full?.skipped_dedup_count)}</Row>}
              </dl>
            </div>
          </div>

          <div className="cpp-card">
            <h3>Schedule</h3>
            <div>
              <dl style={{ margin: 0 }}>
                <Row k="When to send">{full?.schedule_type === 'schedule' ? 'Scheduled' : 'Send now'}</Row>
                <Row k="Scheduled for">{fmtDt(full?.scheduled_at)}</Row>
                <Row k="Started">{fmtDt(full?.started_at)}</Row>
                <Row k="Completed">{fmtDt(full?.completed_at)}</Row>
                <Row k="Created">{fmtDt(full?.created_at)}</Row>
              </dl>
            </div>
          </div>
        </div>

        <div className="cpp-card">
          <h3>Content</h3>
          <div>
            {loading && <p className="cpp-none">Loading content…</p>}

            {!loading && isWa && (
              <div className="cpp-wa">
                <div className="cpp-bubble">{full?.body_text || 'No body stored for this template.'}</div>
                {/* Same defensiveness as the id lists above: `buttons` is stored JSON and is not
                    guaranteed to decode to an array. */}
                {asList(full?.buttons).length > 0 && (
                  <div className="cpp-btnrow">
                    {asList(full?.buttons).map((b, i) => (
                      <div className="cpp-wabtn" key={i}>
                        {(typeof b === 'object' ? (b.text || b.label) : b) || 'Button'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && !isWa && (
              full?.content_html
                /* sandbox with no allow-scripts: a stored campaign body is not trusted markup,
                   and a preview must never let it run anything in the panel's origin. */
                ? <div className="cpp-frame"><iframe title="Email preview" sandbox srcDoc={full.content_html} /></div>
                : <p className="cpp-none">No template content stored for this campaign.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
