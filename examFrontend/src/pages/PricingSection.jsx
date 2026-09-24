// import React, { useState } from 'react';

// const PricingSection = ({ onUnlockPremium }) => {
//     const [selectedPlan, setSelectedPlan] = useState(null);

//     const handleSelectPlan = (plan) => {
//         setSelectedPlan(plan);

//         if (plan === "premium") {
//             onUnlockPremium();
//         } else {
//             alert("You have selected the Free Plan");
//         }
//     };

//     const features = [
//         { name: 'Training modules', free: 'Basic only', premium: 'All unlocked' },
//         { name: 'Support', free: 'Community', premium: 'Priority & Mentorship' },
//         { name: 'Internship simulations', free: '1 project', premium: 'Unlimited' },
//         { name: 'Certificate', free: 'Basic', premium: 'Premium verified' },
//         { name: 'Priority job applications', free: false, premium: true },
//         { name: 'Live mentor sessions', free: false, premium: '10+ sessions' },
//         { name: 'Premium projects access', free: false, premium: true },
//         { name: 'Interview preparation kit', free: false, premium: true },
//     ];

//     return (
//         <div className="bg-gray-50 p-4">
//             {/* Background Ambience */}
//             <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
//                 <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full blur-[120px]"></div>
//                 <div className="absolute bottom-[20%] left-[-10%] w-[30rem] h-[30rem] bg-blue-100/40 rounded-full blur-[100px]"></div>
//             </div>

//             <section className="max-w-4xl mx-auto">
//                 {/* Header */}
//                 <div className="text-center mb-6">
//                     <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Choose Your Learning Path</h2>
//                     <p className="text-gray-600 text-sm">Unlock premium features at an exclusive price for iCAT qualified students</p>
//                 </div>

//                 {/* Mobile Side-by-Side Layout */}
//                 <div className="md:hidden">
//                     {/* Plan Headers */}
//                     <div className="grid grid-cols-2 gap-2 mb-3">
//                         {/* Free Header */}
//                         <div className="bg-white rounded-lg border border-gray-200 p-3 text-center shadow-sm">
//                             <h3 className="text-base font-bold text-gray-900 mb-1">Free</h3>
//                             <div className="mb-0.5">
//                                 <span className="text-2xl font-bold text-gray-900">₹0</span>
//                             </div>
//                             <p className="text-[10px] text-gray-500 font-medium">Forever</p>
//                         </div>

//                         {/* Premium Header */}
//                         <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3 text-center text-white shadow-lg relative">
//                             <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10">
//                                 <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-md whitespace-nowrap">
//                                     93% OFF
//                                 </div>
//                             </div>
//                             <div className="inline-block bg-white/20 px-1.5 py-0.5 rounded-full text-[9px] font-bold mb-1">
//                                 🏆 POPULAR
//                             </div>
//                             <h3 className="text-base font-bold mb-1">Premium</h3>
//                             <div className="mb-0.5 flex items-baseline justify-center gap-1">
//                                 <span className="text-xs line-through opacity-70">₹8,500</span>
//                                 <span className="text-2xl font-bold">₹590</span>
//                             </div>
//                             <p className="text-[10px] font-medium opacity-90">One-time</p>
//                         </div>
//                     </div>

//                     {/* Features Comparison */}
//                     <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-3">
//                         {features.map((feature, idx) => (
//                             <div key={idx} className={`grid grid-cols-2 gap-2 p-2 ${idx !== 0 ? 'border-t border-gray-100' : ''}`}>
//                                 {/* Free Column */}
//                                 <div className="flex flex-col gap-1">
//                                     {idx === 0 && <span className="text-[11px] font-semibold text-gray-900 mb-0.5">{feature.name}</span>}
//                                     {idx !== 0 && <span className="text-[11px] text-gray-700">{feature.name}</span>}
//                                     <div className="flex items-center gap-1">
//                                         {feature.free === false ? (
//                                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                                 <line x1="18" y1="6" x2="6" y2="18"></line>
//                                                 <line x1="6" y1="6" x2="18" y2="18"></line>
//                                             </svg>
//                                         ) : (
//                                             <>
//                                                 <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                                     <polyline points="20 6 9 17 4 12"></polyline>
//                                                 </svg>
//                                                 <span className="text-[10px] text-gray-600 font-medium">{feature.free}</span>
//                                             </>
//                                         )}
//                                     </div>
//                                 </div>

