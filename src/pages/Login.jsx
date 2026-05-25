// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';
// import toast from 'react-hot-toast';
// import { Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';

// export default function Login() {
//   const [step, setStep] = useState('login'); // login | otp
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [otp, setOtp] = useState('');
//   const [showPw, setShowPw] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [emailHint, setEmailHint] = useState('');
//   const { login, verifyOtp, resendOtp } = useAuth();
//   const navigate = useNavigate();

//   const handleLogin = async (e) => {
//     e.preventDefault();
//     if (!email || !password) { toast.error('Please fill in all fields'); return; }
//     setLoading(true);
//     try {
//       const res = await login(email, password);
//       if (res.success) {
//         const parts = email.split('@');
//         setEmailHint(parts[0].substring(0, 3) + '***@' + parts[1]);
//         setStep('otp');
//         toast.success('OTP sent to your email!');
//       } else {
//         toast.error(res.message || 'Invalid credentials');
//       }
//     } catch (err) {
//       toast.error(err.response?.data?.message || 'Something went wrong');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleVerify = async (e) => {
//     e?.preventDefault?.();
//     if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return; }
//     setLoading(true);
//     try {
//       const res = await verifyOtp(email, otp);
//       if (res.success) {
//         toast.success('Verified successfully!');
//         setTimeout(() => navigate('/'), 500);
//       } else {
//         toast.error(res.message || 'Invalid OTP');
//       }
//     } catch (err) {
//       toast.error(err.response?.data?.message || 'Something went wrong');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleResend = async () => {
//     try {
//       const res = await resendOtp(email);
//       toast.success(res.success ? 'New OTP sent!' : (res.message || 'Failed to resend'));
//     } catch {
//       toast.error('Something went wrong');
//     }
//   };

//   const handleOtpInput = (val) => {
//     const clean = val.replace(/\D/g, '').slice(0, 6);
//     setOtp(clean);
//     if (clean.length === 6) {
//       setTimeout(() => handleVerify(), 100);
//     }
//   };

//   if (step === 'otp') {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
//         <div className="bg-white rounded-xl p-10 w-full max-w-[400px] shadow-lg">
//           <div className="flex justify-center mb-5">
//             <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
//               <ShieldCheck className="w-7 h-7 text-indigo-600" />
//             </div>
//           </div>
//           <h2 className="text-xl font-bold text-gray-900 text-center mb-2">OTP Verification</h2>
//           <p className="text-sm text-gray-400 text-center mb-7">
//             Enter the 6-digit code sent to<br />
//             <strong className="text-gray-900">{emailHint}</strong>
//           </p>
//           <form onSubmit={handleVerify}>
//             <input
//               type="text"
//               value={otp}
//               onChange={(e) => handleOtpInput(e.target.value)}
//               maxLength={6}
//               placeholder="000000"
//               inputMode="numeric"
//               autoComplete="one-time-code"
//               className="w-full h-14 text-center text-3xl font-bold tracking-[14px] border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 mb-5 transition"
//             />
//             <button type="submit" disabled={loading}
//               className="w-full h-11 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
//               {loading ? 'Verifying...' : 'Verify OTP'}
//             </button>
//           </form>
//           <p className="text-sm text-gray-400 text-center mt-4">
//             Didn't receive the code?{' '}
//             <button onClick={handleResend} className="text-indigo-600 font-semibold hover:underline">Resend</button>
//           </p>
//           <p className="text-xs text-center mt-4">
//             <button onClick={() => setStep('login')} className="text-gray-400 hover:text-indigo-600">
//               ← Back to login
//             </button>
//           </p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
//       <div className="bg-white rounded-xl p-10 w-full max-w-[400px] shadow-lg">
//         <h2 className="text-xl font-bold text-gray-900 mb-1">Admin Login</h2>
//         <p className="text-sm text-gray-400 mb-7">Sign in to access the admin panel</p>
//         <form onSubmit={handleLogin}>
//           <div className="mb-4">
//             <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
//             <div className="relative">
//               <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//               <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
//                 placeholder="admin@internshipstudio.com" autoComplete="email"
//                 className="w-full h-11 pl-9 pr-3 border-[1.5px] border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition" />
//             </div>
//           </div>
//           <div className="mb-5">
//             <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
//             <div className="relative">
//               <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
//               <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
//                 placeholder="••••••••" autoComplete="current-password"
//                 className="w-full h-11 pl-9 pr-10 border-[1.5px] border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition" />
//               <button type="button" onClick={() => setShowPw(!showPw)}
//                 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
//                 {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
//               </button>
//             </div>
//           </div>
//           <button type="submit" disabled={loading}
//             className="w-full h-11 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
//             {loading ? 'Signing in...' : 'Sign In'}
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }












