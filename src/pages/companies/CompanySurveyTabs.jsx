import { useState } from 'react';
import EnrollmentSurvey from './SurveyQA';
import UserCollegeDetails from './TPODetails';

/**
 * Tabbed container for the "Survey Q & A" sidebar entry.
 *  - Tab 1: Enrollment Survey Q & A  (default active)
 *  - Tab 2: TPO & HOD Details
 *
 * Both panels stay mounted (toggled via CSS display) so switching tabs
 * keeps each panel's filters, page and loaded data intact.
 */
const TABS = [
  { key: 'survey', label: 'Survey Q & A', icon: '📋' },
  { key: 'tpo', label: 'TPO & HOD Details', icon: '🎓' },
];

export default function CompanySurveyTabs() {
  const [active, setActive] = useState('survey');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .cst-tabbar { font-family:'Plus Jakarta Sans',sans-serif; }
      `}</style>

      <div style={{ background: '#f0faf8', minHeight: 'calc(100vh - 62px)' }}>
        {/* ── TAB BAR ── */}
        <div className="cst-tabbar" style={{
          display: 'flex', gap: 8, padding: '14px 20px 0', background: '#f0faf8',
          position: 'sticky', top: 0, zIndex: 20, borderBottom: '1.5px solid #d4efeb'
        }}>
          {TABS.map(t => {
            const on = active === t.key;
            return (
              <button key={t.key} onClick={() => setActive(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 22px', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                  borderRadius: '10px 10px 0 0',
                  color: on ? '#fff' : '#5b7a75',
                  background: on
                    ? 'linear-gradient(135deg,#0d2137 0%,#164a3e 100%)'
                    : '#e3f1ee',
                  boxShadow: on ? '0 -2px 10px rgba(13,33,55,.18)' : 'none',
                  transform: on ? 'translateY(1.5px)' : 'none',
                  transition: 'background .15s, color .15s'
                }}>
                <span style={{ fontSize: 15 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── PANELS (kept mounted, toggled by display) ── */}
        <div style={{ display: active === 'survey' ? 'block' : 'none' }}>
          <EnrollmentSurvey />
        </div>
        <div style={{ display: active === 'tpo' ? 'block' : 'none' }}>
          <UserCollegeDetails />
        </div>
      </div>
    </>
  );
}
