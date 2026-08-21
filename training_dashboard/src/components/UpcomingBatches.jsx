// ===========================================================================
//  UpcomingBatches.jsx — what they have paid for but cannot open yet.
//
//  Two different waits land here, and telling them apart is the whole point:
//
//    reason 'batch'   the course exists, the batch has not begun — shows the
//                     date it opens
//    reason 'course'  the batch has begun, but no course has been built for
//                     that purchase yet — shows "being prepared"
//
//  Before this list existed, both cases simply vanished: a learner with six
//  paid internships saw an empty portal and no reason for it.
//
//  Deliberately not clickable. There is nothing behind these yet, and a card
//  that navigates nowhere is worse than one that plainly says "not yet".
// ===========================================================================
import React from 'react';
import './upcoming.css';

/* The stored batch is already human text — "24th August, 2026" — so it is
   shown as written rather than reformatted. starts_on is the parsed ISO date
   and is only used for the countdown. */
function countdown(days) {
  if (days === null || days === undefined) return null;
  if (days <= 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  if (days < 7) return `In ${days} days`;
  const w = Math.round(days / 7);
  return w === 1 ? 'In about a week' : `In about ${w} weeks`;
}

export default function UpcomingBatches({ items = [], title = 'Starting soon' }) {
  if (!items.length) return null;

  const waitingOnUs = items.filter((i) => i.reason === 'course').length;

  return (
    <section className="upc">
      <div className="upc-head">
        <h2 className="upc-title">{title}</h2>
        <span className="upc-count">{items.length}</span>
      </div>
      <p className="upc-sub">
        You already own these — each opens on the day its batch begins.
        {waitingOnUs > 0 && ' A few are still being prepared by our team.'}
      </p>

      <div className="upc-grid">
        {items.map((it) => {
          const pending = it.reason === 'course';
          const when = countdown(it.days_to_go);
          return (
            <article className={`upc-card${pending ? ' is-pending' : ''}`} key={`${it.name}-${it.reason}`}>
              <div className="upc-thumb">
                {it.thumbnail_url
                  ? <img src={it.thumbnail_url} alt="" loading="lazy" />
                  : <span>{(it.name || '?').charAt(0)}</span>}
                <span className="upc-lock" aria-hidden="true">{pending ? '🛠️' : '🔒'}</span>
              </div>

              <div className="upc-body">
                <div className="upc-name" title={it.name}>{it.name}</div>

                {pending ? (
                  <div className="upc-when">Course is being prepared</div>
                ) : (
                  <div className="upc-when">
                    Batch starts <b>{it.batch}</b>
                  </div>
                )}

                <span className={`upc-chip${pending ? ' pending' : ''}`}>
                  {pending ? 'Coming soon' : (when || 'Date to be announced')}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
