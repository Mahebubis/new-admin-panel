// import React from 'react';
// const ThankYouFree = () => {
//     const storedFinalPrice = localStorage.getItem("finalPrice") || "590";
//     const handleUpgradeToPremium = () => {

//         // 1️⃣ Fetch from localStorage
//         const userId = localStorage.getItem("user_id") || sessionStorage.getItem('user_id');
//         const savedDomainName = localStorage.getItem("savedDomainName") || "";
//         const savedSubdomainName = localStorage.getItem("savedSubdomainName") || "";
//         const savedSubdomainID = localStorage.getItem("savedSubdomainID") || "";
//         const savedDomainID = localStorage.getItem("savedDomainID") || "";
//         const phone = localStorage.getItem("phone") || sessionStorage.getItem("phone") || "";


//         // ⭐ NEW: Get batch from localStorage
//         const savedBatchID = localStorage.getItem("savedBatchID") || "";
//         const savedBatchDate = localStorage.getItem("savedBatchDate") || "";

//         // 2️⃣ Build payload for dashboard
//         const payload = {
//             autopay: "true",
//             user_id: userId,

//             // InitiatePayment requires "internship_name", NOT subdomain_name
//             internship_name: savedSubdomainName,

//             batch_date: savedBatchDate,
//             phone_number: phone,
//             amount: "590.00",

//             from: "result_page",

//             return_url: "https://staging.internshipstudio.com/payment-status"
//         };


//         // 3️⃣ Convert to URL query params
//         const queryString = new URLSearchParams(payload).toString();

//         // 4️⃣ Redirect with all values
//         window.location.href = `https://staging.internshipstudio.com/initiate-payment?${queryString}`;
//         // window.location.href = `http://localhost:5174/initiate-payment?${queryString}`;
//     };

//     const handleStartFree = () => {
//         window.location.href = 'https://staging.internshipstudio.com';
//     };
//     return (
//         <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-6">
//             <div className="max-w-2xl w-full">
//                 <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
//                     {/* Header */}
//                     <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-10 text-center">
//                         {/* <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 shadow-xl">
//               <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                 <polyline points="20 6 9 17 4 12"></polyline>
//               </svg>
//             </div> */}
//                         <h1 className="text-4xl font-bold text-white mb-2">You're All Set!</h1>
//                         <p className="text-blue-100 text-lg">Free Plan Activated</p>
//                     </div>
//                     {/* Content */}
//                     <div className="p-8">
//                         {/* Premium Upgrade Box */}
//                         <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 rounded-2xl p-8 mb-8 text-white relative overflow-hidden">
//                             {/* Badge */}
//                             <div className="absolute top-4 right-4">
//                                 <div className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-xs font-bold">
//                                     93% OFF
//                                 </div>
//                             </div>
//                             <div className="flex items-center gap-3 mb-4">
//                                 <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                                     <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
//                                     <path d="M2 17l10 5 10-5"></path>
//                                     <path d="M2 12l10 5 10-5"></path>
//                                 </svg>
//                                 <h2 className="text-2xl font-bold">Unlock Your Full Potential</h2>
//                             </div>
//                             <p className="text-purple-100 mb-6">
//                                 Upgrade to Premium and get everything you need to succeed
//                             </p>
//                             {/* Pricing Box */}
//                             <div className="bg-white/20 backdrop-blur-sm rounded-xl p-5 mb-6">
//                                 <div className="flex items-center justify-between mb-3">
//                                     <span className="text-white/90">Regular Price</span>
//                                     <span className="text-white line-through text-xl">₹8,500</span>
//                                 </div>
//                                 <div className="flex items-center justify-between mb-3">
//                                     <span className="text-white/90">iCAT Special</span>
//                                     <span className="text-yellow-300 text-4xl font-bold">₹{storedFinalPrice}</span>