//                                 {/* Premium Column */}
//                                 <div className="bg-purple-50 rounded px-2 py-1 flex items-center gap-1">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span className="text-[10px] font-bold text-gray-900">
//                                         {feature.premium === true ? 'Included' : feature.premium}
//                                     </span>
//                                 </div>
//                             </div>
//                         ))}
//                     </div>

//                     {/* CTA Buttons */}
//                     <div className="grid grid-cols-2 gap-2 mb-3">
//                         <button
//                             onClick={() => handleSelectPlan('free')}
//                             className="py-2 bg-white border-2 border-gray-900 text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all"
//                         >
//                             Get Started
//                         </button>
//                         <button
//                             onClick={() => handleSelectPlan('premium')}
//                             className="py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1"
//                         >
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                 <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
//                                 <path d="M2 17l10 5 10-5"></path>
//                                 <path d="M2 12l10 5 10-5"></path>
//                             </svg>
//                             Unlock Now
//                         </button>
//                     </div>

//                     {/* iCAT Info */}
//                     <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
//                         <div className="flex items-start gap-1.5">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <circle cx="12" cy="12" r="10"></circle>
//                                 <path d="M12 16v-4"></path>
//                                 <path d="M12 8h.01"></path>
//                             </svg>
//                             <p className="text-[10px] text-gray-700 leading-relaxed">
//                                 <span className="font-bold text-purple-700">iCAT Special:</span> Save ₹7,910! Exclusive for qualified students.
//                             </p>
//                         </div>
//                     </div>
//                 </div>

//                 {/* Desktop Table Layout (hidden on mobile) */}
//                 <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
//                     {/* Header */}
//                     <div className="grid grid-cols-3 gap-0">
//                         <div className="p-4 border-r border-gray-100">
//                             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">FEATURES</h3>
//                         </div>
//                         <div className="p-4 text-center border-r border-gray-100 bg-gray-50">
//                             <h3 className="text-base font-bold text-gray-900 mb-2">Free</h3>
//                             <div className="mb-1">
//                                 <span className="text-3xl font-bold text-gray-900">₹0</span>
//                             </div>
//                             <p className="text-xs text-gray-500 font-medium">Forever</p>
//                         </div>
//                         <div className="p-4 pt-6 text-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white relative">
//                             <div className="absolute top-[4px] left-1/2 -translate-x-1/2 z-10">
//                                 <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
//                                     93% OFF
//                                 </div>
//                             </div>
//                             <div className="inline-block bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold mb-2">
//                                 🏆 MOST POPULAR
//                             </div>
//                             <h3 className="text-base font-bold mb-2">Premium</h3>
//                             <div className="mb-1 flex items-baseline justify-center gap-2">
//                                 <span className="text-sm line-through opacity-70">₹8,500</span>
//                                 <span className="text-3xl font-bold">₹590</span>
//                             </div>
//                             <p className="text-xs font-medium opacity-90">One-time payment</p>
//                         </div>
//                     </div>

//                     {/* Feature Rows */}
//                     {features.map((feature, idx) => (
//                         <div key={idx} className="grid grid-cols-3 gap-0 border-t border-gray-100">
//                             <div className="p-3 border-r border-gray-100 flex items-center">
//                                 <span className="text-sm font-medium text-gray-700">{feature.name}</span>
//                             </div>
//                             <div className="p-3 border-r border-gray-100 flex items-center justify-center bg-gray-50">
//                                 {feature.free === false ? (
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                         <line x1="18" y1="6" x2="6" y2="18"></line>
//                                         <line x1="6" y1="6" x2="18" y2="18"></line>
//                                     </svg>
//                                 ) : (
//                                     <span className="text-sm text-gray-700">{feature.free}</span>
//                                 )}
//                             </div>
//                             <div className="p-3 bg-purple-50 flex items-center justify-center">
//                                 <div className="flex items-center gap-2">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span className="text-sm font-bold text-gray-900">
//                                         {feature.premium === true ? 'Included' : feature.premium}
//                                     </span>
//                                 </div>
//                             </div>
//                         </div>
//                     ))}

