import { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from "react-helmet-async";

const API = 'https://cit3.internshipstudio.com/admin/react-api/api/settings/aws_instance.php';
const post = d => fetch(API, { method: 'POST', body: new URLSearchParams(d) }).then(r => r.json());
const USD_INR = 84.07;

/* ─── static instance type definitions ─── */
// const INSTANCE_TYPES = [
//     { type: 't3.2xlarge', cpu: 8, mem: 32, price: 0.3328, tier: 'Starter', icon: '🌱', color: '#E53E3E', bg: '#FFF5F5', shadow: 'rgba(229,62,62,.35)' },
//     { type: 'm5.4xlarge', cpu: 16, mem: 64, price: 0.768, tier: 'Growth', icon: '🚀', color: '#0891B2', bg: '#ECFEFF', shadow: 'rgba(8,145,178,.3)' },
//     { type: 'm5.8xlarge', cpu: 32, mem: 128, price: 1.536, tier: 'Scale', icon: '⚡', color: '#7C3AED', bg: '#F5F3FF', shadow: 'rgba(124,58,237,.3)' },
//     { type: 'm5.16xlarge', cpu: 64, mem: 256, price: 3.072, tier: 'Enterprise', icon: '👑', color: '#D97706', bg: '#FFFBEB', shadow: 'rgba(217,119,6,.3)' },
// ];



const INSTANCE_TYPES = [
    { type: 't3.xlarge', cpu: 4, mem: 16, price: 0.1664, tier: 'Lite', icon: '🌿', color: '#059669', bg: '#ECFDF5', shadow: 'rgba(5,150,105,.3)' },
    { type: 't3.2xlarge', cpu: 8, mem: 32, price: 0.3328, tier: 'Starter', icon: '🌱', color: '#E53E3E', bg: '#FFF5F5', shadow: 'rgba(229,62,62,.35)' },
    { type: 'm5.4xlarge', cpu: 16, mem: 64, price: 0.768, tier: 'Growth', icon: '🚀', color: '#0891B2', bg: '#ECFEFF', shadow: 'rgba(8,145,178,.3)' },
    { type: 'm5.8xlarge', cpu: 32, mem: 128, price: 1.536, tier: 'Scale', icon: '⚡', color: '#7C3AED', bg: '#F5F3FF', shadow: 'rgba(124,58,237,.3)' },
    { type: 'm5.16xlarge', cpu: 64, mem: 256, price: 3.072, tier: 'Enterprise', icon: '👑', color: '#D97706', bg: '#FFFBEB', shadow: 'rgba(217,119,6,.3)' },
];

/* ─── format INR ─── */
const inr = (n) => `₹${parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ═══════════════════════════════════
   INSTANCE CARD
═══════════════════════════════════ */
function InstanceCard({ inst, isCurrent, isPending, isChanging, onSelect }) {
    const [hovered, setHovered] = useState(false);
    const priceInr = inst.price * USD_INR;

    /* ── 3D perspective scale matching PHP CSS ── */
    const getTransform = () => {
        if (isCurrent) return 'scale(1.12)';
        if (hovered) return 'translateY(-8px) scale(0.9)';
        return 'scale(0.82)';
    };
    const getOpacity = () => (isCurrent || hovered) ? 1 : 0.6;
    const getBlur = () => (!isCurrent && !hovered) ? 'blur(0.8px)' : 'none';
    const getZIndex = () => isCurrent ? 10 : hovered ? 3 : 1;
    const getShadow = () => {
        if (isCurrent) return `0 25px 70px rgba(0,0,0,.35)`;
        if (hovered) return `0 12px 32px rgba(0,0,0,.12)`;
        return '0 1px 6px rgba(0,0,0,.05)';
    };
    const getBorder = () => {
        if (isCurrent) return `2.5px solid ${inst.color}`;
        if (isPending) return '2.5px solid #F59E0B';
        if (hovered) return `2px solid ${inst.color}`;
        return '2px solid #E2E8F0';
    };
    const getBg = () => {
        if (isCurrent) return inst.bg;
        if (isPending) return '#FFFBEB';
        return '#fff';
    };

    return (
        <div
            style={{
                borderRadius: 16, padding: 16, cursor: isCurrent ? 'default' : 'pointer',
                background: getBg(), border: getBorder(),
                transform: getTransform(), opacity: getOpacity(),
                filter: getBlur(), zIndex: getZIndex(),
                boxShadow: getShadow(), position: 'relative', overflow: 'hidden',
                transition: 'all .35s cubic-bezier(.4,0,.2,1)',
            }}
            onMouseEnter={() => !isCurrent && setHovered(true)}
            onMouseLeave={() => setHovered(false)}>

            {/* top colour bar */}
            {(isCurrent || isPending) && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: isPending ? '#F59E0B' : inst.color, borderRadius: '16px 16px 0 0'
                }} />
            )}

            {/* head */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 17, flexShrink: 0,
                    background: isCurrent ? inst.color : inst.bg,
                    border: `1.5px solid ${isCurrent ? inst.color : inst.color + '55'}`,
                    color: isCurrent ? '#fff' : inst.color,
                    boxShadow: isCurrent ? `0 3px 12px ${inst.shadow}` : 'none'
                }}>
                    {inst.icon}
                </div>
                <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase',
                    padding: '3px 9px', borderRadius: 20,
                    background: isCurrent ? inst.color : inst.bg,
                    color: isCurrent ? '#fff' : inst.color,
                    border: `1.5px solid ${isCurrent ? inst.color : inst.color + '55'}`
                }}>
                    {inst.tier}
                </span>
            </div>

            {/* type name */}
            <div style={{
                fontFamily: 'JetBrains Mono,monospace', fontSize: 14, fontWeight: 700,
                color: '#0F172A', marginBottom: 2
            }}>{inst.type}</div>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 11 }}>Amazon EC2 · {inst.tier} Tier</div>

            {/* specs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {[
                    { v: inst.cpu, k: 'vCPUs' },
                    { v: inst.mem, k: 'GiB RAM' },
                    { v: `$${inst.price}`, k: 'USD/hr' },
                ].map(s => (
                    <div key={s.k} style={{
                        flex: 1, background: isCurrent ? '#fff' : '#F8FAFC',
                        borderRadius: 8, padding: '6px 4px', textAlign: 'center',
                        border: `1.5px solid ${isCurrent ? inst.color + '55' : '#E2E8F0'}`
                    }}>
                        <div style={{
                            fontFamily: 'JetBrains Mono,monospace', fontSize: 12, fontWeight: 700,
                            color: '#1E293B'
                        }}>{s.v}</div>
                        <div style={{ fontSize: 8, color: '#64748B', marginTop: 2, fontWeight: 600 }}>{s.k}</div>
                    </div>
                ))}
            </div>

            {/* footer */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <div style={{
                        fontFamily: 'JetBrains Mono,monospace', fontSize: 13, fontWeight: 700,
                        color: inst.color
                    }}>{inr(priceInr)}/hr</div>
                    <div style={{ fontSize: 9, color: '#64748B', marginTop: 2, fontWeight: 600 }}>
                        ~{inr(priceInr * 24 * 30)}/mo
                    </div>
                </div>
                {isCurrent ? (
                    <button style={{
                        padding: '7px 13px', borderRadius: 8, border: `1.5px solid ${inst.color + '55'}`,
                        background: inst.bg, color: inst.color, fontSize: 11, fontWeight: 700,
                        cursor: 'default', fontFamily: 'Sora,sans-serif', display: 'flex', alignItems: 'center', gap: 5
                    }}>
                        ✅ Active
                    </button>
                ) : isPending ? (
                    <button onClick={() => onSelect(inst)}
                        title="Change is stuck or still applying — click to retry"
                        style={{
                            padding: '7px 13px', borderRadius: 8, border: '1.5px solid #FCD34D',
                            background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'Sora,sans-serif', display: 'flex', alignItems: 'center', gap: 5
                        }}>
                        ⏳ Pending · ↻ Retry
                    </button>
                ) : (
                    <button onClick={() => onSelect(inst)}
                        style={{
                            padding: '7px 13px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700,
                            cursor: 'pointer', color: '#fff', fontFamily: 'Sora,sans-serif',
                            background: inst.color, boxShadow: `0 3px 10px ${inst.shadow}`,
                            display: 'flex', alignItems: 'center', gap: 5, transition: 'all .2s'
                        }}>
                        → Select
                    </button>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════ */
function ConfirmModal({ from, to, onConfirm, onCancel }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9998
        }} onClick={e => e.target === e.currentTarget && onCancel()}>
            <div style={{
                background: '#fff', borderRadius: 22, padding: '34px 38px', textAlign: 'center',
                border: '1.5px solid #E2E8F0', boxShadow: '0 24px 80px rgba(0,0,0,.18)',
                minWidth: 340, maxWidth: 400, width: '90%',
                animation: 'cfPop .32s cubic-bezier(.34,1.56,.64,1)'
            }}>
                <div style={{
                    width: 62, height: 62, borderRadius: 18, margin: '0 auto 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                    background: to.color, boxShadow: `0 6px 20px ${to.shadow}`, color: '#fff'
                }}>⇄</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                    Confirm Instance Change
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 1.6 }}>
                    You are switching from&nbsp;
                    <strong style={{ color: '#64748B', fontFamily: 'JetBrains Mono,monospace' }}>{from}</strong>
                    &nbsp;→&nbsp;
                    <strong style={{ color: to.color, fontFamily: 'JetBrains Mono,monospace' }}>{to.type}</strong>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBEB',
                    border: '1.5px solid #FCD34D', borderRadius: 10, padding: '10px 14px',
                    marginBottom: 24, fontSize: 12, color: '#92400E', fontWeight: 600, textAlign: 'left'
                }}>
                    ⚠️ Server will stop and restart. Expect <strong>&nbsp;3–5 minutes&nbsp;</strong> of downtime.
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onCancel}
                        style={{
                            flex: 1, padding: 12, borderRadius: 11, fontSize: 13, fontWeight: 700,
                            background: '#F1F5F9', color: '#475569', border: '1.5px solid #CBD5E1',
                            cursor: 'pointer', fontFamily: 'Sora,sans-serif', transition: 'all .18s'
                        }}>
                        ✕ Cancel
                    </button>
                    <button onClick={onConfirm}
                        style={{
                            flex: 1, padding: 12, borderRadius: 11, fontSize: 13, fontWeight: 700,
                            background: to.color, color: '#fff', border: 'none',
                            cursor: 'pointer', fontFamily: 'Sora,sans-serif',
                            boxShadow: `0 4px 14px ${to.shadow}`, transition: 'all .18s'
                        }}>
                        ⚡ Yes, Switch Now!
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════
   LOADING OVERLAY  (3 animated steps)
═══════════════════════════════════ */
function LoadingOverlay({ step }) {
    const steps = [
        { id: 1, label: 'Stopping current instance…', icon: '⏹' },
        { id: 2, label: 'Changing instance type…', icon: '⇄' },
        { id: 3, label: 'Restarting instance…', icon: '▶' },
    ];
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                background: '#fff', borderRadius: 22, padding: '36px 44px', textAlign: 'center',
                border: '1.5px solid #E2E8F0', boxShadow: '0 24px 80px rgba(0,0,0,.18)',
                minWidth: 320, animation: 'cfPop .35s cubic-bezier(.34,1.56,.64,1)'
            }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 5 }}>
                    Changing Instance Type
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 26 }}>Please keep this window open</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 26 }}>
                    {['#E53E3E', '#0891B2', '#7C3AED'].map((c, i) => (
                        <div key={i} style={{
                            width: 13, height: 13, borderRadius: '50%', background: c,
                            animation: `ldBounce 1.35s ease-in-out ${i * .22}s infinite`
                        }} />
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {steps.map(s => {
                        const isDoing = step === s.id;
                        const isDone = step > s.id;
                        return (
                            <div key={s.id} style={{
                                display: 'flex', alignItems: 'center', gap: 9,
                                padding: '9px 13px', borderRadius: 9, fontSize: 12, fontWeight: isDoing || isDone ? 700 : 500,
                                background: isDone ? '#ECFDF5' : isDoing ? '#EFF6FF' : '#F8FAFC',
                                color: isDone ? '#065F46' : isDoing ? '#1D4ED8' : '#64748B',
                                border: `1.5px solid ${isDone ? '#6EE7B7' : isDoing ? '#BFDBFE' : '#E2E8F0'}`,
                                transition: 'all .4s'
                            }}>
                                <span style={{ fontSize: 13, flexShrink: 0 }}>{isDone ? '✅' : isDoing ? s.icon : s.icon}</span>
                                {s.label}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════ */
export default function AWSInstanceManager() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [confirm, setConfirm] = useState(null);  // inst object
    const [upgrading, setUpgrading] = useState(false);
    const [step, setStep] = useState(0);
    const [toast, setToast] = useState(false);
    const [uptimeFmt, setUptimeFmt] = useState('00:00:00');
    const timerRef = useRef(null);
    const secRef = useRef(0);

    /* ── load data ── */
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await post({ action: 'get_data' });
            if (res.success) {
                setData(res);
                secRef.current = res.uptime_sec || 0;
                setUptimeFmt(res.uptime_fmt);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    /* ── live uptime ticker ── */
    useEffect(() => {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            secRef.current += 1;
            const s = secRef.current;
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = s % 60;
            setUptimeFmt(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`);
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [data]);

    /* ── do upgrade ── */
    const showSuccessToast = () => {
        setToast(true);
        setTimeout(() => { setToast(false); loadData(); }, 6000);
    };

    const doUpgrade = async () => {
        if (!confirm) return;
        const targetType = confirm.type;
        setConfirm(null);
        setUpgrading(true);
        setStep(1);

        // Animate steps: 1 → 2 → 3
        setTimeout(() => setStep(2), 7000);
        setTimeout(() => setStep(3), 14000);

        let res = null;
        let requestFailed = false;
        try {
            res = await post({ action: 'upgrade_instance', instanceType: targetType });
        } catch (e) {
            // fetch/JSON parsing failed (eg. proxy timeout returning an HTML page) —
            // the request may still have been recorded server-side, so don't assume failure.
            requestFailed = true;
        }

        setTimeout(async () => {
            setUpgrading(false);
            setStep(0);

            if (res && res.success) {
                showSuccessToast();
                return;
            }

            if (requestFailed) {
                try {
                    const check = await post({ action: 'get_data' });
                    if (check.success && check.latest_type === targetType) {
                        showSuccessToast();
                        return;
                    }
                } catch (_) { /* fall through to error alert below */ }
            }

            alert('Error: ' + (res?.error || 'Instance change may not have been applied. Please check the current status and retry if needed.'));
        }, 21000); // show all 3 steps
    };

    /* ── cost with live hours ── */
    const liveCost = (() => {
        if (!data) return '₹0.00';
        const inst = INSTANCE_TYPES.find(t => t.type === data.current_type);
        if (!inst) return '₹0.00';
        const hrs = secRef.current / 3600;
        return inr(inst.price * USD_INR * (data.hours_running + hrs));
    })();

    /* ── styles ── */
    const statBorderLeft = (color) => ({
        background: '#fff', borderRadius: 12, padding: '13px 15px',
        border: '1.5px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
        position: 'relative', overflow: 'hidden',
    });

    return (
        <>
            <Helmet>
                <title>Change AWS Instance | Admin Panel</title>
            </Helmet>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        .aim-root * { box-sizing:border-box; }
        .aim-root { font-family:'Sora',sans-serif; }
        @keyframes dpulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.7);}}
        @keyframes cfPop{from{transform:scale(.82);opacity:0;}to{transform:scale(1);opacity:1;}}
        @keyframes ldBounce{0%,80%,100%{transform:translateY(0) scale(.6);opacity:.3;}40%{transform:translateY(-14px) scale(1.1);opacity:1;}}
        @keyframes toastUp{from{transform:translate(-50%,16px);opacity:0;}to{transform:translate(-50%,0);opacity:1;}}
        @keyframes imFadeUp{to{opacity:1;transform:translateY(0);}}
        .aim-fade{opacity:0;transform:translateY(12px);animation:imFadeUp .45s ease forwards;}
        .aim-fade:nth-child(1){animation-delay:.05s;}
        .aim-fade:nth-child(2){animation-delay:.1s;}
        .aim-fade:nth-child(3){animation-delay:.15s;}
        .aim-fade:nth-child(4){animation-delay:.2s;}
      `}</style>

            <div className="aim-root" style={{
                background: '#F1F5F9', borderRadius: 20, padding: 18,
                display: 'flex', flexDirection: 'column', gap: 14,
                minHeight: 'calc(100vh - 62px)', overflow: 'auto'
            }}>

                {/* ══ TOP BAR ══ */}
                <div className="aim-fade" style={{
                    background: '#fff', borderRadius: 14, padding: '13px 18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: '1.5px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,.06)', flexWrap: 'wrap', gap: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, color: '#fff', boxShadow: '0 4px 14px rgba(79,70,229,.35)'
                        }}>🖥</div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', letterSpacing: '-.3px' }}>
                                AWS Instance Manager
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                ap-south-1 (Mumbai) · {data?.instance_id || 'i-01b582d1fcf4dae87'}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* changing badge */}
                        {data?.is_changing && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                                borderRadius: 8, background: '#FFFBEB', border: '1.5px solid #F59E0B',
                                fontSize: 11, fontWeight: 600, color: '#92400E', fontFamily: 'JetBrains Mono,monospace'
                            }}>
                                ⚙️ {data.current_type} → {data.latest_type}
                            </div>
                        )}
                        {/* active pill */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '7px 15px',
                            borderRadius: 30, background: '#ECFDF5', border: '1.5px solid #6EE7B7',
                            fontSize: 12, fontWeight: 700, color: '#065F46', fontFamily: 'JetBrains Mono,monospace'
                        }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%', background: '#10B981', flexShrink: 0,
                                animation: 'dpulse 2s ease-in-out infinite'
                            }} />
                            {data?.latest_type || 'Loading…'}
                        </div>
                    </div>
                </div>

                {/* ══ STATS ROW ══ */}
                <div className="aim-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                    {[
                        { color: '#E53E3E', icon: '💻', label: 'Current Instance', val: loading ? '…' : (data?.current_type || 'Error'), mono: true },
                        { color: '#0891B2', icon: '📅', label: 'Running Since', val: loading ? '…' : (data?.latest_ts_alt || '—'), sm: true },
                        { color: '#7C3AED', icon: '⏱', label: 'Uptime', val: uptimeFmt, mono: true },
                        { color: '#D97706', icon: '₹', label: 'Estimated Cost', val: loading ? '…' : liveCost, mono: true },
                    ].map((s, i) => (
                        <div key={i} style={{ ...statBorderLeft(s.color) }}>
                            <div style={{
                                position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
                                background: s.color, borderRadius: '12px 0 0 12px'
                            }} />
                            <div style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase',
                                color: '#64748B', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5
                            }}>
                                {s.icon} {s.label}
                            </div>
                            <div style={{
                                fontFamily: s.mono ? 'JetBrains Mono,monospace' : 'Sora,sans-serif',
                                fontSize: s.sm ? 12 : 15, fontWeight: 700, color: s.color, lineHeight: 1.2
                            }}>
                                {s.val}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ══ INSTANCE CARDS ══ */}
                {/* <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12,
                    alignItems: 'center', padding: '14px 8px'
                }}> */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12,
                    alignItems: 'center', padding: '14px 8px'
                }}>
                    {INSTANCE_TYPES.map(inst => {
                        const isCurrent = data?.current_type === inst.type;
                        const isPending = data?.latest_type === inst.type && data?.is_changing;
                        return (
                            <div key={inst.type} className="aim-fade">
                                <InstanceCard
                                    inst={inst}
                                    isCurrent={isCurrent}
                                    isPending={isPending}
                                    isChanging={data?.is_changing}
                                    onSelect={setConfirm} />
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* ══ CONFIRM MODAL ══ */}
            {confirm && (
                <ConfirmModal
                    from={data?.current_type}
                    to={confirm}
                    onConfirm={doUpgrade}
                    onCancel={() => setConfirm(null)} />
            )}

            {/* ══ LOADING OVERLAY ══ */}
            {upgrading && <LoadingOverlay step={step} />}

            {/* ══ SUCCESS TOAST ══ */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9998, background: '#fff', border: '2px solid #10B981', borderRadius: 14,
                    padding: '12px 22px', fontSize: 13, fontWeight: 700, color: '#065F46',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: '0 8px 30px rgba(16,185,129,.2)', whiteSpace: 'nowrap',
                    animation: 'toastUp .3s ease'
                }}>
                    ✅ Instance change initiated! Refreshing data in 6 seconds…
                </div>
            )}
        </>
    );
}