//                                 </div>
//                                 <div className="border-t border-white/30 pt-3 mt-3">
//                                     <div className="flex items-center justify-between">
//                                         <span className="text-white font-semibold">You Save</span>
//                                         <span className="text-emerald-300 text-2xl font-bold">{storedFinalPrice === "2000" ? '₹6,500' : '₹7,910'}</span>
//                                     </div>
//                                 </div>
//                             </div>
//                             {/* Premium Features */}
//                             <div className="grid grid-cols-2 gap-3 mb-6">
//                                 <div className="flex items-center gap-2 text-sm">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span>All training unlocked</span>
//                                 </div>
//                                 <div className="flex items-center gap-2 text-sm">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span>Unlimited projects</span>
//                                 </div>
//                                 <div className="flex items-center gap-2 text-sm">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span>10+ mentor sessions</span>
//                                 </div>
//                                 <div className="flex items-center gap-2 text-sm">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span>Priority job access</span>
//                                 </div>
//                                 <div className="flex items-center gap-2 text-sm">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span>Premium certificate</span>
//                                 </div>
//                                 <div className="flex items-center gap-2 text-sm">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-emerald-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span>Interview prep kit</span>
//                                 </div>
//                             </div>
//                             {/* CTA Button */}
//                             <button
//                                 onClick={handleUpgradeToPremium}
//                                 className="w-full py-3.5 bg-white text-purple-600 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-xl flex items-center justify-center gap-2"
//                             >
//                                 <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                     <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
//                                     <path d="M2 17l10 5 10-5"></path>
//                                     <path d="M2 12l10 5 10-5"></path>
//                                 </svg>
//                                 Upgrade to Premium Now
//                             </button>
//                             <p className="text-center text-xs text-white/80 mt-3">
//                                 Limited time offer • Save ₹7,910 today
//                             </p>
//                         </div>
//                         {/* Free Plan Features */}
//                         <div className="mb-6">
//                             <h3 className="font-semibold text-gray-900 mb-4">Your Free Plan Includes:</h3>
//                             <div className="space-y-3">
//                                 <div className="flex items-center gap-3">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span className="text-gray-700">iCAT Participation Certificate</span>
//                                 </div>
//                                 <div className="flex items-center gap-3">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span className="text-gray-700">Skill Assessment Certificates</span>
//                                 </div>

//                                 <div className="flex items-center gap-3">
//                                     <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
//                                         <polyline points="20 6 9 17 4 12"></polyline>
//                                     </svg>
//                                     <span className="text-gray-700">Basic certificate</span>
//                                 </div>
//                             </div>
//                         </div>
//                         {/* Secondary CTA */}
//                         <button
//                             onClick={handleStartFree}
//                             className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl transition-all"
//                         >
//                             Continue with Free Plan
//                         </button>
//                     </div>
//                     {/* Footer */}
//                     <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 text-center">
//                         <p className="text-xs text-gray-600">
//                             Need help? <a href="mailto:support@acme.com" className="text-blue-600 hover:text-blue-700 font-medium">Contact Support</a>
//                         </p>
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// };
// export default ThankYouFree;






























import React, { useState } from 'react';