//                     {/* CTA Buttons */}
//                     <div className="grid grid-cols-3 gap-0 border-t border-gray-200">
//                         <div className="p-4 border-r border-gray-100"></div>
//                         <div className="p-4 border-r border-gray-100 bg-gray-50">
//                             <button
//                                 onClick={() => handleSelectPlan('free')}
//                                 className="w-full py-2.5 bg-white border-2 border-gray-900 text-gray-900 text-sm font-bold rounded-lg hover:bg-gray-50 transition-all"
//                             >
//                                 Get Started Free
//                             </button>
//                         </div>
//                         <div className="p-4 bg-purple-50">
//                             <button
//                                 onClick={() => handleSelectPlan('premium')}
//                                 className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
//                             >
//                                 <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                     <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
//                                     <path d="M2 17l10 5 10-5"></path>
//                                     <path d="M2 12l10 5 10-5"></path>
//                                 </svg>
//                                 Unlock Premium
//                             </button>
//                         </div>
//                     </div>

//                     {/* iCAT Info */}
//                     <div className="bg-purple-50 border-t border-gray-100 p-3">
//                         <div className="flex items-start gap-2">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <circle cx="12" cy="12" r="10"></circle>
//                                 <path d="M12 16v-4"></path>
//                                 <path d="M12 8h.01"></path>
//                             </svg>
//                             <p className="text-xs text-gray-700 leading-relaxed">
//                                 <span className="font-bold text-purple-700">iCAT Qualified Special:</span> Save ₹7,910! This exclusive offer is available only for students who have qualified the iCAT exam.
//                             </p>
//                         </div>
//                     </div>
//                 </div>

//                 {/* Trust Badges */}
//                 <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
//                     <div className="flex items-center gap-1.5 text-gray-600">
//                         <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
//                             </svg>
//                         </div>
//                         <span className="font-medium">Secure Payment</span>
//                     </div>
//                     <div className="flex items-center gap-1.5 text-gray-600">
//                         <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
//                                 <circle cx="9" cy="7" r="4"></circle>
//                                 <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
//                                 <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
//                             </svg>
//                         </div>
//                         <span className="font-medium">5000+ Students</span>
//                     </div>
//                     <div className="flex items-center gap-1.5 text-gray-600">
//                         <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
//                             </svg>
//                         </div>
//                         <span className="font-medium">4.8/5 Rating</span>
//                     </div>
//                 </div>
//             </section>
//         </div>
//     );
// };

// export default PricingSection;














// import React, { useState } from 'react';

// const PricingSection = ({ onUnlockPremium }) => {
//     const [selectedPlan, setSelectedPlan] = useState(null);

//     const handleSelectPlan = (plan) => {
//         setSelectedPlan(plan);

//         if (plan === "premium") {
//             onUnlockPremium();
//         } else {
//             alert("You have selected the Free Plan");
//         }
//     };

//     const features = [
//         { name: 'Training modules', free: 'Basic only', premium: 'All unlocked' },
//         { name: 'Support', free: 'Community', premium: 'Priority & Mentorship' },
//         { name: 'Internship simulations', free: '1 project', premium: 'Unlimited' },
//         { name: 'Certificate', free: 'Basic', premium: 'Premium verified' },
//         { name: 'Priority job applications', free: false, premium: true },
//         { name: 'Live mentor sessions', free: false, premium: '10+ sessions' },
//         { name: 'Premium projects access', free: false, premium: true },
//         { name: 'Interview preparation kit', free: false, premium: true },
//     ];

//     return (
//         <div className="bg-gray-50 p-4">
//             <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
//                 <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full blur-[120px]"></div>
//                 <div className="absolute bottom-[20%] left-[-10%] w-[30rem] h-[30rem] bg-blue-100/40 rounded-full blur-[100px]"></div>
//             </div>

//             <section className="max-w-4xl mx-auto">
//                 <div className="text-center mb-6">
//                     <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Choose Your Learning Path</h2>
//                     <p className="text-gray-600 text-sm">Unlock premium features at an exclusive price for iCAT qualified students</p>
//                 </div>

//                 <div className="md:hidden">
//                     <div className="grid grid-cols-2 gap-2 mb-3">
//                         <div className="bg-white rounded-lg border border-gray-200 p-3 text-center shadow-sm">
//                             <h3 className="text-base font-bold text-gray-900 mb-1">Free</h3>
//                             <div className="mb-0.5">
//                                 <span className="text-2xl font-bold text-gray-900">₹0</span>
//                             </div>
//                             <p className="text-[10px] text-gray-500 font-medium">Forever</p>
//                         </div>

