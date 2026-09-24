import React, { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../App";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";

import {
  Bell,
  Calendar,
  Clock,
  MessageCircle,
  UserCircle,
  QrCode,
  X,
  RefreshCw,
  ChevronDown,
  Briefcase,
  LayoutDashboard,
  Upload,
  Upload as UploadIcon,
  FileText,
  CheckCircle2,
  Gift,
  AlertTriangle,
  Flame,
  Building2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";

// ─── Utility ───────────────────────────────────────────────────────────────────
function parseDateString(dateString) {
  const cleanedDateString = dateString.replace(/(\d+)(st|nd|rd|th)/, "$1");
  const date = new Date(cleanedDateString);
  date.setHours(10, 0, 0, 0);
  return date;
}

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.168 1.618 5.974L.057 23.854a.5.5 0 0 0 .609.61l5.966-1.55A11.953 11.953 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.374l-.36-.214-3.732.969.994-3.641-.235-.374A9.818 9.818 0 0 1 12 2.182c5.42 0 9.818 4.398 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z"/>
  </svg>
);
function formatResultDisplay(date) {
  if (!date) return "";
  const day = date.getDate();
  const suffixes = ["th", "st", "nd", "rd"];
  const suffix =
    suffixes[
    day % 100 > 10 && day % 100 < 14 ? 0 : day % 10 < 4 ? day % 10 : 0
    ] || "th";
  const month = date.toLocaleString("en-IN", { month: "long" });
  const year = date.getFullYear();
  const hours = date.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${day}${suffix} ${month}, ${year} · ${hour12} ${ampm}`;
}

// ─── QR Modal ──────────────────────────────────────────────────────────────────
const QRCodeModal = ({ onClose, platform, qrLink }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Join Whatsapp</h3>
        <button onClick={onClose} className="hover:bg-gray-100 p-2 rounded-full">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="bg-gray-50 aspect-square rounded-xl flex items-center justify-center mb-6">
        <QRCodeSVG value={qrLink} size={200} />
      </div>
      <p className="text-center text-gray-600">Scan to join our Whatsapp Group</p>
    </div>
  </div>
);

// ─── Retest Modal ──────────────────────────────────────────────────────────────
const RetestModal = ({ onClose, onConfirmRetest }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-md w-full p-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
          <RefreshCw className="w-8 h-8 text-orange-600" />
        </div>
        <h3 className="text-xl font-bold mb-2">Retest Available</h3>
        <p className="text-gray-600 mb-6">
          It seems like your exam was submitted by mistake. Would you like to retake the test?
        </p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            No, Continue
          </button>
          <button
            onClick={onConfirmRetest}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Yes, Retest
          </button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Domain Selector ───────────────────────────────────────────────────────────
const DomainSelector = ({ isHighlighted, onSaveDomain, isSaving, saveMessage, userId, userEmail }) => {
  const [masterDomains, setMasterDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [selectedSubdomain, setSelectedSubdomain] = useState("");
  const [filteredSubdomains, setFilteredSubdomains] = useState([]);
  const [isDomainSaved, setIsDomainSaved] = useState(false);

  useEffect(() => {
    const fetchMasterDomains = async () => {
      try {
        const res = await fetch("https://api.internshipstudio.com/api/getMasterDomains.php");
        const data = await res.json();
        if (data.success && data.data) {
          setMasterDomains(data.data);
          setFilteredSubdomains(data.data);
        }
      } catch (err) {
        console.error("Error fetching master domains:", err);
      }
    };
    fetchMasterDomains();
  }, []);

  const uniqueDomains = [...new Set(masterDomains.map((d) => d.domain_name))];

  useEffect(() => {
    if (selectedDomain) {
      setFilteredSubdomains(masterDomains.filter((d) => d.domain_name === selectedDomain));
    } else {
      setFilteredSubdomains(masterDomains);
    }
  }, [selectedDomain, masterDomains]);

  const handleSubdomainChange = (subdomain_name) => {
    setSelectedSubdomain(subdomain_name);
    const match = masterDomains.find((d) => d.subdomain_name === subdomain_name);
    if (match) setSelectedDomain(match.domain_name);
    setIsDomainSaved(false);
  };

  const handleDomainChange = (domain_name) => {
    setSelectedDomain(domain_name);
    setSelectedSubdomain("");
    setIsDomainSaved(false);
  };

  const canSave = selectedSubdomain && selectedDomain;

  const handleSave = async () => {
    const params = new URLSearchParams();
    params.append("user_id", userId.toString());
    params.append("email", userEmail);
    params.append("domain_name", selectedDomain);
    params.append("subdomain_name", selectedSubdomain);
    params.append("instant_result", "off");

    try {
      const res = await fetch("https://api.internshipstudio.com/api/saveUserDomain.php", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const result = await res.json();
      if (result.success) {
        setIsDomainSaved(true);
        onSaveDomain && onSaveDomain(true);
      }
    } catch (err) {
      console.error("Error saving domain:", err);
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 mb-4 ${isHighlighted ? "ring-4 ring-blue-500 ring-opacity-50" : ""
        }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-blue-50 p-2 rounded-full">
          <Briefcase className="w-5 h-5 text-blue-500" />
        </div>
        <h3 className="font-semibold">Choose your preferred domain</h3>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Domain</label>
            <select
              value={selectedDomain}
              onChange={(e) => handleDomainChange(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
            >
              <option value="">All Domains</option>
              {uniqueDomains.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-[60%] transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
            <select
              value={selectedSubdomain}
              onChange={(e) => handleSubdomainChange(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
            >
              <option value="">Select specialization...</option>
              {filteredSubdomains.map((d) => (
                <option key={d.id} value={d.subdomain_name}>{d.subdomain_name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-[60%] transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !canSave || isDomainSaved}
          className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${isDomainSaved
              ? "bg-green-600 text-white cursor-default"
              : "bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
            }`}
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : isDomainSaved ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Domain saved successfully
            </>
          ) : (
            "Save Selection"
          )}
        </button>

        {selectedDomain && selectedSubdomain && !isDomainSaved && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">Note: You can change your domain later</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Journey Step ──────────────────────────────────────────────────────────────
const JourneyStep = ({
  title,
  status,
  isCompleted,
  isLast,
  onJoinClick,
  onUpdateClick,
  onDomainClick,
  onRefundClick,
}) => (
  <div className="flex-1 flex items-center">
    <div className="flex flex-col items-center">
      <div className="relative">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? "bg-green-500 text-white" : "bg-gray-200"
            }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-[ping_1s_ease-in-out_infinite]" />
          )}
        </div>
      </div>
      <p className="text-sm font-medium mt-2 text-center">{title}</p>
      <p
        className={`text-xs mt-1 ${isCompleted ? "text-green-600" : "text-gray-500"} ${title === "Results & Internship Allocation" ? "font-bold" : ""
          }`}
      >
        {status}
      </p>
      {title === "Select Domain" && !isCompleted && (
        <button
          onClick={onDomainClick}
          className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
        >
          Select
        </button>
      )}
      {title === "Join Groups" && !isCompleted && (
        <button
          onClick={onJoinClick}
          className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
        >
          Join
        </button>
      )}
      {title === "Refund Program" && !isCompleted && (
        <button
          onClick={onRefundClick}
          className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
        >
          Select
        </button>
      )}
      {title === "Complete Profile" && !isCompleted && (
        <button
          onClick={onUpdateClick}
          className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
        >
          Update
        </button>
      )}
    </div>
    {!isLast && (
      <div className="flex-1 mx-2">
        <div className={`h-0.5 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`} />
      </div>
    )}
  </div>
);

// ─── Refund Section ────────────────────────────────────────────────────────────
// const RefundSection = ({ userId, userEmail }) => {
//   const [intent, setIntent] = useState(null);
//   const [intentSaved, setIntentSaved] = useState(false);
//   const [isSavingIntent, setIsSavingIntent] = useState(false);

//   const handleIntentSubmit = async (selectedIntent) => {
//     if (intentSaved || isSavingIntent) return;
//     setIsSavingIntent(true);
//     try {
//       const res = await fetch("https://api.internshipstudio.com/api/saveRefundIntent.php", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ user_id: userId, email: userEmail, intent: selectedIntent }),
//       });
//       const result = await res.json();

//       if (result.duplicate) {
//         toast(result.message, { icon: "ℹ️" });
//         setIntent(result.intent);
//         setIntentSaved(true);
//         return;
//       }

//       if (result.success) {
//         setIntent(selectedIntent);
//         setIntentSaved(true);
//         toast.success(result.message);
//       } else {
//         toast.error(result.message || "Something went wrong.");
//       }
//     } catch (err) {
//       console.error("Error saving intent:", err);
//       toast.error("Network error. Please try again.");
//     } finally {
//       setIsSavingIntent(false);
//     }
//   };

//   return (
//     <div className="bg-white rounded-2xl shadow-lg p-6 h-full flex flex-col gap-4">
//       <div className="flex items-center gap-3">
//         <div className="bg-green-50 p-2 rounded-full flex-shrink-0">
//           <Gift className="w-5 h-5 text-green-600" />
//         </div>
//         <div>
//           <h2 className="text-base font-bold text-gray-900">Refund Program</h2>
//           <p className="text-xs text-gray-500">Complete details below</p>
//         </div>
//       </div>

//       <div className="bg-green-50 border border-green-100 rounded-xl p-4">
//         <p className="text-sm text-gray-800 font-medium leading-relaxed mb-3">
//           If you qualify this exam, you will get{" "}
//           <span className="font-bold text-green-700">100% refund</span> on training fees
//         </p>
//         <div className="flex items-center gap-3">
//           <span className="text-gray-400 line-through text-base font-semibold">₹590</span>
//           <span className="text-2xl font-extrabold text-green-600">₹0</span>
//           <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
//             Effective Price
//           </span>
//         </div>
//       </div>

//       <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
//         <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
//         <p className="text-xs font-semibold text-orange-700">
//           Seats are limited based on FCFS{" "}
//           <span className="font-normal">(First Come First Serve)</span>
//         </p>
//       </div>

//       {/* How to get refund steps */}
//       <div className="flex flex-col gap-2">
//         <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">How to get your refund</p>
//         {[
//           { label: "Enrollment", sub: "Register and complete the exam" },
//           { label: "Maintain 100% attendance", sub: "Attend all scheduled sessions" },
//           { label: "Complete internship project", sub: "Finish the assigned project work" },
//           { label: "Submit project in week 5", sub: "Submit before the deadline" },
//           { label: "Get certificates", sub: "Receive your completion certificates" },
//           { label: "Get refund", sub: "₹590 refunded to your account", isFinal: true },
//         ].map((step, i, arr) => (
//           <div key={i} className="flex gap-3 items-start">
//             {/* Circle + line */}
//             <div className="flex flex-col items-center flex-shrink-0">
//               <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
//                 step.isFinal
//                   ? "bg-green-600 text-white"
//                   : "bg-white border-2 border-green-400 text-green-700"
//               }`}>
//                 {step.isFinal ? "✓" : i + 1}
//               </div>
//               {i < arr.length - 1 && (
//                 <div className="w-px bg-green-200 flex-1" style={{ minHeight: 14 }} />
//               )}
//             </div>
//             {/* Text */}
//             <div className="pb-1">
//               <p className={`text-xs font-semibold ${step.isFinal ? "text-green-600" : "text-gray-800"}`}>
//                 {step.label}
//               </p>
//               <p className="text-[10px] text-gray-400 leading-tight">{step.sub}</p>
//             </div>
//           </div>
//         ))}
//       </div>