const ThankYouFree = () => {
    const storedFinalPrice = localStorage.getItem("finalPrice") || "590";
    const handleUpgradeToPremium = () => {

        // 1️⃣ Fetch from localStorage
        const userId = localStorage.getItem("user_id") || sessionStorage.getItem('user_id');
        const savedDomainName = localStorage.getItem("savedDomainName") || "";
        const savedSubdomainName = localStorage.getItem("savedSubdomainName") || "";
        const savedSubdomainID = localStorage.getItem("savedSubdomainID") || "";
        const savedDomainID = localStorage.getItem("savedDomainID") || "";
        const phone = localStorage.getItem("phone") || sessionStorage.getItem("phone") || "";


        // ⭐ NEW: Get batch from localStorage
        const savedBatchID = localStorage.getItem("savedBatchID") || "";
        const savedBatchDate = localStorage.getItem("savedBatchDate") || "";

        // 2️⃣ Build payload for dashboard
        const payload = {
            autopay: "true",
            user_id: userId,

            // InitiatePayment requires "internship_name", NOT subdomain_name
            internship_name: savedSubdomainName,

            batch_date: savedBatchDate,
            phone_number: phone,
            amount: "590.00",

            from: "result_page",

            return_url: "https://staging.internshipstudio.com/payment-status"
        };


        // 3️⃣ Convert to URL query params
        const queryString = new URLSearchParams(payload).toString();

        // 4️⃣ Redirect with all values
        window.location.href = `https://staging.internshipstudio.com/initiate-payment?${queryString}`;
        // window.location.href = `http://localhost:5174/initiate-payment?${queryString}`;
    };

    const handleStartFree = () => {
        window.location.href = 'https://staging.internshipstudio.com';
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center py-0 sm:py-4 md:py-6 px-0 sm:px-4">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: 'Outfit', sans-serif;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-out;
                }
                
                .animate-slide-in {
                    animation: slideIn 0.4s ease-out;
                }
                
                .card-shadow {
                    box-shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.1);
                }
                
                @media (max-width: 640px) {
                    .card-shadow {
                        box-shadow: none;
                    }
                }
                
                .premium-gradient {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                
                .hover-lift {
                    transition: all 0.3s ease;
                }
                
                .hover-lift:hover {
                    transform: translateY(-2px);
                }
                
                .feature-check {
                    transition: transform 0.2s ease;
                }
                
                .feature-item:hover .feature-check {
                    transform: scale(1.1);
                }
            `}</style>

            <div className="max-w-2xl w-full animate-fade-in">
                <div className="bg-white sm:rounded-2xl card-shadow overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 sm:px-6 py-4 sm:py-6 text-center">
                        <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">You're All Set!</h1>
                        <p className="text-blue-100 text-xs sm:text-base">Free Plan Activated</p>
                    </div>

                    {/* Content */}
                    <div className="p-4 sm:p-6">
                        {/* Premium Upgrade Box */}
                        <div className="bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 text-white relative overflow-hidden">
                            {/* Badge */}
                            <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                                <div className="bg-yellow-400 text-gray-900 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-bold">
                                    93% OFF
                                </div>
                            </div>

                            <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-7 sm:h-7 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                    <path d="M2 17l10 5 10-5"></path>
                                    <path d="M2 12l10 5 10-5"></path>
                                </svg>
                                <h2 className="text-base sm:text-xl font-bold">Unlock Your Full Potential</h2>
                            </div>

                            <p className="text-purple-100 mb-3 sm:mb-4 text-xs sm:text-sm">
                                Upgrade to Premium and get everything you need to succeed
                            </p>

                            {/* Pricing Box */}
                            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white/90 text-xs sm:text-sm">Regular Price</span>
                                    <span className="text-white line-through text-sm sm:text-lg">₹8,500</span>
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white/90 text-xs sm:text-sm">iCAT Special</span>
                                    <span className="text-yellow-300 text-2xl sm:text-3xl font-bold">₹{storedFinalPrice}</span>
                                </div>
                                <div className="border-t border-white/30 pt-2 mt-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-white font-semibold text-xs sm:text-sm">You Save</span>
                                        <span className="text-emerald-300 text-lg sm:text-xl font-bold">{storedFinalPrice === "2000" ? '₹6,500' : '₹7,910'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Premium Features */}
                            <div className="grid grid-cols-2 gap-2 mb-3 sm:mb-4">
                                {[
                                    "iCAT Participation Certificate",
                                    "AI Career Roadmap",
                                    "Skill Assessment Certificate",
                                    "Guaranteed Training & Internship Program",
                                    "Offer Letter",
                                    "Training & Internship Certificate",
                                    "Exclusive Hiring Portal Access",
                                    "Lifetime Access",
                                ].map((feature, index) => (
                                    <div key={index} className="feature-item flex items-center gap-1.5 text-xs sm:text-sm">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="feature-check w-4 h-4 text-emerald-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA Button */}
                            <button
                                onClick={handleUpgradeToPremium}
                                className="hover-lift w-full py-3.5 sm:py-3 bg-white text-purple-600 font-bold rounded-lg hover:bg-gray-50 transition-all shadow-xl flex items-center justify-center gap-2 text-xs sm:text-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                    <path d="M2 17l10 5 10-5"></path>
                                    <path d="M2 12l10 5 10-5"></path>
                                </svg>
                                Upgrade to Premium Now
                            </button>
                            <p className="text-center text-xs text-white/80 mt-2">
                                Limited time offer • Save ₹{storedFinalPrice === "2000" ? '6,500' : '7,910'} today
                            </p>
                        </div>

                        {/* Free Plan Features */}
                        <div className="mb-4">
                            <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Your Free Plan Includes:</h3>
                            <div className="space-y-2">
                                {[
                                    "iCAT Participation Certificate",
                                    "Skill Assessment Certificates",
                                    "Basic certificate"
                                ].map((feature, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                        <span className="text-gray-700 text-xs sm:text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Secondary CTA */}
                        <button
                            onClick={handleStartFree}
                            className="hover-lift w-full py-2.5 sm:py-3 text-gray-800 font-semibold rounded-lg transition-all text-xs sm:text-sm"
                        >
                            Continue with Free Plan
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-4 sm:px-6 py-2 sm:py-3 border-t border-gray-200 text-center">
                        <p className="text-xs text-gray-600">
                            Need help? <a href="mailto:support@acme.com" className="text-blue-600 hover:text-blue-700 font-medium">Contact Support</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThankYouFree;