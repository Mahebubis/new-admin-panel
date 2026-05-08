import { useState } from 'react';
import MetaAdsDashboardOld from './MetaOld';
import AnalyticsDashboard from './AnalyticsDashboard';

export default function MetaAdsNew() {
  const [active, setActive] = useState('realtime');

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .mat-root * { box-sizing: border-box; }
        .mat-tab {
          position: relative;
          padding: 17px 32px;
          border: none;
          background: transparent;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #718096;
          cursor: pointer;
          letter-spacing: .3px;
          transition: color .25s;
          white-space: nowrap;
        }
        .mat-tab::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          transform: scaleX(0);
          transition: transform .3s cubic-bezier(.4,0,.2,1);
          border-radius: 3px 3px 0 0;
        }
        .mat-tab:hover { color: #667eea; background: rgba(102,126,234,.05); }
        .mat-tab.active { color: #667eea; }
        .mat-tab.active::after { transform: scaleX(1); }
        @keyframes mat_fadein {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .mat-panel { animation: mat_fadein .28s ease; }
      `}</style>

      <div className="mat-root" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 62px)', overflow:'hidden' }}>

        {/* ── TAB BAR ── */}
        <div style={{
          background: 'rgba(255,255,255,.98)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 30px rgba(0,0,0,.10)',
          flexShrink: 0,
          zIndex: 100,
        }}>
          <div style={{ display:'flex', padding:'0 20px', gap:4 }}>
            {[
              { key:'realtime',  icon:'📊', label:'Real Time Reports'   },
              { key:'analytics', icon:'📈', label:'Analytics Dashboard' },
            ].map(t => (
              <button
                key={t.key}
                className={`mat-tab${active===t.key?' active':''}`}
                onClick={() => setActive(t.key)}
              >
                <span style={{ marginRight:8, fontSize:15 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── PANELS ── */}
        <div className="mat-panel" key={active} style={{ flex:1, minHeight:0, overflow: active === 'analytics' ? 'auto' : 'hidden' }}>
          {active === 'realtime'  && <MetaAdsDashboardOld  />}
          {active === 'analytics' && <AnalyticsDashboard />}
        </div>

      </div>
    </>
  );
}