//                         <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3 text-center text-white shadow-lg relative">
//                             <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10">
//                                 <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-md whitespace-nowrap">
//                                     93% OFF
//                                 </div>
//                             </div>
//                             <div className="inline-block bg-white/20 px-1.5 py-0.5 rounded-full text-[9px] font-bold mb-1">
//                                 🏆 POPULAR
//                             </div>
//                             <h3 className="text-base font-bold mb-1">Premium</h3>
//                             <div className="mb-0.5 flex items-baseline justify-center gap-1">
//                                 <span className="text-xs line-through opacity-70">₹8,500</span>
//                                 <span className="text-2xl font-bold">₹590</span>
//                             </div>
//                             <p className="text-[10px] font-medium opacity-90">One-time</p>
//                         </div>
//                     </div>

//                     <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-3">
//                         {features.map((feature, idx) => (
//                             <div key={idx} className={`grid grid-cols-2 gap-2 p-2 ${idx !== 0 ? 'border-t border-gray-100' : ''}`}>
//                                 <div className="flex flex-col gap-1">
//                                     {idx === 0 && <span className="text-[11px] font-semibold text-gray-900 mb-0.5">{feature.name}</span>}
//                                     {idx !== 0 && <span className="text-[11px] text-gray-700">{feature.name}</span>}
//                                     <div className="flex items-center gap-1">
//                                         {feature.free === false ? (
//                                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                                 <line x1="18" y1="6" x2="6" y2="18"></line>
//                                                 <line x1="6" y1="6" x2="18" y2="18"></line>
//                                             </svg>
//                                         ) : (
//                                             <>
//                                                 <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                                     <polyline points="20 6 9 17 4 12"></polyline>
//                                                 </svg>
//                                                 <span className="text-[10px] text-gray-600 font-medium">{feature.free}</span>
//                                             </>
//                                         )}
//                                     </div>
//                                 </div>

//                                 <div className="bg-purple-50 rounded px-2 py-1 flex items-center gap-1">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span className="text-[10px] font-bold text-gray-900">
//                                         {feature.premium === true ? 'Included' : feature.premium}
//                                     </span>
//                                 </div>
//                             </div>
//                         ))}
//                     </div>

//                     <div className="grid grid-cols-2 gap-2 mb-3">
//                         <button
//                             onClick={() => handleSelectPlan('free')}
//                             className="py-2 bg-white border-2 border-gray-900 text-gray-900 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all"
//                         >
//                             Get Started
//                         </button>
//                         <button
//                             onClick={() => handleSelectPlan('premium')}
//                             className="py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1"
//                         >
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                 <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
//                                 <path d="M2 17l10 5 10-5"></path>
//                                 <path d="M2 12l10 5 10-5"></path>
//                             </svg>
//                             Unlock Now
//                         </button>
//                     </div>

//                     <div className="bg-purple-50 border border-purple-200 rounded-lg p-2.5">
//                         <div className="flex items-start gap-1.5">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <circle cx="12" cy="12" r="10"></circle>
//                                 <path d="M12 16v-4"></path>
//                                 <path d="M12 8h.01"></path>
//                             </svg>
//                             <p className="text-[10px] text-gray-700 leading-relaxed">
//                                 <span className="font-bold text-purple-700">iCAT Special:</span> Save ₹7,910! Exclusive for qualified students.
//                             </p>
//                         </div>
//                     </div>
//                 </div>

//                 <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg">
//                     <div className="grid grid-cols-3 gap-0">
//                         <div className="p-4 border-r border-gray-100">
//                             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">FEATURES</h3>
//                         </div>
//                         <div className="p-4 text-center border-r border-gray-100 bg-gray-50">
//                             <h3 className="text-base font-bold text-gray-900 mb-2">Free</h3>
//                             <div className="mb-1">
//                                 <span className="text-3xl font-bold text-gray-900">₹0</span>
//                             </div>
//                             <p className="text-xs text-gray-500 font-medium">Forever</p>
//                         </div>
//                         <div className="p-4 pt-6 text-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white relative">
//                             <div className="absolute top-[4px] left-1/2 -translate-x-1/2 z-10">
//                                 <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
//                                     93% OFF
//                                 </div>
//                             </div>
//                             <div className="inline-block bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold mb-2">
//                                 🏆 MOST POPULAR
//                             </div>
//                             <h3 className="text-base font-bold mb-2">Premium</h3>
//                             <div className="mb-1 flex items-baseline justify-center gap-2">
//                                 <span className="text-sm line-through opacity-70">₹8,500</span>
//                                 <span className="text-3xl font-bold">₹590</span>
//                             </div>
//                             <p className="text-xs font-medium opacity-90">One-time payment</p>
//                         </div>
//                     </div>