import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, ShieldCheck } from 'lucide-react';
import { Helmet } from "react-helmet-async";

export default function Login() {
  const [step, setStep] = useState('login'); // login | otp
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailHint, setEmailHint] = useState('');
  const { login, verifyOtp, resendOtp, loginDirect } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success) {
        // Bypass: backend returned a token directly (admin_users.bypass_otp = 1)
        if (res.data?.bypass && res.data?.token) {
          loginDirect(res.data);
          toast.success('Welcome back!');
          setTimeout(() => navigate('/'), 300);
          return;
        }
        const parts = email.split('@');
        setEmailHint(parts[0].substring(0, 3) + '***@' + parts[1]);
        setStep('otp');
        toast.success('OTP sent to your email!');
      } else {
        toast.error(res.message || 'Invalid credentials');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
    finally {
      setLoading(false);
    }
  };

  const handleVerify = async (otpValue) => {
    // Accept otpValue from caller so we don't depend on stale state
    const code = (otpValue ?? otp) + '';
    if (loading) return;
    if (code.length !== 6) return; // silent — no toast

    setLoading(true);
    setOtpError('');
    try {
      const res = await verifyOtp(email, code);
      if (res.success) {
        toast.success('Verified successfully!');
        setTimeout(() => navigate('/'), 400);
      } else {
        const msg = 'Wrong OTP. Please try again.';
        setOtpError(msg);
        toast.error(msg);
        setOtp('');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Wrong OTP. Please try again.';
      setOtpError(msg);
      toast.error(msg);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await resendOtp(email);
      if (res.success) {
        toast.success('New OTP sent!');
        setOtpError('');
        setOtp('');
      } else {
        toast.error(res.message || 'Failed to resend');
      }
    } catch {
      toast.error('Something went wrong');
    }
  };

  const handleOtpInput = (val) => {
    const clean = val.replace(/\D/g, '').slice(0, 6);
    setOtp(clean);
    if (otpError) setOtpError('');
    if (clean.length === 6) {
      // Auto-verify once the 6th digit is entered — pass the value directly
      setTimeout(() => handleVerify(clean), 80);
    }
  };

  if (step === 'otp') {
    return (
      <><Helmet>
        <title>OTP Page | Admin Panel</title>
      </Helmet>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-10 w-full max-w-[400px] shadow-lg">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-indigo-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">OTP Verification</h2>
          <p className="text-sm text-gray-400 text-center mb-7">
            Enter the 6-digit code sent to<br />
            <strong className="text-gray-900">{emailHint}</strong>
          </p>
          <form onSubmit={(e) => { e.preventDefault(); handleVerify(otp); }}>
            <input
              type="text"
              value={otp}
              onChange={(e) => handleOtpInput(e.target.value)}
              maxLength={6}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={loading}
              className={`w-full h-14 text-center text-3xl font-bold tracking-[14px] border-2 rounded-xl bg-gray-50 text-gray-900 outline-none focus:ring-4 mb-2 transition
                ${otpError
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                  : 'border-gray-200 focus:border-indigo-600 focus:ring-indigo-600/10'}`}
            />
            {otpError && (
              <div className="text-[12.5px] text-red-500 font-medium text-center mb-3 flex items-center justify-center gap-1.5">
                <i className="fas fa-circle-exclamation text-[11px]" />
                {otpError}
              </div>
            )}
            {!otpError && <div className="mb-3" />}
            <button type="submit" disabled={loading || otp.length !== 6}
              className="w-full h-11 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
          <p className="text-sm text-gray-400 text-center mt-4">
            Didn't receive the code?{' '}
            <button onClick={handleResend} className="text-indigo-600 font-semibold hover:underline">Resend</button>
          </p>
          <p className="text-xs text-center mt-4">
            <button onClick={() => { setStep('login'); setOtp(''); setOtpError(''); }} className="text-gray-400 hover:text-indigo-600">
              ← Back to login
            </button>
          </p>
        </div>
      </div>
      </>
    );
  }

  return (
    <><Helmet>
        <title>login Page | Admin Panel</title>
      </Helmet>
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-10 w-full max-w-[400px] shadow-lg">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Admin Login</h2>
        <p className="text-sm text-gray-400 mb-7">Sign in to access the admin panel</p>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@internshipstudio.com" autoComplete="email"
                className="w-full h-11 pl-9 pr-3 border-[1.5px] border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition" />
            </div>
          </div>
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                className="w-full h-11 pl-9 pr-10 border-[1.5px] border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-900 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full h-11 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}