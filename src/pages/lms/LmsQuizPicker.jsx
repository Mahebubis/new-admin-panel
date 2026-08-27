// ===========================================================================
//  LmsQuizPicker.jsx — "which quiz goes on this lesson?"
//
//  This replaced a bare <select> of every quiz in the school. Once a few
//  internships each have their own set of quizzes, that list is dozens of
//  near-identical titles ("Module 1", "Final test", "quiz test") with nothing
//  on the row to say which internship each belongs to — so binding the right
//  one meant opening the Quizzes tab in another window and matching by eye.
//
//  Two things fix that, and they are both here:
//    • every quiz row is badged with the internship it was created under
//      (lms_courses.internship_name, falling back to the course title), and
//    • a searchable internship filter narrows the list to one domain, which
//      is how an admin actually thinks about it — "show me the Data Analytics
//      quizzes", not "show me quizzes 40 to 60".
//
//  Written as a listbox rather than a <select> because a native option can
//  only hold text: the badges, the draft warning and the question count all
//  need real markup. Same focus/keyboard contract as LmsCombobox, which is
//  reused as-is for the internship filter above it.
// ===========================================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search, HelpCircle } from 'lucide-react';
import LmsCombobox from './LmsCombobox';

/* Quizzes created with "Standalone (not tied to a course)" have no course and
   therefore no internship. They still have to be pickable, so they get their
   own bucket instead of being dropped from the filter entirely. */
const STANDALONE = 'Not tied to an internship';

const domainOf = (q) => (q.domain || '').trim() || STANDALONE;