//                     {features.map((feature, idx) => (
//                         <div key={idx} className="grid grid-cols-3 gap-0 border-t border-gray-100">
//                             <div className="p-3 border-r border-gray-100 flex items-center">
//                                 <span className="text-sm font-medium text-gray-700">{feature.name}</span>
//                             </div>
//                             <div className="p-3 border-r border-gray-100 flex items-center justify-center bg-gray-50">
//                                 {feature.free === false ? (
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                         <line x1="18" y1="6" x2="6" y2="18"></line>
//                                         <line x1="6" y1="6" x2="18" y2="18"></line>
//                                     </svg>
//                                 ) : (
//                                     <span className="text-sm text-gray-700">{feature.free}</span>
//                                 )}
//                             </div>
//                             <div className="p-3 bg-purple-50 flex items-center justify-center">
//                                 <div className="flex items-center gap-2">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span className="text-sm font-bold text-gray-900">
//                                         {feature.premium === true ? 'Included' : feature.premium}
//                                     </span>
//                                 </div>
//                             </div>
//                         </div>
//                     ))}

//                     <div className="grid grid-cols-3 gap-0 border-t border-gray-200">
//                         <div className="p-4 border-r border-gray-100"></div>
//                         <div className="p-4 border-r border-gray-100 bg-gray-50">
//                             <button
//                                 onClick={() => handleSelectPlan('free')}
//                                 className="w-full py-2.5 bg-white border-2 border-gray-900 text-gray-900 text-sm font-bold rounded-lg hover:bg-gray-50 transition-all"
//                             >
//                                 Get Started Free
//                             </button>
//                         </div>
//                         <div className="p-4 bg-purple-50">
//                             <button
//                                 onClick={() => handleSelectPlan('premium')}
//                                 className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
//                             >
//                                 <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                     <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
//                                     <path d="M2 17l10 5 10-5"></path>
//                                     <path d="M2 12l10 5 10-5"></path>
//                                 </svg>
//                                 Unlock Premium
//                             </button>
//                         </div>
//                     </div>

//                     <div className="bg-purple-50 border-t border-gray-100 p-3">
//                         <div className="flex items-start gap-2">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <circle cx="12" cy="12" r="10"></circle>
//                                 <path d="M12 16v-4"></path>
//                                 <path d="M12 8h.01"></path>
//                             </svg>
//                             <p className="text-xs text-gray-700 leading-relaxed">
//                                 <span className="font-bold text-purple-700">iCAT Qualified Special:</span> Save ₹7,910! This exclusive offer is available only for students who have qualified the iCAT exam.
//                             </p>
//                         </div>
//                     </div>
//                 </div>

//                 <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
//                     <div className="flex items-center gap-1.5 text-gray-600">
//                         <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
//                             </svg>
//                         </div>
//                         <span className="font-medium">Secure Payment</span>
//                     </div>
//                     <div className="flex items-center gap-1.5 text-gray-600">
//                         <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
//                                 <circle cx="9" cy="7" r="4"></circle>
//                                 <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
//                                 <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
//                             </svg>
//                         </div>
//                         <span className="font-medium">5000+ Students</span>
//                     </div>
//                     <div className="flex items-center gap-1.5 text-gray-600">
//                         <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
//                             <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                 <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
//                             </svg>
//                         </div>
//                         <span className="font-medium">4.8/5 Rating</span>
//                     </div>
//                 </div>
//             </section>
//         </div>
//     );
// };

// export default PricingSection;




