//       {/* Intent buttons */}
//       <div className="flex-1 flex flex-col justify-end">
//         {!intentSaved ? (
//           <div className="flex gap-3">
//             <button
//               onClick={() => handleIntentSubmit("yes")}
//               disabled={isSavingIntent}
//               className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white active:scale-95 transition-all disabled:opacity-50"
//               style={{
//                 background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
//                 boxShadow: "0 4px 14px rgba(34,197,94,0.35)",
//               }}
//             >
//               {isSavingIntent ? (
//                 <span className="flex items-center justify-center gap-1.5">
//                   <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                   Saving...
//                 </span>
//               ) : (
//                 "✅ Interested"
//               )}
//             </button>
//             <button
//               onClick={() => handleIntentSubmit("no")}
//               disabled={isSavingIntent}
//               className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 active:scale-95 transition-all disabled:opacity-50"
//             >
//               Not Interested
//             </button>
//           </div>
//         ) : (
//           <div
//             className={`p-4 rounded-xl text-center ${intent === "yes"
//                 ? "bg-green-50 border border-green-100"
//                 : "bg-gray-50 border border-gray-100"
//               }`}
//           >
//             <span className="text-2xl">{intent === "yes" ? "🎉" : "👍"}</span>
//             <p className="font-bold mt-1 text-gray-900 text-sm">
//               {intent === "yes" ? "Refund request registered!" : "Got it, you're all set!"}
//             </p>
//             <p className="text-xs text-gray-500 mt-1">
//               {intent === "yes" ? "Our team will contact you soon." : "Focus on your journey!"}
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// const RefundSection = ({ userId, userEmail }) => {
  const RefundSection = ({ userId, userEmail, onSaveRefund, amount }) => {
  const [intent, setIntent] = useState(null);
  const [intentSaved, setIntentSaved] = useState(false);
  const [isSavingIntent, setIsSavingIntent] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const handleIntentSubmit = async (selectedIntent) => {
    if (intentSaved || isSavingIntent) return;
    setIsSavingIntent(true);
    try {
      const res = await fetch("https://api.internshipstudio.com/api/saveRefundIntent.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, email: userEmail, intent: selectedIntent }),
        // body: JSON.stringify({ user_id: 907667, email: userEmail, intent: selectedIntent }),
      });
      const result = await res.json();

      if (result.duplicate) {
        toast(result.message, { icon: "ℹ️" });
        setIntent(result.intent);
        setIntentSaved(true);
        setIsDuplicate(true); // ✅ important
        onSaveRefund && onSaveRefund(true); // add this line
        return;
      }

      if (result.success) {
  setIntent(selectedIntent);
  setIntentSaved(true);
  // do NOT set isDuplicate here — only duplicates should show that message
  toast.success(result.message);
  onSaveRefund && onSaveRefund(true);
} else {
        toast.error(result.message || "Something went wrong.");
      }
    } catch (err) {
      console.error("Error saving intent:", err);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingIntent(false);
    }
  };

  const resultMessage = (intent) => {
  if (intent === "yes") {
    return 'You already marked your intent as "Interested"';
  }
  return 'You already marked your intent as "Not Interested"';
};

  const steps = [
    { label: "Enrollment", sub: "Register and complete the exam" },
    { label: "Maintain 100% attendance", sub: "Attend all scheduled sessions" },
    { label: "Complete internship project", sub: "Finish the assigned project work" },
    { label: "Submit project in week 5", sub: "Submit before the deadline" },
    { label: "Get certificates", sub: "Receive your completion certificates" },
    {
    label: "Get refund",
    sub: `₹${amount || 590} refunded to your account`,
    isFinal: true,
  },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-green-50 p-2 rounded-full flex-shrink-0">
          <Gift className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900">Refund Program</h2>
          <p className="text-xs text-gray-500">Complete details below</p>
        </div>
      </div>

      {/* Offer statement */}
      <div className="bg-green-50 border border-green-100 rounded-xl p-4">
        <p className="text-sm text-gray-800 font-medium leading-relaxed mb-3">
          If you qualify this exam, you will get{" "}
          <span className="font-bold text-green-700">100% refund</span> on training fees
        </p>
        <div className="flex items-center gap-3">
          {/* <span className="text-gray-400 line-through text-base font-semibold">₹590</span> */}
          <span className="text-gray-400 line-through text-base font-semibold">
  ₹{amount || 590}
</span>
          <span className="text-2xl font-extrabold text-green-600">₹0</span>
          <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
            Effective Price
          </span>
        </div>
      </div>

      {/* FCFS highlight */}
      <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
        <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
        <p className="text-xs font-semibold text-orange-700">
          Seats are limited based on FCFS{" "}
          <span className="font-normal">(First Come First Serve)</span>
        </p>
      </div>

      {/* Intent buttons */}
      <div className="flex gap-3">
        {!intentSaved ? (
          <>
            <button
              onClick={() => handleIntentSubmit("yes")}
              disabled={isSavingIntent}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white active:scale-95 transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                boxShadow: "0 4px 14px rgba(34,197,94,0.35)",
              }}
            >
              {isSavingIntent ? (
                <span className="flex items-center justify-center gap-1.5">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "✅ Interested"
              )}
            </button>
            <button
              onClick={() => handleIntentSubmit("no")}
              disabled={isSavingIntent}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 border border-gray-200 active:scale-95 transition-all disabled:opacity-50"
            >
              Not Interested
            </button>
          </>
        ) : (
          <div
            className={`w-full p-4 rounded-xl text-center ${
              intent === "yes"
                ? "bg-green-50 border border-green-100"
                : "bg-gray-50 border border-gray-100"
            }`}
          >
            <span className="text-2xl">{intent === "yes" ? "🎉" : "👍"}</span>
            <p className="font-bold mt-1 text-gray-900 text-sm">
              {/* {intent === "yes" ? "Refund request registered!" : "Got it, you're all set!"} */}
              {/* {intent === "yes" 
  ? "Your request has been sent successfully" 
  : "Not interested selected"} */}
  {isDuplicate
  ? resultMessage(intent)
  : intent === "yes"
    ? "Your request has been sent successfully"
    : "Not interested selected"}
            </p>
            {/* <p className="text-xs text-gray-500 mt-1">
              {intent === "yes"
                ? "Our team will contact you soon."
                : "Focus on your journey!"}
            </p> */}
          </div>
        )}
      </div>

      {/* How to get refund steps — flex-1 so it stretches */}
      <div className="flex-1 flex flex-col mt-10">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          How to get your refund
        </p>
        <div className="flex flex-col flex-1">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start flex-1">
              {/* Circle + connector line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    step.isFinal
                      ? "bg-green-600 text-white"
                      : "bg-white border-2 border-green-400 text-green-700"
                  }`}
                >
                  {step.isFinal ? "✓" : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px bg-green-200 flex-1" style={{ minHeight: 28 }} />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 pb-4">
                <p
                  className={`text-sm font-semibold ${
                    step.isFinal ? "text-green-600" : "text-gray-800"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-gray-400 leading-tight mt-0.5">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      
    </div>
  );
};

// ─── Hiring Partners ───────────────────────────────────────────────────────────
// const HiringPartnersSection = ({ companies }) => {
//   if (!companies || companies.length === 0) return null;
//   return (
//     <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
//       <style>{`
//         @keyframes marquee-scroll {
//           0%   { transform: translateX(0); }
//           100% { transform: translateX(-50%); }
//         }
//         .logo-marquee { animation: marquee-scroll 20s linear infinite; }
//         .logo-marquee:hover { animation-play-state: paused; }
//       `}</style>
//       <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
//         Our Hiring Partners
//       </p>
//       <div className="overflow-hidden relative">
//         <div className="absolute left-0 top-0 h-full w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
//         <div className="absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
//         <div className="flex gap-4 logo-marquee" style={{ width: "max-content" }}>
//           {[...companies, ...companies].map((c, i) => (
//             <div
//               key={i}
//               className="w-12 h-12 flex-shrink-0 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden"
//             >
//               {c.employer_logo ? (
//                 <img
//                   src={c.employer_logo}
//                   alt="company logo"
//                   className="w-full h-full object-contain p-1.5"
//                   onError={(e) => { e.target.style.display = "none"; }}
//                 />
//               ) : (
//                 <Building2 className="w-5 h-5 text-gray-300" />
//               )}
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };

const HiringPartnersSection = ({ companies }) => {
  const [showAll, setShowAll] = useState(false);

  if (!companies || companies.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
      {/* Heading */}
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
        Companies Hiring This Week Through Your iCAT Score
      </p>

      {/* Logo Container */}
      <div className="relative">
        {/* Fade effect (only when collapsed) */}
        {!showAll && (
          <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
        )}

        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${showAll ? "max-h-[500px]" : "max-h-[72px]"
            }`}
        >
          <div
            className={`flex gap-4 ${showAll ? "flex-wrap" : "flex-nowrap overflow-hidden"
              }`}
          >
            {companies.map((c, i) => (
              <div
                key={i}
                className="w-14 h-14 flex-shrink-0 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden hover:shadow-md transition"
              >
                {c.employer_logo ? (
                  <img
                    src={c.employer_logo}
                    alt="company logo"
                    className="w-full h-full object-contain p-2"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                ) : (
                  <Building2 className="w-5 h-5 text-gray-300" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* View More Button */}
      {companies.length > 6 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={() => setShowAll(!showAll)}
            className="px-6 underline rounded-full text-sm font-semibold text-blue-500"
          >
            {showAll ? "View Less" : "View More"}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Mobile Step Item ──────────────────────────────────────────────────────────
const MobileStepItem = ({ stepNumber, title, isLast, children }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center flex-shrink-0" style={{ width: 26 }}>
      <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
        {stepNumber}
      </div>
      {!isLast && (
        <div className="flex-1 w-px bg-gray-200 my-1.5" style={{ minHeight: 20 }} />
      )}
    </div>
    <div className={`flex-1 min-w-0 ${!isLast ? "pb-5" : ""}`}>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        Step {stepNumber}
      </p>
      <h3 className="font-semibold text-gray-900 mb-2 text-xs">{title}</h3>
      {children}
    </div>
  </div>
);

// ─── Join Club Card ────────────────────────────────────────────────────────────
const JoinClubCard = ({
  whatsAppLink,
  highlightCommunityGroups,
  onQRClick,
  onJoinClick,
  communityGroupsRef,
}) => (
  // <div
  //   ref={communityGroupsRef}
  //   className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 ${highlightCommunityGroups ? "ring-4 ring-blue-500 ring-opacity-50" : ""
  //     }`}
  // >
  //   <div className="flex items-center gap-3 mb-4">
  //     <div className="bg-blue-50 p-2 rounded-full">
  //       <MessageCircle className="w-5 h-5 text-blue-500" />
  //     </div>
  //     <h3 className="font-semibold">
  //       Join the Placement Club -{" "}
  //       <span className="font-normal text-[14px]">
  //         All Internship &amp; Result Updates Here
  //       </span>
  //     </h3>
  //   </div>
  //   <div className="flex gap-2">
  //     <a
  //       href={whatsAppLink}
  //       target="_blank"
  //       rel="noopener noreferrer"
  //       className="flex-1 text-xs md:text-base flex mt-3 items-center justify-center h-fit gap-2 px-4 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
  //       onClick={onJoinClick}
  //     >
  //       <MessageCircle className="w-5 h-5" />
  //       Click To Join
  //     </a>
  //     <button
  //       onClick={onQRClick}
  //       className="flex items-center justify-center px-3 py-0 text-white rounded-lg transition-colors"
  //     >
  //       <img width={80} height={80} src="qr.png" alt="QR" />
  //     </button>
  //   </div>
  // </div>
  <div
  ref={communityGroupsRef}
  className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 ${
    highlightCommunityGroups ? "ring-4 ring-blue-500 ring-opacity-50" : ""
  }`}
>
  <div className="flex items-center gap-3 mb-4">
    <div className="bg-blue-50 p-2 rounded-full">
      {/* <MessageCircle className="w-5 h-5 text-blue-500" /> */}
      <WhatsAppIcon className="w-5 h-5 text-green-500" />
    </div>
    <h3 className="font-semibold">
      Join the Placement Club -{" "}
      <span className="font-normal text-[14px]">
        All Internship &amp; Result Updates Here
      </span>
    </h3>
  </div>

  {/* ✅ MOBILE (UNCHANGED) */}
  <div className="flex gap-2 md:hidden">
    <a
      href={whatsAppLink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-1 text-xs flex mt-3 items-center justify-center gap-2 px-4 py-4 bg-black text-white rounded-lg"
      onClick={onJoinClick}
    >
      {/* <MessageCircle className="w-5 h-5" /> */}
      <WhatsAppIcon className="w-5 h-5" />
      Click To Join
    </a>
    <button onClick={onQRClick}>
      <img width={80} height={80} src="qr.png" alt="QR" />
    </button>
  </div>

  {/* ✅ DESKTOP NEW UI */}
  <div className="hidden md:flex flex-col items-center gap-4">
    
    {/* BIG QR */}
    <div className="bg-gray-50 p-6 rounded-xl">
      <QRCodeSVG value={whatsAppLink} size={220} />
    </div>

    {/* BUTTON BELOW QR */}
    <a
      href={whatsAppLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onJoinClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
    >
      {/* <MessageCircle className="w-5 h-5" /> */}
      <WhatsAppIcon className="w-5 h-5" />
      Click To Join
    </a>
  </div>
</div>
);

// ─── Profile Card ──────────────────────────────────────────────────────────────
const ProfileCard = ({ profileRef, highlightProfile, onUpdateClick }) => (
  <div
    ref={profileRef}
    className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 ${highlightProfile ? "ring-4 ring-blue-500 ring-opacity-50" : ""
      }`}
  >
    <div className="flex items-center gap-3 mb-4">
      <div className="bg-blue-50 p-2 rounded-full">
        <UserCircle className="w-5 h-5 text-blue-500" />
      </div>
      <h3 className="font-semibold">Complete Your Profile</h3>
    </div>
    <button
      onClick={onUpdateClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
    >
      Update Profile
    </button>
  </div>
);

