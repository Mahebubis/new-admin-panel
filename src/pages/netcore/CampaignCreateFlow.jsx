import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SlideDrawer from './SlideDrawer';

/* ── small inline icon set (generic stroke icons, matches the rest of /netcore's style) ── */
const I = {
  engage: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 11l18-8-8 18-2-8-8-2z" /></svg>,
  analyze: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></svg>,
  template: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11" /></svg>,
  contacts: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  journey: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="6" width="6" height="6" rx="1" /><rect x="16" y="6" width="6" height="6" rx="1" /><path d="M8 9h8" /></svg>,
  email: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>,
  sms: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  bell: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>,
  whatsapp: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /></svg>,
  inapp: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 18h6" /></svg>,
  web: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></svg>,
  regular: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>,
  bolt: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>,
  split: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 9 15M14.5 4H20v5.5" /></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12" /></svg>,
  back: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="m15 18-6-6 6-6" /></svg>,
};

function Header({ title, onBack, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 22px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
      {onBack && (
        <button onClick={onBack} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#334155' }}>{I.back}</button>
      )}
      <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', flex: 1 }}>{title}</div>
      <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>{I.close}</button>
    </div>
  );
}

function OptionCard({ icon, label, desc, onClick, disabled, badge }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, textAlign: 'left',
        padding: '16px 16px', border: '1.5px solid #e2e8f0', borderRadius: 12, background: disabled ? '#f8fafc' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'border-color .15s, box-shadow .15s',
        fontFamily: 'inherit', width: '100%', position: 'relative',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = '#1e3a8a'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(30,58,138,.10)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}>
      {badge && <span style={{ position: 'absolute', top: 10, right: 10, background: '#f59e0b', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, letterSpacing: '.3px' }}>{badge}</span>}
      <span style={{ width: 40, height: 40, borderRadius: 10, background: disabled ? '#e2e8f0' : '#eef2ff', color: disabled ? '#94a3b8' : '#1e3a8a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: disabled ? '#94a3b8' : '#0f172a' }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>
    </button>
  );
}

function SmallTile({ icon, label, onClick, disabled }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '16px 8px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: disabled ? '#f8fafc' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, fontFamily: 'inherit', position: 'relative',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = '#1e3a8a'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; }}>
      <span style={{ color: disabled ? '#94a3b8' : '#1e3a8a' }}>{icon}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: disabled ? '#94a3b8' : '#334155', textAlign: 'center' }}>{label}</span>
      {disabled && <span style={{ fontSize: 8.5, fontWeight: 700, color: '#94a3b8', letterSpacing: '.3px' }}>COMING SOON</span>}
    </button>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94a3b8', letterSpacing: '.6px', margin: '18px 0 10px' }}>{children}</div>;
}

/**
 * Owns the 3-level "+ Create" drawer state machine:
 *   null → 'create' → 'channel' → 'emailtype' → navigate to /netcore/campaigns/new
 * Rendered from CampaignsList.jsx; `open`/`onClose` are controlled by the parent.
 */
export default function CampaignCreateFlow({ flow, setFlow }) {
  const nav = useNavigate();
  const close = () => setFlow(null);

  return (
    <SlideDrawer open={!!flow} onClose={close} width={flow === 'channel' ? 640 : 560}>
      {flow === 'create' && (
        <>
          <Header title="How would you like to start?" onClose={close} />
          <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, overflowY: 'auto' }}>
            <OptionCard icon={I.engage} label="Engage with users" desc="Create personalized campaigns and user journeys" onClick={() => setFlow('channel')} />
            <OptionCard icon={I.analyze} label="Analyze user behaviour" desc="Create funnels, cohorts, and RFM to measure performance" disabled />
            <OptionCard icon={I.template} label="Create template" desc="Customize reusable templates for your campaigns" onClick={() => { close(); nav('/netcore/templates/new'); }} />
            <OptionCard icon={I.contacts} label="Manage contacts" desc="Add contacts, import list or create segment" onClick={() => { close(); nav('/netcore/contacts'); }} />
          </div>
        </>
      )}

      {flow === 'channel' && (
        <>
          <Header title="How do you want to engage with your users?" onBack={() => setFlow('create')} onClose={close} />
          <div style={{ padding: 22, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 4 }}>
              <SmallTile icon={I.journey} label="Journey" disabled />
            </div>

            <SectionLabel>CAMPAIGNS</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <SmallTile icon={I.email} label="Email" onClick={() => setFlow('emailtype')} />
              <SmallTile icon={I.sms} label="SMS" disabled />
              <SmallTile icon={I.bell} label="App push" disabled />
              <SmallTile icon={I.bell} label="Web push" disabled />
              <SmallTile icon={I.whatsapp} label="WhatsApp" onClick={() => { close(); nav('/netcore/whatsapp/new'); }} />
              <SmallTile icon={I.sms} label="RCS" disabled />
            </div>

            <SectionLabel>ONSITE</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <SmallTile icon={I.inapp} label="In-app message" disabled />
              <SmallTile icon={I.web} label="Web message" disabled />
            </div>

            <SectionLabel>PERSONALIZED CONTENT</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <SmallTile icon={I.web} label="Web" disabled />
              <SmallTile icon={I.inapp} label="App" disabled />
            </div>
          </div>
        </>
      )}

      {flow === 'emailtype' && (
        <>
          <Header title="Which email would you like to create?" onBack={() => setFlow('channel')} onClose={close} />
          <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, overflowY: 'auto' }}>
            <OptionCard icon={I.regular} label="Regular campaign" desc="Send personalized email communications" onClick={() => { close(); nav('/netcore/campaigns/new'); }} />
            <OptionCard icon={I.bolt} label="AMP" desc="Send interactive emails to make two-way communication" disabled />
            <OptionCard icon={I.split} label="A/B campaign" desc="Send email variants to see which performs better" disabled />
            <OptionCard icon={I.split} label="Split campaign" desc="Split the delivery of multiple variants to find the best one" disabled />
          </div>
        </>
      )}
    </SlideDrawer>
  );
}