export default function LmsQuizPicker({
  quizzes = [],
  value = 0,
  onChange,
  /* The internship of the course this lesson lives in — floated to the top of
     the filter, because nine times out of ten that is the one being picked. */
  preferredDomain = '',
}) {
  const [domain, setDomain] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => quizzes.map(q => ({
    id: Number(q.id),
    title: q.title || 'Untitled quiz',
    status: q.status,
    questionCount: Number(q.question_count || 0),
    domain: domainOf(q),
  })), [quizzes]);

  /* Only internships that actually have a quiz — offering all 31 when four of
     them have quizzes just makes the admin click through empty lists. */
  const domainOptions = useMemo(() => {
    const names = [...new Set(items.map(it => it.domain))];
    const hasPreferred = !!preferredDomain && names.includes(preferredDomain);
    const rest = names
      .filter(n => n !== preferredDomain && n !== STANDALONE)
      .sort((a, b) => a.localeCompare(b));

    /* Pre-sorted by group: LmsCombobox prints a heading whenever the group
       changes, so an unsorted list would print the same heading twice. */
    const out = [];
    if (hasPreferred) out.push({ name: preferredDomain, group: 'This course' });
    for (const n of rest) out.push({ name: n, group: hasPreferred ? 'Other internships' : 'Internships' });
    if (names.includes(STANDALONE)) out.push({ name: STANDALONE, group: 'Unlinked' });
    return out;
  }, [items, preferredDomain]);

  const inDomain = useMemo(
    () => (domain ? items.filter(it => it.domain === domain) : items),
    [items, domain]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inDomain;
    /* Same prefix-before-substring ranking as LmsCombobox. */
    const starts = [];
    const contains = [];
    for (const it of inDomain) {
      const t = it.title.toLowerCase();
      if (t.startsWith(q)) starts.push(it);
      else if (t.includes(q) || it.domain.toLowerCase().includes(q)) contains.push(it);
    }
    return [...starts, ...contains];
  }, [inDomain, query]);

  /* Group the rows by internship so the list reads as sets rather than one
     long run of titles. Skipped when a single domain is already selected —
     the heading would then repeat what the filter above it says. */
  const rows = useMemo(() => {
    const out = [];
    if (domain) {
      for (const it of filtered) out.push({ kind: 'option', item: it });
      return out;
    }
    const byDomain = new Map();
    for (const it of filtered) {
      if (!byDomain.has(it.domain)) byDomain.set(it.domain, []);
      byDomain.get(it.domain).push(it);
    }
    const names = [...byDomain.keys()].sort((a, b) => {
      if (a === preferredDomain) return -1;
      if (b === preferredDomain) return 1;
      if (a === STANDALONE) return 1;
      if (b === STANDALONE) return -1;
      return a.localeCompare(b);
    });
    for (const n of names) {
      out.push({ kind: 'group', name: n });
      for (const it of byDomain.get(n)) out.push({ kind: 'option', item: it });
    }
    return out;
  }, [filtered, domain, preferredDomain]);

  const pickable = rows.filter(r => r.kind === 'option');
  const active = pickable.length ? Math.min(cursor, pickable.length - 1) : 0;

  /* Looked up in the FULL list, not the filtered one: narrowing to another
     internship must not make the currently bound quiz look unset. */
  const selected = items.find(it => it.id === Number(value)) || null;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (id) => { onChange?.(Number(id)); setOpen(false); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!pickable.length) return;
      const next = e.key === 'ArrowDown' ? active + 1 : active - 1;
      setCursor((next + pickable.length) % pickable.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = pickable[active];
      if (hit) choose(hit.item.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  let pickIndex = -1;

  return (
    <>
      <div className="lms-field">
        <label className="lms-label">Internship / domain</label>
        <LmsCombobox
          options={domainOptions}
          value={domain}
          onChange={(v) => { setDomain(v); setCursor(0); }}
          placeholder="All internships"
          searchPlaceholder="Search internships…"
          emptyLabel="No internship has quizzes yet"
        />
        <p className="lms-help">
          {domain
            ? <>Showing the <b>{inDomain.length}</b> quiz{inDomain.length === 1 ? '' : 'zes'} created under <b>{domain}</b>.</>
            : <>Filters the quiz list below to one internship. Leave it empty to search all {items.length}.</>}
        </p>
      </div>

      <div className="lms-field">
        <label className="lms-label">Quiz<span className="req">*</span></label>

        <div className="lms-combo" ref={rootRef}>
          <button
            type="button"
            className={`lms-combo-control${open ? ' open' : ''}`}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => { setOpen(o => !o); setQuery(''); setCursor(0); }}
          >
            {selected ? (
              <span className="lms-qpick-picked">
                <span className="t">{selected.title}</span>
                {selected.domain !== STANDALONE && <span className="lms-pill blue">{selected.domain}</span>}
                {selected.status !== 'published' && <span className="lms-pill amber">Draft</span>}
              </span>
            ) : (
              <span className="lms-combo-value placeholder">Select a quiz…</span>
            )}
            <ChevronDown size={15} className="lms-combo-caret" />
          </button>

          {open && (
            <div className="lms-combo-pop">
              <div className="lms-combo-search">
                <Search size={14} />
                <input
                  ref={inputRef}
                  value={query}
                  placeholder={domain ? `Search ${domain} quizzes…` : 'Search quizzes…'}
                  onChange={e => { setQuery(e.target.value); setCursor(0); }}
                  onKeyDown={onKeyDown}
                />
              </div>

              <div className="lms-combo-list" ref={listRef} role="listbox">
                {rows.length === 0 && (
                  <div className="lms-combo-empty">
                    {domain
                      ? `No quiz under ${domain}${query ? ' matches that search' : ' yet'}`
                      : 'No quiz matches that search'}
                  </div>
                )}

                {rows.map((r, i) => {
                  if (r.kind === 'group') {
                    return <div className="lms-combo-group" key={`g${i}`}>{r.name}</div>;
                  }
                  pickIndex += 1;
                  const it = r.item;
                  const isActive = pickIndex === active;
                  const isSelected = it.id === Number(value);
                  return (
                    <button
                      type="button"
                      key={it.id}
                      role="option"
                      aria-selected={isSelected}
                      data-active={isActive ? '1' : '0'}
                      className={`lms-combo-item lms-qpick-item${isActive ? ' active' : ''}${isSelected ? ' selected' : ''}`}
                      onMouseEnter={() => setCursor(pickIndex)}
                      onClick={() => choose(it.id)}
                    >
                      <span className="lms-qpick-body">
                        <span className="lms-qpick-title">{it.title}</span>
                        <span className="lms-qpick-meta">
                          {/* The badge the whole change is for: which
                              internship this quiz was built for. */}
                          {it.domain !== STANDALONE
                            ? <span className="lms-pill blue">{it.domain}</span>
                            : <span className="lms-pill grey">Standalone</span>}
                          {it.status !== 'published' && <span className="lms-pill amber">Draft</span>}
                          <span className="lms-qpick-count">
                            <HelpCircle size={11} /> {it.questionCount} question{it.questionCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </span>
                      {isSelected && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