// ─── Results Page ──────────────────────────────────────────────────────────────
const ResultsPage = () => {
  const userData = useContext(UserContext);
  const navigate = useNavigate();

  const [showQRWhatsApp, setShowQRWhatsApp] = useState(false);
  const [showRetestModal, setShowRetestModal] = useState(false);
  const [showMainContent, setShowMainContent] = useState(true);
  const [intentMobile, setIntentMobile] = useState(null);
  const [highlightRefund, setHighlightRefund] = useState(false);
  const [intentSavedMobile, setIntentSavedMobile] = useState(false);
  const [mobileCompanies, setMobileCompanies] = useState([]);
  const [registeredCount, setRegisteredCount] = useState(0);
  const [isSavingMobile, setIsSavingMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refundProgram, setRefundProgram] = useState("off");
  const [resultDate, setResultDate] = useState("");
  const [examDate, setExamDate] = useState("");
  const [whatsAppLink, setWhatsAppLink] = useState("");
  const [parsedResultDate, setParsedResultDate] = useState(null);
  const [parsedExamDate, setParsedExamDate] = useState(null);
  const [timeLeft, setTimeLeft] = useState({});
  const [internships, setInternships] = useState([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [isDomainSaved, setIsDomainSaved] = useState(false);
  const [isRefundSaved, setIsRefundSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [retestLoading, setRetestLoading] = useState(false);
  const [highlightCommunityGroups, setHighlightCommunityGroups] = useState(false);
  const [highlightProfile, setHighlightProfile] = useState(false);
  const [highlightDomain, setHighlightDomain] = useState(false);

  const communityGroupsRef = useRef(null);
  const profileRef = useRef(null);
  const domainRef = useRef(null);
  const refundRef = useRef(null);

  // ── Fetch user name / amount ──
  useEffect(() => {
    if (!userId) return;
    fetch("https://dashboard.internshipstudio.com/api/get_user_name.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    })
      .then((r) => r.json())
      .then((result) => {
        if (result.status === "success") {
          setName(result.data.name);
          setAmount(result.data.amount);
          setUserEmail(result.data.email);
        }
      })
      .catch((e) => console.error("Error fetching user name:", e));
  }, [userId]);

  // ── Razorpay script ──
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  // ── Load domain from localStorage ──
  useEffect(() => {
    try {
      const saved = localStorage.getItem("userDomainSelection");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.domainId || parsed.customDomain) {
          setIsDomainSaved(true);
          setSaveMessage({ type: "success", text: "Domain saved successfully" });
        }
      }
    } catch (e) {
      console.error("Error loading domain:", e);
    }
  }, []);

  // ── Main data fetch ──
  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessionUserId = sessionStorage.getItem("user_id");
        const sessionUserEmail = sessionStorage.getItem("userEmail");
        if (sessionUserId) setUserId(sessionUserId);
        if (sessionUserEmail) setUserEmail(sessionUserEmail);

        const resultDateRes = await fetch(
          "https://api.internshipstudio.com/api/fetchMisc.php?action=result_date"
        );
        const resultDateData = await resultDateRes.json();
        setResultDate(resultDateData.value);
        setParsedResultDate(parseDateString(resultDateData.value));

        const examDateRes = await fetch(
          "https://api.internshipstudio.com/api/fetchMisc.php?action=exam_date"
        );
        const examDateData = await examDateRes.json();
        setExamDate(examDateData.value);
        setParsedExamDate(parseDateString(examDateData.value));

        // const waRes = await fetch(
        //   "https://api.internshipstudio.com/api/fetchMisc.php?action=end_exam_wa_link"
        // );
        // const waData = await waRes.json();
        // setWhatsAppLink(waData.value);

        const refundRes = await fetch(
          `https://api.internshipstudio.com/api/fetchMisc.php?action=refund_program&user_id=${sessionUserId ?? ""}`
        );
        const refundData = await refundRes.json();
        setRefundProgram(refundData.value ?? "off");

        // const refundRes = await fetch(
        //   `https://api.internshipstudio.com/api/fetchMisc.php?action=refund_program&user_id=907667`
        // );
        // const refundData = await refundRes.json();
        // setRefundProgram(refundData.value ?? "off");




        // ✅ NEW: Fetch pricing only if refund is ON
if (refundData.value === "on") {
  const priceRes = await fetch(
    `https://api.internshipstudio.com/api/fetchMisc.php?action=fetch_pricing`
  );
  const priceData = await priceRes.json();

  // you can use existing state OR create new one
  setAmount(priceData.value); 
}



        const action =
  refundData.value === "on"
    ? "end_exam_wa_link_for_refund"
    : "end_exam_wa_link";

// ✅ 3. Fetch WhatsApp link
const waRes = await fetch(
  `https://api.internshipstudio.com/api/fetchMisc.php?action=${action}&user_id=${sessionUserId}`
  // `https://api.internshipstudio.com/api/fetchMisc.php?action=${action}&user_id=907667`
);
const waData = await waRes.json();

setWhatsAppLink(waData.value);

        fetch(
          "https://dashboard.internshipstudio.com/api/get_data_for_result_page.php?action=get_employer_logos"
        )
          .then((r) => r.json())
          .then((d) => { if (d.status === "success") setMobileCompanies(d.data); })
          .catch(() => { });

        fetch("https://api.internshipstudio.com/api/getRefundIntentCount.php")
          .then((r) => r.json())
          .then((d) => { if (d.success) setRegisteredCount(d.count); })
          .catch(() => { });

        const internshipRes = await fetch(
          "https://api.internshipstudio.com/api/getInternship.php"
        );
        const internshipData = await internshipRes.json();
        if (internshipData.success && internshipData.data) {
          setInternships(internshipData.data);
        }

        // ── FIX: pass sessionUserId explicitly — never rely on userData here ──
        await checkExamResult(sessionUserId);

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userData]);

  // ── Countdown ──
  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!parsedResultDate) return;
      const now = new Date();
      const diff = parsedResultDate - now;
      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      } else {
        setTimeLeft({});
      }
    };
    calculateTimeLeft();
    const t = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(t);
  }, [parsedResultDate]);

  // ──────────────────────────────────────────────────────────────────────────────
  // FIX — root cause of both bugs:
  //
  // Previously: body: JSON.stringify({ user_id: userData?.user_id, exam_id: 1 })
  //   userData comes from React context and is often null/undefined when the
  //   useEffect fires, so user_id was undefined. The API returned no data,
  //   so neither setShowRetestModal(true) nor the email POST ever ran.
  //
  // Fix: accept sessionUserId as a parameter (already read from sessionStorage
  //   at the top of fetchData) and use it directly in both the fetch_result
  //   call and the email call. sessionStorage is always populated by this point.
  // ──────────────────────────────────────────────────────────────────────────────
  const checkExamResult = async (sessionUserId) => {
    try {
      const res = await fetch("https://examapi.internshipstudio.com/api/fetch_result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: sessionUserId, exam_id: 1 }),
      });
      const result = await res.json();

      if (result.status === 200 && result.data) {
        if (result.data.score <= 9) {
          // Low score — show retest modal, hide page content
          setShowRetestModal(true);
          setShowMainContent(false);
        }
        // TEMP: post-exam email disabled — uncomment to re-enable
        // else {
        //   // Good score — fire the post-exam email
        //   await axios.post(
        //     "https://dashboard.internshipstudio.com/api/send_email_after_exam_completed.php",
        //     { user_id: sessionUserId }
        //   );
        // }
      }
    } catch (error) {
      console.error("Error checking exam result:", error);
    }
  };

  const handleRefundClick = () => {
    setHighlightRefund(true);
    setTimeout(() => setHighlightRefund(false), 2000);
    refundRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleRetestRequest = async () => {
    setRetestLoading(true);
    try {
      const sessionUserId = sessionStorage.getItem("user_id");
      const res = await fetch("https://examapi.internshipstudio.com/api/request_retest", {
        method: "POST",
        headers: {
          userid: sessionUserId,
          hash: sessionStorage.getItem("hash"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exam_id: 1 }),
      });
      const result = await res.json();
      if (result.status === 200) {
        setShowRetestModal(false);
        navigate("/");
      } else {
        alert("Failed to initiate retest. Please try again.");
      }
    } catch {
      alert("Failed to initiate retest. Please try again.");
    } finally {
      setRetestLoading(false);
    }
  };

  const handleMobileIntent = async (selectedIntent) => {
    if (intentSavedMobile || isSavingMobile) return;
    setIsSavingMobile(true);
    try {
      const res = await fetch("https://api.internshipstudio.com/api/saveRefundIntent.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, email: userEmail, intent: selectedIntent }),
      });
      const result = await res.json();

      if (result.duplicate) {
        toast(result.message, { icon: "ℹ️" });
        setIntentMobile(result.intent);
        setIntentSavedMobile(true);
        setIsRefundSaved(true); // add this line
        return;
      }

      if (result.success) {
  setIntentMobile(selectedIntent);
  setIntentSavedMobile(true);
  setIsRefundSaved(true);
  toast.success(result.message);
} else {
        toast.error(result.message || "Something went wrong.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Please try again.");
    } finally {
      setIsSavingMobile(false);
    }
  };

  // "No, Continue" — closes the retest modal
  const handleContinueWithoutRetest = async () => {
    setShowRetestModal(false);
    setShowMainContent(true);
    // TEMP: post-exam email disabled — uncomment to re-enable
    // const sessionUserId = sessionStorage.getItem("user_id");
    // await axios.post(
    //   "https://dashboard.internshipstudio.com/api/send_email_after_exam_completed.php",
    //   { user_id: sessionUserId }
    // );
  };

  const scrollToSection = (ref) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });

  const handleJoinClick = () => {
    setHighlightCommunityGroups(true);
    setTimeout(() => setHighlightCommunityGroups(false), 2000);
    scrollToSection(communityGroupsRef);
  };
  const handleUpdateClick = () => {
    setHighlightProfile(true);
    setTimeout(() => setHighlightProfile(false), 2000);
    scrollToSection(profileRef);
  };
  const handleDomainClick = () => {
    setHighlightDomain(true);
    setTimeout(() => setHighlightDomain(false), 2000);
    scrollToSection(domainRef);
  };

  const handleUpdateClickLink = () => {
    setHighlightProfile(true);
    setTimeout(() => setHighlightProfile(false), 2000);
    if (sessionStorage.getItem("source") === "app") {
      toast("Please update your profile in the app after closing this page.");
    } else {
      window.location.href = "https://dashboard.internshipstudio.com/profile";
    }
  };

  const handleClickPlacementClubLink = async () => {
    try {
      await axios.post("https://dashboard.internshipstudio.com/api/assign_link.php", {
        assigned_link: whatsAppLink,
        user_id: userId,
        // user_id: 907667,
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-lg font-semibold text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Toaster position="top-center" />

      {showMainContent && (
        <>
          {/* Sticky top banner */}
          <div className="bg-black text-white py-6 px-4 text-center sticky top-0 z-50">
            <p className="text-lg font-medium flex items-center justify-center flex-wrap gap-2">
              <span>
                Results will be announced on{" "}
                {parsedResultDate ? formatResultDisplay(parsedResultDate) : resultDate}
              </span>
              {Object.entries(timeLeft).length > 0 ? (
                <>
                  <span>-</span>
                  {Object.entries(timeLeft).map(([unit, value]) => (
                    <span key={unit} className="bg-white rounded px-2 py-2 text-xs">
                      <span className="text-gray-900 font-bold">{value}</span>
                      <span className="text-gray-900 ml-1">{unit}</span>
                    </span>
                  ))}
                </>
              ) : (
                <span className="text-green-400 font-semibold ml-2">
                  Results are now available!
                </span>
              )}
            </p>
          </div>

          <div className="max-w-4xl mx-auto px-4 py-3 md:py-6">
            {/* Header */}
            <div className="text-center mb-2 md:mb-6">
              <div className="inline-block mb-1 md:mb-3 bg-green-50 text-green-700 px-4 py-2 rounded-full font-medium">
                <CheckCircle2 className="w-4 h-4 inline mr-2" />
                Exam Completed Successfully 🎉
              </div>
              <h1 className="text-2xl md:text-4xl font-bold">
                Get Ready for Your Results!
              </h1>
            </div>

            {/* Journey stepper */}
            <div className="bg-white rounded-2xl shadow-lg p-6 overflow-x-auto mb-8">
              <h3 className="text-lg font-semibold mb-6">Your Journey</h3>
              <div className="flex min-w-[750px] px-4">
                <JourneyStep title="Registration" status="Completed" isCompleted={true} />
                <JourneyStep title="Exam" status="Completed" isCompleted={true} />
                <JourneyStep
                  title="Join Groups"
                  status="Pending"
                  isCompleted={false}
                  onJoinClick={handleJoinClick}
                />
                {/* {refundProgram === "on" && (
                  <JourneyStep
                    title="Refund Program"
                    status="Pending"
                    isCompleted={false}
                    onRefundClick={handleRefundClick}
                  />
                )} */}
                {refundProgram === "on" && (
  <JourneyStep
    title="Refund Program"
    status={isRefundSaved ? "Completed" : "Pending"}
    isCompleted={isRefundSaved}
    onRefundClick={handleRefundClick}
  />
)}
                <JourneyStep
                  title="Select Domain"
                  status={isDomainSaved ? "Completed" : "Pending"}
                  isCompleted={isDomainSaved}
                  onDomainClick={handleDomainClick}
                />
                <JourneyStep
                  title="Complete Profile"
                  status="Pending"
                  isCompleted={false}
                  onUpdateClick={handleUpdateClick}
                />
                <JourneyStep
                  title="Results & Internship Allocation"
                  status={
                    parsedResultDate
                      ? parsedResultDate.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "numeric",
                      })
                      : resultDate
                  }
                  isCompleted={false}
                  isLast={true}
                />
              </div>
            </div>

            {/* Join Club — desktop only, above the grid */}
            {/* <div className="hidden md:block">
              <JoinClubCard */}
              {/* Join Club — desktop only, above the grid (refund off) */}
{refundProgram !== "on" && (
<div className="block">
  <JoinClubCard
                whatsAppLink={whatsAppLink}
                highlightCommunityGroups={highlightCommunityGroups}
                communityGroupsRef={communityGroupsRef}
                onQRClick={() => {
                  setShowQRWhatsApp(true);
                  handleClickPlacementClubLink();
                }}
                onJoinClick={handleClickPlacementClubLink}
              />
</div>
)}

            {/* ── Conditional layout ── */}
            {refundProgram === "on" ? (
              <>
                {/* DESKTOP — refund on */}
                {/* <div className="hidden md:grid md:grid-cols-[40%_60%] gap-6 mt-6 items-stretch"> */}
                <div className="hidden md:grid md:grid-cols-[2fr_3fr] gap-6 mt-6 items-stretch">
                  <div
                    ref={refundRef}
                    className={`h-full transition-all duration-300 ${highlightRefund
                        ? "ring-4 ring-green-400 ring-opacity-60 rounded-2xl"
                        : ""
                      }`}
                  >
                    {/* <RefundSection userId={userId} userEmail={userEmail} /> */}
                    {/* <RefundSection userId={userId} userEmail={userEmail} onSaveRefund={(saved) => { if (saved) setIsRefundSaved(true); amount={amount} }} /> */}
                    <RefundSection 
  userId={userId} 
  userEmail={userEmail} 
  onSaveRefund={(saved) => { 
    if (saved) setIsRefundSaved(true); 
  }} 
  amount={amount}   // ✅ CORRECT PLACE
/>
                  </div>

                  {/* <div className="space-y-0">
                    <div ref={domainRef}>
                      <DomainSelector */}
                      <div className="flex flex-col gap-6 min-w-0">
  <JoinClubCard
    whatsAppLink={whatsAppLink}
    highlightCommunityGroups={highlightCommunityGroups}
    communityGroupsRef={communityGroupsRef}
    onQRClick={() => {
      setShowQRWhatsApp(true);
      handleClickPlacementClubLink();
    }}
    onJoinClick={handleClickPlacementClubLink}
  />
  <div ref={domainRef}>
    <DomainSelector
                        isHighlighted={highlightDomain}
                        onSaveDomain={(saved) => { if (saved) setIsDomainSaved(true); }}
                        isSaving={isSaving}
                        saveMessage={saveMessage}
                        userId={userId}
                        userEmail={userEmail}
                      />
                    </div>
                    <ProfileCard
                      profileRef={profileRef}
                      highlightProfile={highlightProfile}
                      onUpdateClick={handleUpdateClickLink}
                    />
                  </div>
                </div>

                {/* MOBILE — refund on */}
                <div className="md:hidden mt-4">
                  <MobileStepItem stepNumber={1} title="Join the Placement Club">
                    <JoinClubCard
                      whatsAppLink={whatsAppLink}
                      highlightCommunityGroups={highlightCommunityGroups}
                      communityGroupsRef={communityGroupsRef}
                      onQRClick={() => {
                        setShowQRWhatsApp(true);
                        handleClickPlacementClubLink();
                      }}
                      onJoinClick={handleClickPlacementClubLink}
                    />
                  </MobileStepItem>

                  <MobileStepItem stepNumber={2} title="Refund Program">
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col gap-2.5">
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-xs text-gray-800 font-medium leading-relaxed mb-2">
                          If you qualify this exam, you will get{" "}
                          <span className="font-bold text-green-700">100% refund</span> on
                          training fees
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 line-through text-sm font-semibold">
  ₹{amount || 590}
</span>
                          <span className="text-xl font-extrabold text-green-600">₹0</span>
                          <span className="text-[10px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">
                            Effective Price
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2">
                        <Flame className="w-3 h-3 text-orange-500 flex-shrink-0" />
                        <p className="text-[10px] font-semibold text-orange-700">
                          Seats limited · FCFS (First Come First Serve)
                        </p>
                      </div>

                      {!intentSavedMobile ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMobileIntent("yes")}
                            disabled={isSavingMobile}
                            className="flex-1 py-2 rounded-lg text-xs font-bold text-white active:scale-95 transition-all disabled:opacity-50"
                            style={{
                              background: "linear-gradient(135deg,#22c55e,#16a34a)",
                              boxShadow: "0 3px 10px rgba(34,197,94,0.3)",
                            }}
                          >
                            {isSavingMobile ? "..." : "✅ Interested"}
                          </button>
                          <button
                            onClick={() => handleMobileIntent("no")}
                            disabled={isSavingMobile}
                            className="flex-1 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 active:scale-95 transition-all"
                          >
                            Not Interested
                          </button>
                        </div>
                      ) : (
                        <div
                          className={`p-2 rounded-lg text-center text-xs ${intentMobile === "yes" ? "bg-green-50" : "bg-gray-50"
                            }`}
                        >
                          {intentMobile === "yes"
                            ? "🎉 Refund request registered!"
                            : "👍 All set!"}
                        </div>
                      )}
                    </div>
                  </MobileStepItem>

                  <MobileStepItem stepNumber={3} title="Choose your preferred domain">
                    <div ref={domainRef}>
                      <DomainSelector
                        isHighlighted={highlightDomain}
                        onSaveDomain={(saved) => { if (saved) setIsDomainSaved(true); }}
                        isSaving={isSaving}
                        saveMessage={saveMessage}
                        userId={userId}
                        userEmail={userEmail}
                      />
                    </div>
                  </MobileStepItem>

                  <MobileStepItem stepNumber={4} title="Complete Your Profile" isLast>
                    <button
                      onClick={handleUpdateClickLink}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-sm"
                    >
                      Update Profile
                    </button>
                  </MobileStepItem>
                </div>
              </>
            ) : (
              /* ORIGINAL layout — refund off */
              <div className="grid grid-cols-1 md:grid-cols-[40%_60%] gap-6 mt-6">
                <div className="bg-black text-white rounded-2xl p-6 relative">
                  <h2 className="text-xl font-bold mb-4">Results Coming In</h2>
                  <div className="flex flex-nowrap gap-2 mb-6">
                    {Object.entries(timeLeft).length > 0 ? (
                      Object.entries(timeLeft).map(([unit, value]) => (
                        <div key={unit} className="flex-1">
                          {/* <div className="bg-gray-800 rounded-lg p-3 text-center">
                            <div className="text-2xl font-bold mb-1">{value}</div>
                            <div className="text-xs text-gray-400">{unit}</div>
                          </div> */}
                          <div className="bg-gray-800 rounded-lg p-2 text-center min-w-0">
  <div className="text-xl font-bold mb-0.5">{value}</div>
  <div className="text-[10px] text-gray-400">{unit}</div>
</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center w-full">
                        <p className="text-lg font-semibold">Results are now available!</p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-gray-300 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      <span>
                        {parsedResultDate ? parsedResultDate.toLocaleDateString() : resultDate}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      <span>
                        {parsedResultDate
                          ? parsedResultDate.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })
                          : ""}
                      </span>
                    </div>
                  </div>
                  <a
                    href={whatsAppLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[85%] flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black hover:bg-gray-100"
                    onClick={handleClickPlacementClubLink}
                  >
                    <Bell className="w-5 h-5" />
                    Set Result Reminder
                  </a>
                </div>

                <div className="space-y-0">
                  <div ref={domainRef}>
                    <DomainSelector
                      isHighlighted={highlightDomain}
                      onSaveDomain={(saved) => { if (saved) setIsDomainSaved(true); }}
                      isSaving={isSaving}
                      saveMessage={saveMessage}
                      userId={userId}
                      userEmail={userEmail}
                    />
                  </div>
                  <ProfileCard
                    profileRef={profileRef}
                    highlightProfile={highlightProfile}
                    onUpdateClick={handleUpdateClickLink}
                  />
                </div>
              </div>
            )}

            {/* Hiring Partners — refund on only */}
            {refundProgram === "on" && (
              <HiringPartnersSection companies={mobileCompanies} />
            )}

            {/* Bottom CTA */}
            {sessionStorage.getItem("source") === "app" ? (
              <button
                // onClick={() => window.close()}
                onClick={() => {
                  // Deep-link back to the iStudio app; window.close() is a no-op inside
                  // the in-app browser (SFSafariVC / Android Custom Tabs) the app uses.
                  window.location.href = "istudio://exam-return";
                  setTimeout(() => { try { window.close(); } catch (e) {} }, 400);
                }}
                className="flex-1 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-gray-800 rounded-lg hover:bg-blue-500 transition-colors mt-8 shadow-md"
              >
                <LayoutDashboard className="w-5 h-5" />
                Close &amp; Return to App
              </button>
            ) : (
              <a
                href="https://dashboard.internshipstudio.com"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-400 transition-colors mt-8 shadow-md"
              >
                <LayoutDashboard className="w-5 h-5" />
                Go back to dashboard
              </a>
            )}
          </div>
        </>
      )}

      {showQRWhatsApp && (
        <QRCodeModal
          platform="WhatsApp"
          qrLink={whatsAppLink}
          onClose={() => setShowQRWhatsApp(false)}
        />
      )}

      {showRetestModal && (
        <RetestModal
          onClose={handleContinueWithoutRetest}
          onConfirmRetest={handleRetestRequest}
        />
      )}
    </div>
  );
};

export default ResultsPage;




















// import React, { useState, useEffect, useRef, useContext } from "react";
// import { UserContext } from "../App";
// import { useNavigate } from "react-router-dom";
// import toast, { Toaster } from "react-hot-toast";

// import {
//   Bell,
//   Calendar,
//   Clock,
//   MessageCircle,
//   UserCircle,
//   QrCode,
//   X,
//   RefreshCw,
//   ChevronDown,
//   Briefcase,
//   LayoutDashboard,
//   Upload,
//   Upload as UploadIcon, FileText, CheckCircle2
// } from "lucide-react";
// import { QRCodeSVG } from "qrcode.react";
// import axios from "axios";

// // Function to parse date strings with ordinal suffixes and set time to 10:00 AM
// function parseDateString(dateString) {
//   const cleanedDateString = dateString.replace(/(\d+)(st|nd|rd|th)/, "$1");
//   const date = new Date(cleanedDateString);
//   date.setHours(10, 0, 0, 0);
//   return date;
// }

// const QRCodeModal = ({ onClose, platform, qrLink }) => (
//   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//     <div className="bg-white rounded-2xl max-w-sm w-full p-6">
//       <div className="flex justify-between items-center mb-6">
//         {/* <h3 className="text-xl font-bold">Join {platform}</h3> */}
//         <h3 className="text-xl font-bold">Join Whatsapp</h3>
//         <button
//           onClick={onClose}
//           className="hover:bg-gray-100 p-2 rounded-full"
//         >
//           <X className="w-6 h-6" />
//         </button>
//       </div>
//       <div className="bg-gray-50 aspect-square rounded-xl flex items-center justify-center mb-6">
//         <QRCodeSVG value={qrLink} size={200} />
//       </div>
//       <p className="text-center text-gray-600">
//         {/* Scan to join our {platform} community */}
//         Scan to join our Whatsapp Group
//       </p>
//     </div>
//   </div>
// );


// const RetestModal = ({ onClose, onConfirmRetest }) => (
//   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//     <div className="bg-white rounded-2xl max-w-md w-full p-6">
//       <div className="flex flex-col items-center text-center">
//         <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
//           <RefreshCw className="w-8 h-8 text-orange-600" />
//         </div>
//         <h3 className="text-xl font-bold mb-2">Retest Available</h3>
//         <p className="text-gray-600 mb-6">
//           It seems like your exam was submitted by mistake. Would you like to
//           retake the test?
//         </p>
//         <div className="flex gap-3 w-full">
//           <button
//             onClick={onClose}
//             className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
//           >
//             No, Continue
//           </button>
//           <button
//             onClick={onConfirmRetest}
//             className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
//           >
//             Yes, Retest
//           </button>
//         </div>
//       </div>
//     </div>
//   </div>
// );

// // const DomainSelector = ({
// //   selectedDomain,
// //   onDomainChange,
// //   domains,
// //   isHighlighted,
// //   customDomain,
// //   onCustomDomainChange,
// //   onSaveDomain,
// //   isSaving,
// //   saveMessage,
// //   userId,
// //   userEmail,
// //   selectedDomainName,
// // }) => {
// //   const [showOtherInput, setShowOtherInput] = useState(false);

// //   // Set showOtherInput based on initial customDomain
// //   useEffect(() => {
// //     setShowOtherInput(!!customDomain && !selectedDomain);
// //   }, [customDomain, selectedDomain]);

// //   const handleDomainChange = (e) => {
// //     const value = e.target.value;
// //     if (value === "other") {
// //       setShowOtherInput(true);
// //       onDomainChange("");
// //     } else {
// //       setShowOtherInput(false);
// //       onDomainChange(value);
// //     }
// //   };

// //   // Check if domain has been successfully saved
// //   const isDomainSaved = saveMessage && saveMessage.type === "success";

// //   return (
// //     <div
// //       className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 mb-4${isHighlighted ? " ring-4 ring-blue-500 ring-opacity-50" : ""
// //         }`}
// //     >
// //       <div className="flex items-center gap-3 mb-4">
// //         <div className="bg-blue-50 p-2 rounded-full">
// //           <Briefcase className="w-5 h-5 text-blue-500" />
// //         </div>
// //         <h3 className="font-semibold">Choose your preferred domain</h3>
// //       </div>

// //       {/* Main content area - domain select and save button side by side */}
// //       <div className="flex flex-col md:flex-row gap-3 items-start">
// //         {/* Left side - domain selection */}
// //         <div className="flex-1 w-full md:w-auto">
// //           <div className="relative">
// //             <select
// //               value={showOtherInput ? "other" : selectedDomain}
// //               onChange={handleDomainChange}
// //               className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
// //             >
// //               <option value="">Select domain...</option>
// //               {domains.map((d) => (
// //                 <option key={d.id} value={d.id.toString()}>
// //                   {d.title}
// //                 </option>
// //               ))}
// //               {/* <option value="other">Other</option> */}
// //             </select>
// //             <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
// //           </div>

// //           {showOtherInput && (
// //             <input
// //               type="text"
// //               value={customDomain}
// //               onChange={(e) => onCustomDomainChange(e.target.value)}
// //               placeholder="Type your preferred domain..."
// //               className="w-full mt-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
// //             />
// //           )}
// //         </div>

// //         {/* Right side - save button */}
// //         <div className="md:flex-shrink-0 w-full md:w-auto md:min-w-[180px]">
// //           <button
// //             onClick={onSaveDomain}
// //             disabled={
// //               isSaving ||
// //               (!selectedDomain && (!showOtherInput || !customDomain.trim())) ||
// //               isDomainSaved
// //             }
// //             className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${isDomainSaved
// //               ? "bg-green-600 text-white cursor-default"
// //               : "bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
// //               }`}
// //           >
// //             {isSaving ? (
// //               <>
// //                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
// //                 Saving...
// //               </>
// //             ) : isDomainSaved ? (
// //               <>
// //                 <svg
// //                   className="w-4 h-4"
// //                   fill="currentColor"
// //                   viewBox="0 0 20 20"
// //                 >
// //                   <path
// //                     fillRule="evenodd"
// //                     d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
// //                     clipRule="evenodd"
// //                   />
// //                 </svg>
// //                 Domain saved successfully
// //               </>
// //             ) : (
// //               "Save Selection"
// //             )}
// //           </button>
// //         </div>
// //       </div>

// //       {/* Note and status message */}
// //       {(selectedDomain || (showOtherInput && customDomain)) && (
// //         <div className="mt-3 space-y-3">
// //           <div className="p-3 bg-blue-50 rounded-lg">
// //             <p className="text-sm text-blue-700">
// //               Note: You can change your domain later
// //             </p>
// //           </div>
// //         </div>
// //       )}
// //     </div>
// //   );
// // };


// const DomainSelector = ({
//   isHighlighted,
//   onSaveDomain,
//   isSaving,
//   saveMessage,
//   userId,
//   userEmail,
// }) => {
//   const [masterDomains, setMasterDomains] = useState([]);
//   const [selectedDomain, setSelectedDomain] = useState("");
//   const [selectedSubdomain, setSelectedSubdomain] = useState("");
//   const [filteredSubdomains, setFilteredSubdomains] = useState([]);
//   const [isDomainSaved, setIsDomainSaved] = useState(false);

//   useEffect(() => {
//     const fetchMasterDomains = async () => {
//       try {
//         const res = await fetch("https://api.internshipstudio.com/api/getMasterDomains.php");
//         const data = await res.json();
//         if (data.success && data.data) {
//           setMasterDomains(data.data);
//           setFilteredSubdomains(data.data); // show all by default
//         }
//       } catch (err) {
//         console.error("Error fetching master domains:", err);
//       }
//     };
//     fetchMasterDomains();
//   }, []);

//   // Get unique domain names
//   const uniqueDomains = [...new Set(masterDomains.map((d) => d.domain_name))];

//   // Filter subdomains based on selected domain
//   useEffect(() => {
//     if (selectedDomain) {
//       setFilteredSubdomains(masterDomains.filter((d) => d.domain_name === selectedDomain));
//     } else {
//       setFilteredSubdomains(masterDomains);
//     }
//   }, [selectedDomain, masterDomains]);

//   const handleSubdomainChange = (subdomain_name) => {
//     setSelectedSubdomain(subdomain_name);
//     // Auto-select parent domain
//     const match = masterDomains.find((d) => d.subdomain_name === subdomain_name);
//     if (match) {
//       setSelectedDomain(match.domain_name);
//     }
//     setIsDomainSaved(false);
//   };

//   const handleDomainChange = (domain_name) => {
//     setSelectedDomain(domain_name);
//     setSelectedSubdomain(""); // reset subdomain when domain changes
//     setIsDomainSaved(false);
//   };

//   const canSave = selectedSubdomain && selectedDomain;

//   const handleSave = async () => {
//     const params = new URLSearchParams();
//     params.append("user_id", userId.toString());
//     params.append("email", userEmail);
//     params.append("domain_name", selectedDomain);
//     params.append("subdomain_name", selectedSubdomain);
//     params.append("instant_result", "off");

//     try {
//       const res = await fetch("https://api.internshipstudio.com/api/saveUserDomain.php", {
//         method: "POST",
//         headers: { "Content-Type": "application/x-www-form-urlencoded" },
//         body: params.toString(),
//       });
//       const result = await res.json();
//       if (result.success) {
//         setIsDomainSaved(true);
//         onSaveDomain && onSaveDomain(true);
//       }
//     } catch (err) {
//       console.error("Error saving domain:", err);
//     }
//   };

//   return (
//     <div
//       className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 mb-4 ${
//         isHighlighted ? "ring-4 ring-blue-500 ring-opacity-50" : ""
//       }`}
//     >
//       <div className="flex items-center gap-3 mb-4">
//         <div className="bg-blue-50 p-2 rounded-full">
//           <Briefcase className="w-5 h-5 text-blue-500" />
//         </div>
//         <h3 className="font-semibold">Choose your preferred domain</h3>
//       </div>

//       {/* <div className="flex flex-col gap-3">
        
//         <div className="relative">
//           <label className="text-xs text-gray-500 mb-1 block">Domain</label>
//           <select
//             value={selectedDomain}
//             onChange={(e) => handleDomainChange(e.target.value)}
//             className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
//           >
//             <option value="">All Domains</option>
//             {uniqueDomains.map((d) => (
//               <option key={d} value={d}>{d}</option>
//             ))}
//           </select>
//           <ChevronDown className="absolute right-3 top-[60%] transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
//         </div>

        
//         <div className="relative">
//           <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
//           <select
//             value={selectedSubdomain}
//             onChange={(e) => handleSubdomainChange(e.target.value)}
//             className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
//           >
//             <option value="">Select specialization...</option>
//             {filteredSubdomains.map((d) => (
//               <option key={d.id} value={d.subdomain_name}>{d.subdomain_name}</option>
//             ))}
//           </select>
//           <ChevronDown className="absolute right-3 top-[60%] transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
//         </div> */}

//         <div className="flex flex-col gap-3">
//         {/* Domain + Subdomain side by side */}
//         <div className="flex flex-col sm:flex-row gap-3">
//           {/* Domain Dropdown */}
//           <div className="relative flex-1">
//             <label className="text-xs text-gray-500 mb-1 block">Domain</label>
//             <select
//               value={selectedDomain}
//               onChange={(e) => handleDomainChange(e.target.value)}
//               className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
//             >
//               <option value="">All Domains</option>
//               {uniqueDomains.map((d) => (
//                 <option key={d} value={d}>{d}</option>
//               ))}
//             </select>
//             <ChevronDown className="absolute right-3 top-[60%] transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
//           </div>

//           {/* Subdomain Dropdown */}
//           <div className="relative flex-1">
//             <label className="text-xs text-gray-500 mb-1 block">Specialization</label>
//             <select
//               value={selectedSubdomain}
//               onChange={(e) => handleSubdomainChange(e.target.value)}
//               className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg appearance-none cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
//             >
//               <option value="">Select specialization...</option>
//               {filteredSubdomains.map((d) => (
//                 <option key={d.id} value={d.subdomain_name}>{d.subdomain_name}</option>
//               ))}
//             </select>
//             <ChevronDown className="absolute right-3 top-[60%] transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
//           </div>
//         </div>

        
//         <button
//           onClick={handleSave}
//           disabled={isSaving || !canSave || isDomainSaved}
//           className={`w-full px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
//             isDomainSaved
//               ? "bg-green-600 text-white cursor-default"
//               : "bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
//           }`}
//         >
//           {isSaving ? (
//             <>
//               <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
//               Saving...
//             </>
//           ) : isDomainSaved ? (
//             <>
//               <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
//                 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
//               </svg>
//               Domain saved successfully
//             </>
//           ) : (
//             "Save Selection"
//           )}
//         </button>

//         {selectedDomain && selectedSubdomain && !isDomainSaved && (
//           <div className="p-3 bg-blue-50 rounded-lg">
//             <p className="text-sm text-blue-700">Note: You can change your domain later</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// const JourneyStep = ({
//   title,
//   status,
//   isCompleted,
//   isLast,
//   onJoinClick,
//   onUpdateClick,
//   onDomainClick,
// }) => (
//   <div className="flex-1 flex items-center">
//     <div className="flex flex-col items-center">
//       <div className="relative">
//         <div
//           className={`w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? "bg-green-500 text-white" : "bg-gray-200"
//             }`}
//         >
//           {isCompleted ? (
//             <CheckCircle2 className="w-5 h-5" />
//           ) : (
//             <div className="w-2 h-2 rounded-full bg-red-500 animate-[ping_1s_ease-in-out_infinite]" />
//           )}
//         </div>
//       </div>
//       <p className="text-sm font-medium mt-2 text-center">{title}</p>
//       <p
//         className={`text-xs mt-1 ${isCompleted ? "text-green-600" : "text-gray-500"
//           } ${title === "Results & Internship Allocation" ? "font-bold" : ""}`}
//       >
//         {status}
//       </p>
//       {title === "Select Domain" && !isCompleted && (
//         <button
//           onClick={onDomainClick}
//           className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
//         >
//           Select
//         </button>
//       )}
//       {title === "Join Groups" && !isCompleted && (
//         <button
//           onClick={onJoinClick}
//           className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
//         >
//           Join
//         </button>
//       )}
//       {title === "Complete Profile" && !isCompleted && (
//         <button
//           onClick={onUpdateClick}
//           className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors"
//         >
//           Update
//         </button>
//       )}
//     </div>
//     {!isLast && (
//       <div className="flex-1 mx-2">
//         <div
//           className={`h-0.5 ${isCompleted ? "bg-green-500" : "bg-gray-200"}`}
//         />
//       </div>
//     )}
//   </div>
// );

// const ResultsPage = () => {
//   const userData = useContext(UserContext);
//   const navigate = useNavigate();
//   const [showQRWhatsApp, setShowQRWhatsApp] = useState(false);
//   const [showResumeModal, setShowResumeModal] = useState(false);
//   const [showOffer, setShowOffer] = useState(false);
//   const [timer, setTimer] = useState("15:00");
//   const [amount, setAmount] = useState(0);
//   const [faqs, setFaqs] = useState([
//     {
//       q: "What's included in the ATS-Friendly Resume Templates?",
//       a: "You'll receive 3 professionally designed resume templates optimized for Applicant Tracking Systems (ATS). These templates help you get noticed by recruiters.",
//       open: false,
//     },
//     {
//       q: "Who teaches the Resume Building Course?",
//       a: "The course is led by a Senior HR professional with over 10 years of recruitment experience, sharing insider strategies on crafting high-impact resumes.",
//       open: false,
//     },
//     {
//       q: "How will I receive the templates and course?",
//       a: "After purchase, you'll receive instant email access with all templates and credentials for the online course.",
//       open: false,
//     },

//   ]);

//   const [journeyBlink, setJourneyBlink] = useState(false);
//   const [hasResume, setHasResume] = useState(!!userData?.resume);
//   const [isPaid, setIsPaid] = useState(false);



//   const [showRetestModal, setShowRetestModal] = useState(false);
//   const [showMainContent, setShowMainContent] = useState(true); // New state to control main content visibility
//   const [timeLeft, setTimeLeft] = useState({});
//   const [highlightCommunityGroups, setHighlightCommunityGroups] =
//     useState(false);
//   const [highlightProfile, setHighlightProfile] = useState(false);
//   const [highlightDomain, setHighlightDomain] = useState(false);
//   const [resultDate, setResultDate] = useState("");
//   const [examDate, setExamDate] = useState("");
//   const [whatsAppLink, setWhatsAppLink] = useState("");
//   const [isLoading, setIsLoading] = useState(true);
//   const [parsedResultDate, setParsedResultDate] = useState(null);
//   const [parsedExamDate, setParsedExamDate] = useState(null);
//   const [retestLoading, setRetestLoading] = useState(false);
//   const [selectedDomain, setSelectedDomain] = useState("");
//   const [selectedDomainName, setSelectedDomainName] = useState("");
//   const [internships, setInternships] = useState([]);
//   const [customDomain, setCustomDomain] = useState("");
//   const [isSaving, setIsSaving] = useState(false);
//   const [saveMessage, setSaveMessage] = useState(null);
//   const [isDomainSaved, setIsDomainSaved] = useState(false);
//   const [userId, setUserId] = useState("");
//   const [userEmail, setUserEmail] = useState("");
//   const [name, setName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");

//   // Add refs for scrolling
//   const communityGroupsRef = useRef(null);
//   const profileRef = useRef(null);
//   const domainRef = useRef(null);

//   useEffect(() => {
//     const fetchUserName = async () => {
//       if (!userId) return;
//       try {
//         const res = await fetch("https://dashboard.internshipstudio.com/api/get_user_name.php", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ user_id: userId }),
//         });
//         const result = await res.json();
//         if (result.status === "success") {
//           setName(result.data.name);
//           setAmount(result.data.amount);
//           setEmail(result.data.email)
//           setPhone(result.data.phone)
//         }
//       } catch (error) {
//         console.error("Error fetching user name:", error);
//       }
//     };
//     fetchUserName();
//   }, [userId]);



//   useEffect(() => {
//     if (showOffer) {
//       let timeLeft = 15 * 60;
//       const interval = setInterval(() => {
//         timeLeft--;
//         if (timeLeft <= 0) {
//           clearInterval(interval);
//           setTimer("00:00");
//         } else {
//           const m = Math.floor(timeLeft / 60);
//           const s = timeLeft % 60;
//           setTimer(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
//         }
//       }, 1000);
//       return () => clearInterval(interval);
//     }
//   }, [showOffer]);

//   useEffect(() => {
//     const script = document.createElement("script");
//     script.src = "https://checkout.razorpay.com/v1/checkout.js";
//     script.async = true;
//     document.body.appendChild(script);
//     return () => document.body.removeChild(script);
//   }, []);

//   useEffect(() => {
//     // setShowResumeModal(true);
//     console.log('userData: ', userData)
//     if (userData && !userData.resume) {
//       setTimeout(() => {
//         setShowResumeModal(true);
//       }, 1000);
//     }
//   }, [userData]);


//   useEffect(() => {
//     // Blink the "Select Domain" step when page loads
//     setJourneyBlink(true);
//     const timer = setTimeout(() => setJourneyBlink(false), 2500);
//     return () => clearTimeout(timer);
//   }, []);

//   useEffect(() => {
//     // Blink "Select Domain" when page loads
//     setJourneyBlink(true);
//     const timer = setTimeout(() => setJourneyBlink(false), 2500);
//     return () => clearTimeout(timer);
//   }, []);



//   // Load saved domain from localStorage on component mount
//   useEffect(() => {
//     try {
//       const savedDomainData = localStorage.getItem("userDomainSelection");
//       if (savedDomainData) {
//         const parsedData = JSON.parse(savedDomainData);

//         if (parsedData.customDomain) {
//           setCustomDomain(parsedData.customDomain);
//         } else if (parsedData.domainId && parsedData.domainName) {
//           setSelectedDomain(parsedData.domainId);
//           setSelectedDomainName(parsedData.domainName);
//         }

//         // Set a success message if domain was previously saved
//         setSaveMessage({
//           type: "success",
//           text: "Domain saved successfully",
//         });

//         setIsDomainSaved(true);
//       }
//     } catch (error) {
//       console.error("Error loading domain from localStorage", error);
//     }
//   }, []);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         // Get user info directly from sessionStorage
//         const sessionUserId = sessionStorage.getItem("user_id");
//         const sessionUserEmail = sessionStorage.getItem("userEmail");

//         if (sessionUserId) {
//           setUserId(sessionUserId);
//         }

//         if (sessionUserEmail) {
//           setUserEmail(sessionUserEmail);
//         }

//         const resultDateResponse = await fetch(
//           "https://api.internshipstudio.com/api/fetchMisc.php?action=result_date"
//         );
//         const resultDateData = await resultDateResponse.json();
//         setResultDate(resultDateData.value);
//         setParsedResultDate(parseDateString(resultDateData.value));

//         const examDateResponse = await fetch(
//           "https://api.internshipstudio.com/api/fetchMisc.php?action=exam_date"
//         );
//         const examDateData = await examDateResponse.json();
//         setExamDate(examDateData.value);
//         setParsedExamDate(parseDateString(examDateData.value));

//         const waLinkResponse = await fetch(
//           "https://api.internshipstudio.com/api/fetchMisc.php?action=end_exam_wa_link"
//         );
//         const waLinkData = await waLinkResponse.json();
//         setWhatsAppLink(waLinkData.value);

//         // Fetch internships data for domains
//         const internshipResponse = await fetch(
//           "https://api.internshipstudio.com/api/getInternship.php"
//         );
//         const internshipData = await internshipResponse.json();

//         if (internshipData.success && internshipData.data) {
//           setInternships(internshipData.data);
//         }

//         // Check user's exam result for retest eligibility
//         await checkExamResult();

//         setIsLoading(false);
//       } catch (error) {
//         console.error("Error fetching data", error);
//         setIsLoading(false);
//       }
//     };

//     fetchData();
//   }, [userData]);

//   const checkExamResult = async () => {
//     try {
//       const myHeaders = new Headers();
//       myHeaders.append("Content-Type", "application/json");

//       const requestOptions = {
//         method: "POST",
//         headers: myHeaders,
//         body: JSON.stringify({
//           user_id: userData.user_id,
//           exam_id: 1,
//         }),
//       };

//       const response = await fetch(
//         "https://examapi.internshipstudio.com/api/fetch_result",
//         requestOptions
//       );
//       const result = await response.json();

//       // Check if score is 9 or less
//       if (result.status === 200 && result.data && result.data.score <= 9) {
//         setShowRetestModal(true);
//         setShowMainContent(false); // Hide main content when retest modal is shown
//       }
//       if (result.status === 200 && result.data && result.data.score > 9) {
//         const sessionUserId = sessionStorage.getItem("user_id");
//         const res = await axios.post("https://dashboard.internshipstudio.com/api/send_email_after_exam_completed.php", { user_id: sessionUserId });
//         console.log(res.status.success);
//       }
//     } catch (error) {
//       console.error("Error checking exam result:", error);
//     }
//   };


//   const toggleFaq = (index) => {
//     setFaqs((prev) =>
//       prev.map((item, i) => ({ ...item, open: i === index ? !item.open : false }))
//     );
//   };


//   const handleRetestRequest = async () => {
//     setRetestLoading(true);
//     try {
//       const myHeaders = new Headers();
//       myHeaders.append("userid", sessionStorage.getItem("user_id"));
//       myHeaders.append("hash", sessionStorage.getItem("hash"));
//       myHeaders.append("Content-Type", "application/json");

//       const requestOptions = {
//         method: "POST",
//         headers: myHeaders,
//         body: JSON.stringify({
//           exam_id: 1,
//         }),
//       };

//       const response = await fetch(
//         "https://examapi.internshipstudio.com/api/request_retest",
//         requestOptions
//       );
//       const result = await response.json();

//       if (result.status === 200) {
//         setShowRetestModal(false);
//         navigate("/");
//       } else {
//         console.error("Error requesting retest:", result.message);
//         alert("Failed to initiate retest. Please try again.");
//       }
//     } catch (error) {
//       console.error("Error requesting retest:", error);
//       alert("Failed to initiate retest. Please try again.");
//     } finally {
//       setRetestLoading(false);
//     }
//   };

//   // Modified handler for "No, Continue" button
//   const handleContinueWithoutRetest = async() => {
//     setShowRetestModal(false);
//     setShowMainContent(true); // Show main content when user chooses to continue
//     const sessionUserId = sessionStorage.getItem("user_id");
//         const res = await axios.post("https://dashboard.internshipstudio.com/api/send_email_after_exam_completed.php", { user_id: sessionUserId });
//         console.log(res.status.success);
//   };

//   useEffect(() => {
//     const calculateTimeLeft = () => {
//       if (!parsedResultDate) return;
//       const now = new Date();
//       const difference = parsedResultDate - now;
//       if (difference > 0) {
//         setTimeLeft({
//           days: Math.floor(difference / (1000 * 60 * 60 * 24)),
//           hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
//           minutes: Math.floor((difference / 1000 / 60) % 60),
//         });
//       } else {
//         setTimeLeft({});
//       }
//     };
//     calculateTimeLeft();
//     const timer = setInterval(calculateTimeLeft, 60000);
//     return () => clearInterval(timer);
//   }, [parsedResultDate]);

//   const saveDomainSelection = async ({
//     domain_id,
//     domain_name,
//     custom_domain,
//   }) => {
//     if (!userId || !userEmail) {
//       console.error("Missing user information:", { userId, userEmail });
//       setSaveMessage({
//         type: "error",
//         text: "User information is missing. Please log in again.",
//       });
//       return false;
//     }

//     if (!domain_name && !custom_domain) {
//       setSaveMessage({
//         type: "error",
//         text: "Please select a domain before saving.",
//       });
//       return false;
//     }

//     setIsSaving(true);
//     setSaveMessage(null);

//     const params = new URLSearchParams();
//     params.append("user_id", userId.toString());
//     params.append("email", userEmail);
//     params.append("instant_result", "on");

//     if (domain_name) {
//       params.append("domain_name", domain_name);
//     }
//     if (custom_domain && custom_domain.trim()) {
//       params.append("custom_domain", custom_domain.trim());
//     }

//     try {
//       const res = await fetch(
//         "https://api.internshipstudio.com/api/saveUserDomain.php",
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/x-www-form-urlencoded" },
//           body: params.toString(),
//         }
//       );

//       const result = await res.json();

//       if (result.success) {
//         // Save domain selection to localStorage
//         try {
//           const domainData = {
//             domainId: domain_id,
//             domainName: domain_name,
//             customDomain: custom_domain,
//             savedAt: new Date().toISOString(),
//           };
//           localStorage.setItem(
//             "userDomainSelection",
//             JSON.stringify(domainData)
//           );
//         } catch (storageError) {
//           console.error("Error saving to localStorage:", storageError);
//         }

//         setSaveMessage({
//           type: "success",
//           text: `Domain ${result.data?.operation || "saved"} successfully!`,
//         });

//         setIsDomainSaved(true);
//         return true;
//       } else {
//         setSaveMessage({
//           type: "error",
//           text: result.message || "Failed to save domain selection",
//         });
//         return false;
//       }
//     } catch (err) {
//       console.error("Error saving domain selection", err);
//       setSaveMessage({
//         type: "error",
//         text: "Network error. Please try again.",
//       });
//       return false;
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   const handleDomainChange = (domainId) => {
//     setSelectedDomain(domainId);

//     const selectedDomainObj = internships.find(
//       (d) => d.id.toString() === domainId
//     );
//     const domainName = selectedDomainObj ? selectedDomainObj.title : "";
//     setSelectedDomainName(domainName);

//     setCustomDomain("");
//     setSaveMessage(null);
//     setIsDomainSaved(false);
//   };

//   const handleCustomDomainChange = (value) => {
//     setCustomDomain(value);
//     setSelectedDomain("");
//     setSelectedDomainName("");
//     setSaveMessage(null);
//     setIsDomainSaved(false);
//   };

//   const handleSaveDomain = async () => {
//     if (selectedDomain && selectedDomainName) {
//       await saveDomainSelection({
//         domain_id: selectedDomain,
//         domain_name: selectedDomainName,
//         custom_domain: "",
//       });
//     } else if (customDomain.trim()) {
//       await saveDomainSelection({
//         domain_id: null,
//         domain_name: null,
//         custom_domain: customDomain.trim(),
//       });
//     }
//   };

//   const scrollToSection = (ref) => {
//     ref.current?.scrollIntoView({
//       behavior: "smooth",
//       block: "center",
//     });
//   };

//   const handleSetReminder = () => {
//     setHighlightCommunityGroups(true);
//     setHighlightProfile(true);
//     setHighlightDomain(true);

//     setTimeout(() => {
//       setHighlightCommunityGroups(false);
//       setHighlightProfile(false);
//       setHighlightDomain(false);
//     }, 2000);
//   };

//   const handleJoinClick = () => {
//     setHighlightCommunityGroups(true);
//     setTimeout(() => setHighlightCommunityGroups(false), 2000);
//     scrollToSection(communityGroupsRef);
//   };

//   const handleUpdateClick = () => {
//     setHighlightProfile(true);
//     setTimeout(() => setHighlightProfile(false), 2000);
//     scrollToSection(profileRef);
//   };

//   const handleDomainClick = () => {
//     setHighlightDomain(true);
//     setTimeout(() => setHighlightDomain(false), 2000);
//     scrollToSection(domainRef);
//   };

//   const handleUpdateClickLink = () => {
//     setHighlightProfile(true);
//     setTimeout(() => setHighlightProfile(false), 2000);
//     if (sessionStorage.getItem("source") === "app") {
//       toast("Please update your profile in the app after closing this page.");
//     } else {
//       window.location.href = "https://dashboard.internshipstudio.com/profile";
//     }
//   };


//   const handleClickPlacementClubLink = async() => {
//     const res = await axios.post("https://dashboard.internshipstudio.com/api/assign_link.php", {assigned_link: whatsAppLink, user_id: userId})
//     if(res.status === true){
//       console.log("link assigned successfully!");
//     }
//     if(res.status === false){
//       console.log(res.message);
//     }
//   }
  

//   if (isLoading) {
//     return (
//       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
//         <div className="animate-pulse text-lg font-semibold text-gray-600">
//           Loading...
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
//       {/* Only show main content when showMainContent is true */}
//       {showMainContent && (
//         <>
//           {/* <div className="bg-black text-white py-6 px-4 text-center sticky top-0 z-9999"> */}
//           <div className="bg-black text-white py-6 px-4 text-center sticky top-0 z-50">

//             <p className="text-lg font-medium flex items-center justify-center flex-wrap gap-2">
//               <span>
//                 Results will be announced on{" "}
//                 {parsedResultDate
//                   ? parsedResultDate.toLocaleString()
//                   : resultDate}
//               </span>

//               {Object.entries(timeLeft).length > 0 ? (
//                 <>
//                   <span>-</span>
//                   {Object.entries(timeLeft).map(([unit, value]) => (
//                     <span
//                       key={unit}
//                       className="bg-white rounded px-2 py-2 text-xs"
//                     >
//                       <span className="text-gray-900 font-bold">{value}</span>
//                       <span className="text-gray-900 ml-1">{unit}</span>
//                     </span>
//                   ))}
//                 </>
//               ) : (
//                 <span className="text-green-400 font-semibold ml-2">
//                   Results are now available!
//                 </span>
//               )}
//             </p>
//           </div>
//           <div className="max-w-4xl mx-auto px-4 py-3 md:py-6">
//             <div className="text-center mb-2 md:mb-6">
//               <div className="inline-block mb-1 md:mb-3 bg-green-50 text-green-700 px-4 py-2 rounded-full font-medium">
//                 <CheckCircle2 className="w-4 h-4 inline mr-2" />
//                 Exam Completed Successfully 🎉
//               </div>
//               <h1 className="text-2xl md:text-4xl font-bold">
//                 Get Ready for Your Results!
//               </h1>
//             </div>
            

//             <div className="bg-white rounded-2xl shadow-lg p-6 overflow-x-auto mb-8">
//               <h3 className="text-lg font-semibold mb-6">Your Journey</h3>
//               <div className="flex min-w-[750px] px-4">
//                 <JourneyStep
//                   title="Registration"
//                   status="Completed"
//                   isCompleted={true}
//                 />
//                 <JourneyStep
//                   title="Exam"
//                   status="Completed"
//                   isCompleted={true}
//                 />
//                 <JourneyStep
//                   title="Join Groups"
//                   status="Pending"
//                   isCompleted={false}
//                   onJoinClick={handleJoinClick}
//                 />
//                 <JourneyStep
//                   title="Select Domain"
//                   status={isDomainSaved ? "Completed" : "Pending"}
//                   isCompleted={isDomainSaved}
//                   onDomainClick={handleDomainClick}
//                 />
//                 <JourneyStep
//                   title="Complete Profile"
//                   status="Pending"
//                   isCompleted={false}
//                   onUpdateClick={handleUpdateClick}
//                 />
//                 <JourneyStep
//                   title="Results & Internship Allocation"
//                   status={
//                     parsedResultDate
//                       ? parsedResultDate.toLocaleDateString(undefined, {
//                         day: "numeric",
//                         month: "short",
//                         hour: "numeric",
//                         minute: "numeric",
//                       })
//                       : resultDate
//                   }
//                   isCompleted={false}
//                   isLast={true}
//                 />
//               </div>
//             </div>






//             {/* <div ref={domainRef}>
//               <DomainSelector
//                 selectedDomain={selectedDomain}
//                 onDomainChange={handleDomainChange}
//                 domains={internships}
//                 isHighlighted={highlightDomain}
//                 customDomain={customDomain}
//                 onCustomDomainChange={handleCustomDomainChange}
//                 onSaveDomain={handleSaveDomain}
//                 isSaving={isSaving}
//                 saveMessage={saveMessage}
//                 userId={userId}
//                 userEmail={userEmail}
//                 selectedDomainName={selectedDomainName}
//               />
//             </div> */}
//             <div
//                   ref={communityGroupsRef}
//                   className={`bg-white mb-4 rounded-2xl shadow-lg p-6 transition-all duration-300 ${highlightCommunityGroups
//                       ? "ring-4 ring-blue-500 ring-opacity-50"
//                       : ""
//                     }`}
//                 >
//                   <div className="flex items-center gap-3 mb-4">
//                     <div className="bg-blue-50 p-2 rounded-full">
//                       <MessageCircle className="w-5 h-5 text-blue-500" />
//                     </div>
//                     <h3 className="font-semibold">Join the Placement Club - <span className="font-normal text-[14px]"> All Internship & Result Updates Here</span></h3>
//                   </div>
//                   <div className="flex gap-2">
//                     <a
//                       href={whatsAppLink}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="flex-1 flex items-center justify-center h-fit gap-2 px-4 py-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
//                       onClick={handleClickPlacementClubLink}
//                     >
//                       <MessageCircle className="w-5 h-5" />
                      
//                       Click To Join
//                     </a>
                    
//                     <button
//   onClick={() => {
//     setShowQRWhatsApp(true);
//     handleClickPlacementClubLink();
//   }}
//   className="flex items-center justify-center px-3 py-0 text-white rounded-lg transition-colors"
// >
//   {/* <QrCode className="w-5 h-5" /> */}
//   <img src="qr.gif" />
// </button>

//                     </div>


                    
//                   </div>


// {/* <div className="grid md:grid-cols-2 gap-6"> */}
// {/* <div class="grid grid-cols-[40%_60%] gap-6"> */}
// <div class="grid grid-cols-1 md:grid-cols-[40%_60%] gap-6">
//               <div className="bg-black text-white rounded-2xl p-6 relative">
//                 <h2 className="text-xl font-bold mb-4">Results Coming In</h2>
//                 <div className="flex flex-wrap gap-4 mb-6">
//                   {Object.entries(timeLeft).length > 0 ? (
//                     Object.entries(timeLeft).map(([unit, value]) => (
//                       <div key={unit} className="flex-1">
//                         <div className="bg-gray-800 rounded-lg p-3 text-center">
//                           <div className="text-2xl font-bold mb-1">{value}</div>
//                           <div className="text-xs text-gray-400">{unit}</div>
//                         </div>
//                       </div>
//                     ))
//                   ) : (
//                     <div className="text-center w-full">
//                       <p className="text-lg font-semibold">
//                         Results are now available!
//                       </p>
//                     </div>
//                   )}
//                 </div>
//                 <div className="flex items-center gap-4 text-gray-300 mb-4">
//                   <div className="flex items-center gap-2">
//                     <Calendar className="w-5 h-5" />
//                     <span>
//                       {parsedResultDate
//                         ? parsedResultDate.toLocaleDateString()
//                         : resultDate}
//                     </span>
//                   </div>
//                   <div className="flex items-center gap-2">
//                     <Clock className="w-5 h-5" />
//                     <span>
//                       {parsedResultDate
//                         ? parsedResultDate.toLocaleTimeString([], {
//                           hour: "2-digit",
//                           minute: "2-digit",
//                           hour12: true,
//                         })
//                         : ""}
//                     </span>
//                   </div>
//                 </div>
//                 {/* <button
//                   onClick={handleSetReminder}
//                   className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black hover:bg-gray-100"
//                 >
//                   <Bell className="w-5 h-5" />
//                   Set Result Reminder
//                 </button> */}
//                 <a
//                   href={whatsAppLink}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                   className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[85%] flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white text-black hover:bg-gray-100"
//                   onClick={handleClickPlacementClubLink}
//                 >
//                   <Bell className="w-5 h-5" />
//                   Set Result Reminder
//                 </a>
//               </div>
//               <div className="space-y-6">
//                 {/* <div
//                   ref={communityGroupsRef}
//                   className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 ${highlightCommunityGroups
//                       ? "ring-4 ring-blue-500 ring-opacity-50"
//                       : ""
//                     }`}
//                 >
//                   <div className="flex items-center gap-3 mb-4">
//                     <div className="bg-blue-50 p-2 rounded-full">
//                       <MessageCircle className="w-5 h-5 text-blue-500" />
//                     </div>
//                     <h3 className="font-semibold">Join Community Groups</h3>
//                   </div>
//                   <div className="flex gap-2">
//                     <a
//                       href={whatsAppLink}
//                       target="_blank"
//                       rel="noopener noreferrer"
//                       className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
//                       onClick={handleClickPlacementClubLink}
//                     >
//                       <MessageCircle className="w-5 h-5" />
                      
//                       Placement Club
//                     </a>
                    
//                     <button
//   onClick={() => {
//     setShowQRWhatsApp(true);
//     handleClickPlacementClubLink();
//   }}
//   className="flex items-center justify-center px-3 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
// >
//   <QrCode className="w-5 h-5" />
// </button>

//                     </div>


                    
//                   </div> */}
//                   <div ref={domainRef}>
//               {/* <DomainSelector
//                 selectedDomain={selectedDomain}
//                 onDomainChange={handleDomainChange}
//                 domains={internships}
//                 isHighlighted={highlightDomain}
//                 customDomain={customDomain}
//                 onCustomDomainChange={handleCustomDomainChange}
//                 onSaveDomain={handleSaveDomain}
//                 isSaving={isSaving}
//                 saveMessage={saveMessage}
//                 userId={userId}
//                 userEmail={userEmail}
//                 selectedDomainName={selectedDomainName}
//               /> */}
//               <DomainSelector
//   isHighlighted={highlightDomain}
//   onSaveDomain={(saved) => { if (saved) setIsDomainSaved(true); }}
//   isSaving={isSaving}
//   saveMessage={saveMessage}
//   userId={userId}
//   userEmail={userEmail}
// />
//             </div>
//                   <div
//                   ref={profileRef}
//                   className={`bg-white rounded-2xl shadow-lg p-6 transition-all duration-300 ${highlightProfile
//                       ? "ring-4 ring-blue-500 ring-opacity-50"
//                       : ""
//                     }`}
//                 >
//                   <div className="flex items-center gap-3 mb-4">
//                     <div className="bg-blue-50 p-2 rounded-full">
//                       <UserCircle className="w-5 h-5 text-blue-500" />
//                     </div>
//                     <h3 className="font-semibold">Complete Your Profile</h3>
//                   </div>
//                   <button
//                     onClick={handleUpdateClickLink}
//                     className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
//                   >
//                     Update Profile
//                   </button>
//                 </div>
//                 </div>
                
//               </div>
//               {sessionStorage.getItem("source") === "app" ? (
//               <button
//                 onClick={() => window.close()}
//                 className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-gray-800 rounded-lg hover:bg-blue-500 transition-colors mt-8 shadow-md"
//               >
//                 <LayoutDashboard className="w-5 h-5" />
//                 Close & Return to App
//               </button>
//               ) : (
//               <a
//                 href="https://dashboard.internshipstudio.com"
//                 rel="noopener noreferrer"
//                 className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-100 text-gray-800 rounded-lg hover:bg-blue-500 transition-colors mt-8 shadow-md"
//               >
//                 <LayoutDashboard className="w-5 h-5" />
//                 Go back to dashboard
//               </a>
//               )}
//             </div>
    
                    


           
            

//         </>
//       )}

//       {/* QR Code Modal */}
//       {showQRWhatsApp && (
//         <QRCodeModal
//           platform="WhatsApp"
//           qrLink={whatsAppLink}
//           onClose={() => setShowQRWhatsApp(false)}
//         />
//       )}

//       {/* {showResumeModal && (
//         <ResumeUploadModal
//           onClose={() => setShowResumeModal(false)}
//           onUploadSuccess={() => {
//             setHasResume(true);
//             toast.success("Resume uploaded successfully!");
//           }}
//         />
//       )} */}


//       {/* Retest Modal */}
//       {showRetestModal && (
//         <RetestModal
//           onClose={handleContinueWithoutRetest}
//           onConfirmRetest={handleRetestRequest}
//         />
//       )}
//     </div>
//   );
// };

// export default ResultsPage;