import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const PricingSection = ({
  onUnlockPremium,
  selectedSubdomainId,
  selectedBatch,
  setInputErrors,
  qualifiedStatus,
  finalPrice
}) => {

  const [selectedPlan, setSelectedPlan] = useState(null);
  const navigate = useNavigate();

  const handleSelectPlan = (plan) => {
    console.log("Clicked plan:", plan);
    console.log("Subdomain:", selectedSubdomainId);
    console.log("Batch:", selectedBatch);

    setSelectedPlan(plan);

    if (plan === "non-qualified") {
      const subError = !selectedSubdomainId;
      const batchError = !selectedBatch;

      setInputErrors({
        subdomain: subError,
        batch: batchError
      });

      if (subError || batchError) {
        toast.error("Please select Subdomain and Batch first!");
        return;
      }

      console.log("Navigating to /free-thank-you...");
      navigate("/free-thank-you");
      return;
    }

    onUnlockPremium();
  };



  const features = [
    { name: 'iCAT Participation Certificate', nonQualified: true, qualifiedEnrolled: true },
    { name: 'AI Career Roadmap', nonQualified: true, qualifiedEnrolled: true },
    { name: 'Skill Assessment Certificates', nonQualified: true, qualifiedEnrolled: true },
    { name: 'Guaranteed Training & Internship Program', nonQualified: false, qualifiedEnrolled: true },
    { name: 'Offer Letter', nonQualified: false, qualifiedEnrolled: true },
    { name: 'Training & Internship Certificate', nonQualified: false, qualifiedEnrolled: true },
    { name: 'Exclusive Hiring Portal Access', nonQualified: false, qualifiedEnrolled: true },
    { name: 'Lifetime Access', nonQualified: false, qualifiedEnrolled: true },
  ];

  return (
    <div className="bg-gray-50 p-4">
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[20%] left-[-10%] w-[30rem] h-[30rem] bg-blue-100/40 rounded-full blur-[100px]"></div>
      </div>

      <section className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Choose Your iCAT Learning Path</h2>
          <p className="text-gray-600 text-sm">Select the plan that matches your qualification status</p>
        </div>

        {/* Mobile Side-by-Side Layout */}
        <div className="md:hidden">
          {/* Plan Headers Side by Side */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Non-Qualified Plan */}
            {/* <div className="rounded-lg border-2 border-gray-200 overflow-hidden shadow-sm"> */}
            <div className="rounded-lg border-2 border-gray-200 overflow-hidden shadow-sm flex flex-col">

              <div className="bg-gray-100 p-2.5 border-b border-gray-200 text-center">
                {/* <h3 className="text-[11px] font-bold text-gray-900 mb-0.5">iCAT Non-Qualified</h3> */}
                <div className="mb-0.5">
                  <span className="text-xl font-bold text-gray-900">Free</span>
                </div>
                <p className="text-[8px] text-gray-600">Basic Features</p>
              </div>
              <div className="p-2 space-y-1.5">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    {feature.nonQualified ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    )}
                    <span className={`text-[9px] leading-tight ${feature.nonQualified ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>
              {/* <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-center items-center"> */}
              <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-center items-center mt-auto">

                <a
                  onClick={() => handleSelectPlan('non-qualified')}
                  // className="w-full py-1.5 bg-white border-2 border-gray-900 text-gray-900 text-[10px] font-bold rounded-lg hover:bg-gray-50 transition-all"
                  className="w-full text-center py-1.5 text-gray-900 text-[9px] font-bold"
                >
                  Get Started
                </a>
              </div>
            </div>

            {/* Qualified Plan */}
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg overflow-hidden shadow-lg relative">
              <div className="absolute top-[4px] right-1 z-10">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-1.5 py-[2px] rounded-full text-[7px] font-bold shadow-lg">
                  93% OFF
                </div>
              </div>
              <div className="p-2.5 text-white text-center border-b border-white/20">
                <div className="inline-block bg-white/20 px-1.5 py-[2px] rounded-full text-[7px] font-bold mb-0.5">
                  🏆 BEST
                </div>
                <h3 className="text-[11px] font-bold mb-0.5">{qualifiedStatus ? 'iCAT Qualified' : 'iCAT Not Qualified'}</h3>
                <div className="flex items-baseline justify-center gap-1 mb-0.5">
                  <span className="text-[8px] line-through opacity-70">₹8,500</span>
                  <span className="text-xl font-bold">₹{finalPrice}</span>

                </div>
              </div>
              <div className="p-2 space-y-1.5 bg-white/10">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-300 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span className="text-[9px] text-white font-medium leading-tight">
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-2 bg-white/10 border-t border-white/20">
                <button
                  onClick={() => handleSelectPlan('qualified-enrolled')}
                  className="w-full py-1.5 bg-white text-purple-600 text-[10px] font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg flex items-center justify-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Start Internship
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Info Banner */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
            <div className="flex items-start gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-purple-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <p className="text-[8px] text-gray-700 leading-relaxed">
                <span className="font-bold text-purple-700">iCAT Special:</span> Save ₹{finalPrice === 2000 ? '6,500': '7,910'}! Exclusive for qualified students.
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block bg-white rounded-2xl border-2 border-gray-200 overflow-hidden shadow-xl">
          {/* Header */}
          <div className="grid grid-cols-3 gap-0">
            <div className="p-3 lg:p-4 border-r border-gray-200 bg-gray-50 flex items-center">
              <h3 className="text-[10px] lg:text-xs font-bold text-gray-500 uppercase tracking-wider">Features</h3>
            </div>

            {/* Non-Qualified */}
            <div className="p-3 lg:p-4 text-center border-r border-gray-200 bg-gray-50">
              {/* <h3 className="text-sm lg:text-base font-bold text-gray-900 mb-1 lg:mb-2">iCAT Non-Qualified</h3> */}
              <div className="mb-1">
                <span className="text-2xl lg:text-3xl font-bold text-gray-900">Free</span>
              </div>
              <p className="text-[10px] lg:text-xs text-gray-600">Basic Features</p>
            </div>

            {/* Qualified Enrolled */}
            <div className="p-6 lg:p-6 text-center bg-gradient-to-br from-purple-500 to-indigo-600 text-white relative">
              <div className="absolute top-4 lg:top-[8px] -right-4 -translate-x-1/2 z-10">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-1.5 lg:px-2 py-[2px] rounded-full text-[8px] lg:text-[10px] font-bold shadow-lg">
                  93% OFF
                </div>
              </div>
              <div className="inline-block bg-white/20 px-1.5 lg:px-2 py-[2px] rounded-full text-[7px] lg:text-[9px] font-bold mb-1">
                🏆 BEST VALUE
              </div>
              <h3 className="text-xs lg:text-sm font-bold mb-1">{qualifiedStatus ? 'iCAT Qualified' : 'iCAT Not Qualified'}</h3>
              <div className="flex items-baseline justify-center gap-1 lg:gap-1.5">
                <span className="text-[10px] lg:text-xs line-through opacity-70">₹8,500</span>
                <span className="text-xl lg:text-2xl font-bold">₹{finalPrice}</span>

              </div>
            </div>
          </div>

          {/* Feature Rows */}
          {features.map((feature, idx) => (
            <div key={idx} className="grid grid-cols-3 gap-0 border-t border-gray-200">
              <div className="p-2 lg:p-3 border-r border-gray-200 flex items-center bg-gray-50">
                <span className="text-[11px] lg:text-sm font-medium text-gray-800">{feature.name}</span>
              </div>

              {/* Non-Qualified Column */}
              <div className="p-2 lg:p-3 border-r border-gray-200 flex items-center justify-center">
                {feature.nonQualified ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 lg:w-5 lg:h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                )}
              </div>

              {/* Qualified Enrolled Column */}
              <div className="p-2 lg:p-3 flex items-center justify-center bg-purple-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 lg:w-5 lg:h-5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          ))}

          {/* CTA Buttons */}
          <div className="grid grid-cols-3 gap-0 border-t-2 border-gray-200">
            <div className="p-3 lg:p-4 border-r border-gray-200 bg-gray-50"></div>

            <div className="p-3 lg:p-4 border-r border-gray-200 flex justify-center">
              <a
                onClick={() => handleSelectPlan('non-qualified')}
                className="w-full py-2 lg:py-2.5 text-center text-gray-900 text-[11px] lg:text-sm font-bold"
              >
                Get Started
              </a>
            </div>

            <div className="p-3 lg:p-4 bg-purple-50">
              <button
                onClick={() => handleSelectPlan('qualified-enrolled')}
                className="w-full py-2 lg:py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] lg:text-sm font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-1.5 lg:gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 lg:w-4 lg:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Internship
              </button>
            </div>
          </div>

          {/* Special Offer Banner */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2.5 lg:p-3">
            <div className="flex items-center justify-center gap-2 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 lg:w-5 lg:h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <p className="text-[10px] lg:text-xs font-medium">
                <span className="font-bold">iCAT Qualified Special:</span> Save ₹{finalPrice === 2000 ? '6,500': '7,910'} instantly! Exclusive offer for qualified students.
              </p>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <span className="font-medium">Secure Payment</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <span className="font-medium">5000+ Students</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
            </div>
            <span className="font-medium">4.8/5 Rating</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PricingSection;