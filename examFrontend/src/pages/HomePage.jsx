// import React, { useEffect, useState, useContext } from "react";
// import { UserContext } from "../App";
// import { Link, useNavigate } from "react-router-dom";
// import {
//   FileText,
//   ClipboardList,
//   Info,
//   CheckCircle,
//   AlertCircle,
// } from "lucide-react";

// const HomePage = () => {
//   const userData = useContext(UserContext);

//   const [examStatus, setExamStatus] = useState(null);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const fetchExamStatus = async () => {
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

//       try {
//         const response = await fetch(
//           "https://examapi.internshipstudio.com/api/fetch_result",
//           requestOptions
//         );
//         const result = await response.json();

//         if (result.status === 200) {
//           // Check if it's a retest scenario
//           if (result.data.status === "retest_initiated") {
//             setExamStatus("retest_available");
//           } else {
//             setExamStatus("completed");
//             // Redirect if exam is completed and not a retest
//             navigate("/end-exam");
//           }
//         } else {
//           setExamStatus("not_started");
//         }
//       } catch (error) {
//         console.error("Error fetching exam status:", error);
//         setExamStatus("not_started");
//       }
//     };

//     fetchExamStatus();
//   }, [userData, navigate]);

//   // Don't redirect if it's a retest scenario, show the exam interface
//   if (examStatus === "completed") {
//     return null; // Return null while redirecting
//   }

//   const getStartButtonText = () => {
//     if (examStatus === "retest_available") {
//       return "Start Retest";
//     }
//     return "Start Exam";
//   };

//   const getHeaderText = () => {
//     if (examStatus === "retest_available") {
//       return "Ready for Your Retest";
//     }
//     return "Internship Common Aptitude Test";
//   };

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header with conditional messaging */}
//       <div className="bg-white border-b border-gray-100 mb-8">
//         <div className="max-w-4xl mx-auto px-4 py-8">
//           <h1
//             className="text-3xl font-bold text-center"
//             style={{ color: "#f38f3d" }}
//           >
//             {getHeaderText()}
//           </h1>
//           {examStatus === "retest_available" && (
//             <p className="text-center text-gray-600 mt-2">
//               You have been given another opportunity to take the exam
//             </p>
//           )}
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="max-w-4xl mx-auto px-4 pb-12">
//         <div className="space-y-8">
//           {/* Important Instructions Section */}
//           <section className="bg-white rounded-xl p-8 border border-gray-100">
//             <h2
//               className="text-xl font-semibold mb-6 flex items-center"
//               style={{ color: "#f38f3d" }}
//             >
//               <AlertCircle className="w-5 h-5 mr-2" />
//               Important Instructions
//             </h2>
//             <div className="bg-gray-50 rounded-lg p-6">
//               <ul className="space-y-4">
//                 {[
//                   "Do not refresh any tab of the exam panel otherwise all answers which you have clicked would be unticked & exam might get submitted.",
//                   "Do not click on submit button until & unless you want to submit your exam.",
//                   "You can give your exam by using a laptop, tablet or phone.",
//                   "You will need to finish your exam in one go. Login & logout to the exam portal is prohibited.",
//                   "Make sure you have good internet connectivity to avoid any disruptions between the exam.",
//                   "Kindly submit your exam once you are done with answering the questions & then only leave the exam panel if you want to submit before time.",
//                 ].map((instruction, index) => (
//                   <li key={index} className="flex items-start">
//                     <CheckCircle
//                       className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0"
//                       style={{ color: "#f38f3d" }}
//                     />
//                     <span className="text-gray-700">{instruction}</span>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           </section>

//           {/* Quick Overview Section */}
//           <section className="bg-white rounded-xl p-8 border border-gray-100">
//             <h2
//               className="text-xl font-semibold mb-6 flex items-center"
//               style={{ color: "#f38f3d" }}
//             >
//               <Info className="w-5 h-5 mr-2" />
//               Quick Overview
//             </h2>
//             <div className="grid grid-cols-3 gap-2 md:gap-6">
//               <div className="bg-gray-50 rounded-lg p-2 md:p-6 text-center">
//                 <div className="text-xl md:text-2xl mb-1 md:mb-2">⏱️</div>
//                 <h4 className="font-medium text-gray-800 text-sm md:text-base">
//                   Duration
//                 </h4>
//                 <p className="text-gray-600 text-xs md:text-base">30 minutes</p>
//               </div>
//               <div className="bg-gray-50 rounded-lg p-2 md:p-6 text-center">
//                 <div className="text-xl md:text-2xl mb-1 md:mb-2">📝</div>
//                 <h4 className="font-medium text-gray-800 text-sm md:text-base">
//                   Questions
//                 </h4>
//                 <p className="text-gray-600 text-xs md:text-base">30 total</p>
//               </div>
//               <div className="bg-gray-50 rounded-lg p-2 md:p-6 text-center">
//                 <div className="text-xl md:text-2xl mb-1 md:mb-2">🎯</div>
//                 <h4 className="font-medium text-gray-800 text-sm md:text-base">
//                   Total Marks
//                 </h4>
//                 <p className="text-gray-600 text-xs md:text-base">90 points</p>
//               </div>
//             </div>
//           </section>

//           {/* Marking Scheme Section */}
//           <section className="bg-white rounded-xl p-8 border border-gray-100">
//             <h2
//               className="text-xl font-semibold mb-6 flex items-center"
//               style={{ color: "#f38f3d" }}
//             >
//               <ClipboardList className="w-5 h-5 mr-2" />
//               Marking Scheme
//             </h2>
//             <div className="grid grid-cols-3 gap-2 md:gap-4">
//               <div className="bg-gray-50 p-2 md:p-4 rounded-lg text-center">
//                 <div className="font-medium text-gray-800 text-sm md:text-base">
//                   Correct Answer
//                 </div>
//                 <div className="text-green-500 font-bold text-base md:text-lg">
//                   +3
//                 </div>
//               </div>
//               <div className="bg-gray-50 p-2 md:p-4 rounded-lg text-center">
//                 <div className="font-medium text-gray-800 text-sm md:text-base">
//                   Wrong Answer
//                 </div>
//                 <div className="text-red-500 font-bold text-base md:text-lg">
//                   0
//                 </div>
//               </div>
//               <div className="bg-gray-50 p-2 md:p-4 rounded-lg text-center">
//                 <div className="font-medium text-gray-800 text-sm md:text-base">
//                   Total Marks
//                 </div>
//                 <div
//                   className="font-bold text-base md:text-lg"
//                   style={{ color: "#f38f3d" }}
//                 >
//                   90
//                 </div>
//               </div>
//             </div>
//           </section>

//           {/* Exam Format Section */}
//           <section className="bg-white rounded-xl p-8 border border-gray-100">
//             <h2
//               className="text-xl font-semibold mb-6 flex items-center"
//               style={{ color: "#f38f3d" }}
//             >
//               <FileText className="w-5 h-5 mr-2" />
//               Exam Format
//             </h2>
//             <div className="grid grid-cols-3 gap-2 md:gap-6 mb-8">
//               {[
//                 { title: "Logical Reasoning", questions: 15, icon: "🧠" },
//                 { title: "Quantitative Aptitude", questions: 10, icon: "📊" },
//                 { title: "Visual Reasoning", questions: 5, icon: "👁️" },
//               ].map((section) => (
//                 <div
//                   key={section.title}
//                   className="bg-gray-50 p-2 md:p-6 rounded-lg text-center"
//                 >
//                   <div className="text-2xl md:text-3xl mb-1 md:mb-3">
//                     {section.icon}
//                   </div>
//                   <h4 className="font-medium text-gray-800 text-sm md:text-base">
//                     {section.title}
//                   </h4>
//                   <p className="text-gray-600 text-xs md:text-base">
//                     {section.questions} questions
//                   </p>
//                 </div>
//               ))}
//             </div>
//           </section>
//         </div>
//       </div>
//       {/* Fixed Start Button */}
//       <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
//         <div className="max-w-4xl mx-auto flex justify-center">
//           <button
//             onClick={() => navigate("/quiz")}
//             style={{ backgroundColor: "#f38f3d" }}
//             className="px-12 py-4 rounded-full text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg"
//           >
//             {getStartButtonText()}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default HomePage;











// import React, { useState, useRef } from "react";
// import { useNavigate } from "react-router-dom";

// const ICATInstructions = () => {
//   const navigate = useNavigate();
//   const [modalOpen, setModalOpen] = useState(false);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const fileInputRef = useRef(null);

//   const handleStartExam = () => {
//     if (window.confirm("Are you ready to start the exam? Make sure you have read all the instructions.")) {
//       setModalOpen(true);
//       document.body.style.overflow = "hidden";
//     }
//   };

//   const closeModal = () => {
//     setModalOpen(false);
//     document.body.style.overflow = "auto";
//     setSelectedFile(null);
//   };

//   const handleFileSelect = (e) => {
//     const file = e.target.files[0];
//     if (file) {
//       if (file.size > 5 * 1024 * 1024) {
//         alert("File size must be less than 5MB");
//         return;
//       }
//       const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
//       if (!allowed.includes(file.type)) {
//         alert("Please upload a PDF, DOC, or DOCX file");
//         return;
//       }
//       setSelectedFile(file);
//     }
//   };

//   const handleUpload = () => {
//     if (!selectedFile) {
//       alert("Please select a file to upload");
//       return;
//     }
//     closeModal();
//     alert("Resume uploaded successfully! Redirecting to exam...");
//     navigate("/quiz");
//   };

//   const handleSkip = () => {
//     if (window.confirm("Are you sure you want to skip uploading your resume? You can upload it later.")) {
//       closeModal();
//       navigate("/quiz");
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-100 px-4 py-6 pb-28">
//       <div className="max-w-3xl mx-auto animate-[slideUp_0.6s_ease-out]">
//         {/* Exam Card */}
//         <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
//           {/* Header */}
//           <div className="relative bg-indigo-500 text-white text-center p-8 overflow-hidden">
//             <div className="absolute top-[-50%] right-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)] animate-[pulse_3s_ease-in-out_infinite]" />
//             <div className="relative z-10">
//               <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-semibold mb-3">
//                 📋 Important Instructions
//               </div>
//               <h1 className="text-2xl font-bold">iCAT Exam Instructions & Guidelines</h1>
//             </div>
//           </div>

//           {/* Body */}
//           <div className="p-8">
//             {/* Progress Section */}
//             <section className="mb-10">
//               <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//                 📍 Your Current Progress
//               </h2>
//               <div className="relative flex justify-between items-center">
//                 <div className="absolute top-[21px] left-[5%] right-[5%] h-[3px] bg-gray-200 before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-[20%] before:bg-green-500 transition-all" />
//                 {[
//                   { icon: "✅", label: "Journey\nRegistration", state: "completed" },
//                   { icon: "🎯", label: "iCAT\nExam", state: "active" },
//                   { icon: "📄", label: "Resume\nUpload", state: "pending" },
//                   { icon: "📊", label: "Result & Internship Allocation", state: "pending" },
//                 ].map((step, i) => (
//                   <div
//                     key={i}
//                     className={`flex flex-col items-center gap-2 relative z-10 ${
//                       step.state === "completed"
//                         ? "text-green-500"
//                         : step.state === "active"
//                         ? "text-indigo-500"
//                         : "text-gray-400"
//                     }`}
//                   >
//                     <div
//                       className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold ${
//                         step.state === "completed"
//                           ? "bg-green-500 border-green-500 text-white"
//                           : step.state === "active"
//                           ? "bg-indigo-500 border-indigo-500 text-white animate-pulse"
//                           : "bg-gray-100 border-gray-200 text-gray-400"
//                       }`}
//                     />
//                     <div className="text-xs font-semibold text-center whitespace-pre-line">
//                       <div className="mb-1">{step.icon}</div>
//                       {step.label}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </section>

//             {/* Guidelines */}
//             <section className="mb-10">
//               <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//                 ⚠️ Important Guidelines
//               </h2>
//               <div className="space-y-3">
//                 {[
//                   {
//                     icon: "❌",
//                     color: "border-red-500",
//                     text: "Do not refresh the page once the exam has started.",
//                   },
//                   {
//                     icon: "✅",
//                     color: "border-green-500",
//                     text: "Laptops, PCs, Mobiles, and Tablets are allowed.",
//                   },
//                   {
//                     icon: "❌",
//                     color: "border-red-500",
//                     text: "No switching of tabs during the exam session.",
//                   },
//                 ].map((rule, i) => (
//                   <div
//                     key={i}
//                     className={`flex items-start gap-3 bg-gray-50 border-l-4 ${rule.color} rounded-xl px-4 py-3 hover:bg-gray-100 transition`}
//                   >
//                     <span className="text-lg">{rule.icon}</span>
//                     <p className="text-gray-700 text-sm font-medium">{rule.text}</p>
//                   </div>
//                 ))}
//               </div>
//             </section>

//             {/* Exam Structure */}
//             <section>
//               <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//                 📝 Exam Structure
//               </h2>
//               <div className="flex justify-center items-center gap-2 bg-amber-100 text-amber-800 font-semibold rounded-lg py-3 mb-5">
//                 ⏰ Total Duration: <span>30 Minutes</span>
//               </div>

//               <table className="w-full border-collapse overflow-hidden rounded-xl shadow-md">
//                 <thead className="bg-indigo-500 text-white">
//                   <tr>
//                     <th className="text-left p-4 text-sm font-semibold">Topic</th>
//                     <th className="text-center p-4 text-sm font-semibold">Questions</th>
//                     <th className="text-center p-4 text-sm font-semibold">Marks</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {[
//                     { icon: "🧠", topic: "Logical Reasoning", q: 15, marks: 45 },
//                     { icon: "🔢", topic: "Quantitative Aptitude", q: 10, marks: 30 },
//                     { icon: "👁️", topic: "Visual Reasoning", q: 5, marks: 15 },
//                   ].map((item, i) => (
//                     <tr
//                       key={i}
//                       className="hover:bg-gray-50 border-b border-gray-100"
//                     >
//                       <td className="p-4 flex items-center gap-2">
//                         <span>{item.icon}</span>
//                         <span>{item.topic}</span>
//                       </td>
//                       <td className="p-4 text-center">{item.q}</td>
//                       <td className="p-4 text-center text-indigo-600 font-semibold">
//                         {item.marks}
//                       </td>
//                     </tr>
//                   ))}
//                   <tr className="bg-indigo-50 font-bold text-gray-800">
//                     <td className="p-4">Total</td>
//                     <td className="p-4 text-center">30</td>
//                     <td className="p-4 text-center">90</td>
//                   </tr>
//                 </tbody>
//               </table>

//               <div className="inline-flex items-center justify-center gap-2 bg-green-100 text-green-800 px-4 py-3 rounded-lg mt-5 font-semibold">
//                 ⚡ No Negative Marking
//               </div>
//             </section>
//           </div>
//         </div>
//       </div>

//       {/* Sticky Footer */}
//       <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 z-50">
//         <div className="max-w-3xl mx-auto flex justify-center">
//           <button
//             onClick={handleStartExam}
//             className="bg-green-500 hover:bg-green-600 text-white text-lg font-semibold px-10 py-4 rounded-xl shadow-lg flex items-center gap-2 transition-all"
//           >
//             Start Exam 🚀
//           </button>
//         </div>
//       </div>

//       {/* Resume Upload Modal */}
//       {modalOpen && (
//         <div
//           className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1000] px-4"
//           onClick={(e) => e.target === e.currentTarget && closeModal()}
//         >
//           <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-[slideUp_0.4s_ease-out] overflow-hidden">
//             <div className="relative bg-gradient-to-r from-indigo-500 to-violet-500 text-white p-6">
//               <button
//                 onClick={closeModal}
//                 className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center text-lg"
//               >
//                 ×
//               </button>
//               <div className="flex items-center gap-3">
//                 <div className="bg-white/20 rounded-full p-3 text-2xl">📄</div>
//                 <div>
//                   <h2 className="font-bold text-lg">Upload Your Resume</h2>
//                   <p className="text-sm opacity-80">Help us match you better</p>
//                 </div>
//               </div>
//             </div>

//             <div className="p-6">
//               <p className="text-gray-600 text-sm mb-4">
//                 Upload your resume to get personalized internship recommendations based on your skills and experience.
//               </p>

//               {!selectedFile && (
//                 <div
//                   className="border-2 border-dashed border-gray-300 rounded-xl py-10 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition"
//                   onClick={() => fileInputRef.current.click()}
//                 >
//                   <div className="text-4xl mb-2">📎</div>
//                   <p className="font-semibold text-gray-800">Drop your resume here</p>
//                   <p className="text-sm text-gray-500">
//                     or <span className="text-indigo-500 font-semibold cursor-pointer">browse files</span> from your device
//                   </p>
//                   <input
//                     type="file"
//                     ref={fileInputRef}
//                     accept=".pdf,.doc,.docx"
//                     className="hidden"
//                     onChange={handleFileSelect}
//                   />
//                 </div>
//               )}

//               {selectedFile && (
//                 <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg p-3 mt-3">
//                   <span className="text-2xl">📄</span>
//                   <div className="flex-1">
//                     <p className="text-green-800 font-semibold text-sm">{selectedFile.name}</p>
//                     <p className="text-green-600 text-xs">
//                       {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
//                     </p>
//                   </div>
//                   <button
//                     onClick={() => setSelectedFile(null)}
//                     className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200"
//                   >
//                     ×
//                   </button>
//                 </div>
//               )}

//               <div className="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-3 mt-4">
//                 <p className="text-xs text-blue-800">
//                   💡 Tip: Accepted formats: PDF, DOC, DOCX (Max size: 5MB)
//                 </p>
//               </div>
//             </div>

//             <div className="px-6 pb-6 flex gap-3">
//               <button
//                 onClick={handleSkip}
//                 className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
//               >
//                 Skip for Now
//               </button>
//               <button
//                 disabled={!selectedFile}
//                 onClick={handleUpload}
//                 className={`flex-1 py-3 rounded-lg font-semibold transition ${
//                   selectedFile
//                     ? "bg-indigo-500 hover:bg-indigo-600 text-white"
//                     : "bg-indigo-300 cursor-not-allowed text-white"
//                 }`}
//               >
//                 Upload Resume
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ICATInstructions;










// import React, { useContext } from "react";
// import { useNavigate } from "react-router-dom";
// import { UserContext } from "../App"; // adjust path as needed

// const ICATInstructions = () => {
//   const navigate = useNavigate();
//   const userData = useContext(UserContext);

//   const handleStartExam = () => {
//     navigate("/quiz");
//   };

//   const steps = [
//     { icon: "✅", label: "Journey\nRegistration", state: "completed" },
//     { icon: "🎯", label: "iCAT\nExam", state: "active" },
//     {
//       icon: userData?.resume ? "✅" : "📄",
//       label: "Resume\nShortlisting",
//       state: userData?.resume ? "completed" : "pending",
//     },
//     {
//       icon: "📊",
//       label: "Result & Internship\nAllocation",
//       state: "pending",
//     },
//   ];

//   return (
//     <div className="min-h-screen bg-gray-100 px-4 py-6 pb-28">
//       <div className="max-w-3xl mx-auto animate-[slideUp_0.6s_ease-out]">
//         {/* Exam Card */}
//         <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
//           {/* Header */}
//           <div className="relative bg-indigo-500 text-white text-center p-8 overflow-hidden">
//             <div className="absolute top-[-50%] right-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)] animate-[pulse_3s_ease-in-out_infinite]" />
//             <div className="relative z-10">
//               <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-semibold mb-3">
//                 📋 Important Instructions
//               </div>
//               <h1 className="text-2xl font-bold">
//                 iCAT Exam Instructions & Guidelines
//               </h1>
//             </div>
//           </div>

//           {/* Body */}
//           <div className="p-8">
//             {/* Progress Section */}
//             <section className="mb-10">
//               <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//                 📍 Your Current Progress
//               </h2>
//               <div className="relative flex justify-between items-center">
//                 <div className="absolute top-[21px] left-[5%] right-[5%] h-[3px] bg-gray-200 before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-[20%] before:bg-green-500 transition-all" />
//                 {steps.map((step, i) => (
//                   <div
//                     key={i}
//                     className={`flex flex-col items-center gap-2 relative z-10 ${
//                       step.state === "completed"
//                         ? "text-green-500"
//                         : step.state === "active"
//                         ? "text-indigo-500"
//                         : "text-gray-400"
//                     }`}
//                   >
//                     <div
//                       className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold ${
//                         step.state === "completed"
//                           ? "bg-green-500 border-green-500 text-white"
//                           : step.state === "active"
//                           ? "bg-indigo-500 border-indigo-500 text-white animate-pulse"
//                           : "bg-gray-100 border-gray-200 text-gray-400"
//                       }`}
//                     />
//                     <div className="text-xs font-semibold text-center whitespace-pre-line">
//                       <div className="mb-1">{step.icon}</div>
//                       {step.label}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </section>

//             {/* Guidelines */}
//             <section className="mb-10">
//               <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//                 ⚠️ Important Guidelines
//               </h2>
//               <div className="space-y-3">
//                 {[
//                   {
//                     icon: "❌",
//                     color: "border-red-500",
//                     text: "Do not refresh the page once the exam has started.",
//                   },
//                   {
//                     icon: "✅",
//                     color: "border-green-500",
//                     text: "Laptops, PCs, Mobiles, and Tablets are allowed.",
//                   },
//                   {
//                     icon: "❌",
//                     color: "border-red-500",
//                     text: "No switching of tabs during the exam session.",
//                   },
//                 ].map((rule, i) => (
//                   <div
//                     key={i}
//                     className={`flex items-start gap-3 bg-gray-50 border-l-4 ${rule.color} rounded-xl px-4 py-3 hover:bg-gray-100 transition`}
//                   >
//                     <span className="text-lg">{rule.icon}</span>
//                     <p className="text-gray-700 text-sm font-medium">
//                       {rule.text}
//                     </p>
//                   </div>
//                 ))}
//               </div>
//             </section>

//             {/* Exam Structure */}
//             <section>
//               <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//                 📝 Exam Structure
//               </h2>
//               <div className="flex justify-center items-center gap-2 bg-amber-100 text-amber-800 font-semibold rounded-lg py-3 mb-5">
//                 ⏰ Total Duration: <span>30 Minutes</span>
//               </div>

//               <table className="w-full border-collapse overflow-hidden rounded-xl shadow-md">
//                 <thead className="bg-indigo-500 text-white">
//                   <tr>
//                     <th className="text-left p-4 text-sm font-semibold">
//                       Topic
//                     </th>
//                     <th className="text-center p-4 text-sm font-semibold">
//                       Questions
//                     </th>
//                     <th className="text-center p-4 text-sm font-semibold">
//                       Marks
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {[
//                     { icon: "🧠", topic: "Logical Reasoning", q: 15, marks: 45 },
//                     {
//                       icon: "🔢",
//                       topic: "Quantitative Aptitude",
//                       q: 10,
//                       marks: 30,
//                     },
//                     { icon: "👁️", topic: "Visual Reasoning", q: 5, marks: 15 },
//                   ].map((item, i) => (
//                     <tr
//                       key={i}
//                       className="hover:bg-gray-50 border-b border-gray-100"
//                     >
//                       <td className="p-4 flex items-center gap-2">
//                         <span>{item.icon}</span>
//                         <span>{item.topic}</span>
//                       </td>
//                       <td className="p-4 text-center">{item.q}</td>
//                       <td className="p-4 text-center text-indigo-600 font-semibold">
//                         {item.marks}
//                       </td>
//                     </tr>
//                   ))}
//                   <tr className="bg-indigo-50 font-bold text-gray-800">
//                     <td className="p-4">Total</td>
//                     <td className="p-4 text-center">30</td>
//                     <td className="p-4 text-center">90</td>
//                   </tr>
//                 </tbody>
//               </table>

//               <div className="inline-flex items-center justify-center gap-2 bg-green-100 text-green-800 px-4 py-3 rounded-lg mt-5 font-semibold">
//                 ⚡ No Negative Marking
//               </div>
//             </section>
//           </div>
//         </div>
//       </div>

//       {/* Sticky Footer */}
//       <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 z-50">
//         <div className="max-w-3xl mx-auto flex justify-center">
//           <button
//             onClick={handleStartExam}
//             className="bg-green-500 hover:bg-green-600 text-white text-lg font-semibold px-10 py-4 rounded-xl shadow-lg flex items-center gap-2 transition-all"
//           >
//             Start Exam 🚀
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ICATInstructions;



// import React, { useEffect, useState, useContext } from "react";
// import { useNavigate } from "react-router-dom";
// import { UserContext } from "../App";
// import { AlertCircle, CheckCircle, Info, ClipboardList, FileText } from "lucide-react";

// const ICATInstructions = () => {
//   const userData = useContext(UserContext);
//   const [examStatus, setExamStatus] = useState(null);
//   const navigate = useNavigate();

//   // ✅ Fetch exam status dynamically
//   useEffect(() => {
//     const fetchExamStatus = async () => {
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

//       try {
//         const response = await fetch(
//           "https://examapi.internshipstudio.com/api/fetch_result",
//           requestOptions
//         );
//         const result = await response.json();

//         if (result.status === 200) {
//           if (result.data.status === "retest_initiated") {
//             setExamStatus("retest_available");
//           } else {
//             setExamStatus("completed");
//             navigate("/end-exam");
//           }
//         } else {
//           setExamStatus("not_started");
//         }
//       } catch (error) {
//         console.error("Error fetching exam status:", error);
//         setExamStatus("not_started");
//       }
//     };

//     fetchExamStatus();
//   }, [userData, navigate]);

//   if (examStatus === "completed") {
//     return null; // return nothing while redirecting
//   }

//   const getStartButtonText = () => {
//     if (examStatus === "retest_available") return "Start Retest";
//     return "Start Exam";
//   };

//   const getHeaderText = () => {
//     if (examStatus === "retest_available") return "Ready for Your Retest";
//     return "iCAT Exam Instructions & Guidelines";
//   };

//   // ✅ Step Tracker (Dynamic Resume Check)
//   const steps = [
//     { icon: "✅", label: "Journey\nRegistration", state: "completed" },
//     { icon: "🎯", label: "iCAT\nExam", state: "active" },
//     {
//       icon: userData?.resume ? "✅" : "📄",
//       label: "Resume\nShortlisting",
//       state: userData?.resume ? "completed" : "pending",
//     },
//     {
//       icon: "📊",
//       label: "Result & Internship\nAllocation",
//       state: "pending",
//     },
//   ];

//   // ✅ Handle Start Exam Logic
//   const handleStartExam = () => {
//     if (
//       window.confirm(
//         "Are you ready to start the exam? Please ensure you have read all instructions carefully."
//       )
//     ) {
//       navigate("/quiz");
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white border-b border-gray-100 mb-8">
//         <div className="max-w-4xl mx-auto px-4 py-8 text-center">
//           <h1 className="text-3xl font-bold" style={{ color: "#4f46e5" }}>
//             {getHeaderText()}
//           </h1>
//           {examStatus === "retest_available" && (
//             <p className="text-gray-600 mt-2">
//               You have been granted another attempt to improve your score.
//             </p>
//           )}
//         </div>
//       </div>

//       <div className="max-w-4xl mx-auto px-4 pb-20 space-y-8">
//         {/* ✅ Progress Tracker */}
//         <section className="bg-white rounded-xl p-8 border border-gray-100">
//           <h2
//             className="text-xl font-semibold mb-6 flex items-center"
//             style={{ color: "#4f46e5" }}
//           >
//             <ClipboardList className="w-5 h-5 mr-2" />
//             Your Current Progress
//           </h2>
//           <div className="relative flex justify-between items-center">
//             <div className="absolute top-[21px] left-[5%] right-[5%] h-[3px] bg-gray-200 before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-[25%] before:bg-green-500 transition-all" />
//             {steps.map((step, i) => (
//               <div
//                 key={i}
//                 className={`flex flex-col items-center gap-2 relative z-10 ${
//                   step.state === "completed"
//                     ? "text-green-500"
//                     : step.state === "active"
//                     ? "text-indigo-500"
//                     : "text-gray-400"
//                 }`}
//               >
//                 <div
//                   className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold ${
//                     step.state === "completed"
//                       ? "bg-green-500 border-green-500 text-white"
//                       : step.state === "active"
//                       ? "bg-indigo-500 border-indigo-500 text-white animate-pulse"
//                       : "bg-gray-100 border-gray-200 text-gray-400"
//                   }`}
//                 />
//                 <div className="text-xs font-semibold text-center whitespace-pre-line">
//                   <div className="mb-1">{step.icon}</div>
//                   {step.label}
//                 </div>
//               </div>
//             ))}
//           </div>
//         </section>

//         {/* ✅ Important Guidelines */}
//         <section className="bg-white rounded-xl p-8 border border-gray-100">
//           <h2
//             className="text-xl font-semibold mb-6 flex items-center"
//             style={{ color: "#4f46e5" }}
//           >
//             <AlertCircle className="w-5 h-5 mr-2" />
//             Important Guidelines
//           </h2>
//           <div className="bg-gray-50 rounded-lg p-6">
//             <ul className="space-y-4">
//               {[
//                 "Do not refresh or reload the page once the exam has started.",
//                 "Switching tabs or windows may lead to automatic submission.",
//                 "Ensure a stable internet connection throughout the exam.",
//                 "Use a laptop, PC, or mobile device in a distraction-free environment.",
//                 "Click the submit button only after reviewing all answers.",
//               ].map((instruction, i) => (
//                 <li key={i} className="flex items-start">
//                   <CheckCircle
//                     className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0 text-indigo-500"
//                   />
//                   <span className="text-gray-700">{instruction}</span>
//                 </li>
//               ))}
//             </ul>
//           </div>
//         </section>

//         {/* ✅ Exam Structure */}
//         <section className="bg-white rounded-xl p-8 border border-gray-100">
//           <h2
//             className="text-xl font-semibold mb-6 flex items-center"
//             style={{ color: "#4f46e5" }}
//           >
//             <Info className="w-5 h-5 mr-2" />
//             Exam Structure
//           </h2>
//           <div className="grid grid-cols-3 gap-4">
//             <div className="bg-gray-50 rounded-lg p-6 text-center">
//               <div className="text-2xl mb-2">⏱️</div>
//               <h4 className="font-medium text-gray-800">Duration</h4>
//               <p className="text-gray-600">30 Minutes</p>
//             </div>
//             <div className="bg-gray-50 rounded-lg p-6 text-center">
//               <div className="text-2xl mb-2">📝</div>
//               <h4 className="font-medium text-gray-800">Questions</h4>
//               <p className="text-gray-600">30 Total</p>
//             </div>
//             <div className="bg-gray-50 rounded-lg p-6 text-center">
//               <div className="text-2xl mb-2">🎯</div>
//               <h4 className="font-medium text-gray-800">Total Marks</h4>
//               <p className="text-gray-600">90 Points</p>
//             </div>
//           </div>
//         </section>

//         {/* ✅ Marking Scheme */}
//         <section className="bg-white rounded-xl p-8 border border-gray-100">
//           <h2
//             className="text-xl font-semibold mb-6 flex items-center"
//             style={{ color: "#4f46e5" }}
//           >
//             <ClipboardList className="w-5 h-5 mr-2" />
//             Marking Scheme
//           </h2>
//           <div className="grid grid-cols-3 gap-4">
//             <div className="bg-gray-50 p-4 rounded-lg text-center">
//               <p className="font-medium text-gray-800">Correct Answer</p>
//               <p className="text-green-500 font-bold text-lg">+3</p>
//             </div>
//             <div className="bg-gray-50 p-4 rounded-lg text-center">
//               <p className="font-medium text-gray-800">Wrong Answer</p>
//               <p className="text-red-500 font-bold text-lg">0</p>
//             </div>
//             <div className="bg-gray-50 p-4 rounded-lg text-center">
//               <p className="font-medium text-gray-800">Total Marks</p>
//               <p className="text-indigo-600 font-bold text-lg">90</p>
//             </div>
//           </div>
//         </section>

//         {/* ✅ Exam Format */}
//         <section className="bg-white rounded-xl p-8 border border-gray-100">
//           <h2
//             className="text-xl font-semibold mb-6 flex items-center"
//             style={{ color: "#4f46e5" }}
//           >
//             <FileText className="w-5 h-5 mr-2" />
//             Exam Format
//           </h2>
//           <div className="grid grid-cols-3 gap-4">
//             {[
//               { title: "Logical Reasoning", questions: 15, icon: "🧠" },
//               { title: "Quantitative Aptitude", questions: 10, icon: "📊" },
//               { title: "Visual Reasoning", questions: 5, icon: "👁️" },
//             ].map((section, index) => (
//               <div
//                 key={index}
//                 className="bg-gray-50 p-6 rounded-lg text-center"
//               >
//                 <div className="text-2xl mb-2">{section.icon}</div>
//                 <h4 className="font-medium text-gray-800">{section.title}</h4>
//                 <p className="text-gray-600">{section.questions} Questions</p>
//               </div>
//             ))}
//           </div>
//         </section>
//       </div>

//       {/* ✅ Sticky Footer */}
//       <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-50">
//         <div className="max-w-4xl mx-auto flex justify-center">
//           <button
//             onClick={handleStartExam}
//             style={{ backgroundColor: "#4f46e5" }}
//             className="px-12 py-4 rounded-full text-white font-medium text-lg hover:opacity-90 transition-opacity shadow-lg"
//           >
//             {getStartButtonText()}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default ICATInstructions;









import React, { useEffect, useState, useContext } from "react";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import axios from "axios";

const ICATInstructions = () => {
  const navigate = useNavigate();
  const userData = useContext(UserContext);
  const [examStatus, setExamStatus] = useState(null);

  // ✅ Fetch exam status and manage redirection
  useEffect(() => {
    const fetchExamStatus = async () => {
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({
          user_id: userData.user_id,
          exam_id: 1,
        }),
      };

      try {
        const response = await fetch(
          "https://examapi.internshipstudio.com/api/fetch_result",
          requestOptions
        );
        const result = await response.json();

        if (result.status === 200) {
          if (result.data.status === "retest_initiated") {
            setExamStatus("retest_available");
          } else {
            setExamStatus("completed");

            try {
              const res = await axios.post(
                "https://dashboard.internshipstudio.com/api/get_user_name.php",
                { user_id: sessionStorage.getItem("user_id") }
              );

              const domain = res?.data?.data?.domain?.toLowerCase() || "live";

              // if (domain === "staging") {
              //   localStorage.setItem('platform', "staging")
              //   navigate("/end-exam-new");
              // } else {
              //   navigate("/end-exam");
              // }
              if (domain === "staging") {

                localStorage.setItem("platform", JSON.stringify({
                  value: "staging",
                  expiry: Date.now() + 3600000 // 1 hour = 3600000ms
                }));

                navigate("/end-exam-new");

              } else {
                navigate("/end-exam");
              }


            } catch (error) {
              console.error("Domain API Failed:", error);
              navigate("/end-exam"); // default fallback
            }

            // navigate("/end-exam");
          }
        } else {
          setExamStatus("not_started");
        }
      } catch (error) {
        console.error("Error fetching exam status:", error);
        setExamStatus("not_started");
      }
    };

    fetchExamStatus();
  }, [userData, navigate]);

  if (examStatus === "completed") return null;

  const handleStartExam = async () => {
    navigate("/quiz");
  };

  const steps = [
    { icon: "✅", label: "Journey\nRegistration", state: "completed" },
    { icon: "✍️", label: "iCAT\nExam", state: "active" },
    {
      icon: userData?.resume ? "✅" : "📄",
      label: "Resume\nShortlisting",
      state: userData?.resume ? "completed" : "pending",
    },
    { icon: "📊", label: "Result & Internship\nAllocation", state: "pending" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6 pb-28">
      <div className="max-w-3xl mx-auto animate-[slideUp_0.6s_ease-out]">
        {/* Exam Card */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-6">
          {/* Header */}
          <div className="relative bg-indigo-500 text-white text-center p-8 overflow-hidden">
            <div className="absolute top-[-50%] right-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)] animate-[pulse_3s_ease-in-out_infinite]" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full text-sm font-semibold mb-3">
                📋 Important Instructions
              </div>
              <h1 className="text-2xl font-bold">
                {examStatus === "retest_available"
                  ? "iCAT Exam Retest Guidelines"
                  : "iCAT Exam Instructions & Guidelines"}
              </h1>
              {examStatus === "retest_available" && (
                <p className="text-sm text-white/80 mt-2">
                  You’ve been given another opportunity to improve your score.
                </p>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            {/* Progress Section */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                📍 Your Current Progress
              </h2>
              <div className="relative flex justify-between items-center">
                <div className="absolute top-[21px] left-[5%] right-[5%] h-[3px] bg-gray-200 before:content-[''] before:absolute before:left-0 before:top-0 before:h-full before:w-[25%] before:bg-green-500 transition-all" />
                {steps.map((step, i) => (
                  <div
                    key={i}
                    className={`flex flex-col items-center gap-2 relative z-10 ${step.state === "completed"
                      ? "text-green-500"
                      : step.state === "active"
                        ? "text-indigo-500"
                        : "text-gray-400"
                      }`}
                  >
                    {/* <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold ${
                        step.state === "completed"
                          ? "bg-green-500 border-green-500 text-white"
                          : step.state === "active"
                          ? "bg-indigo-500 border-indigo-500 text-white animate-pulse"
                          : "bg-gray-100 border-gray-200 text-gray-400"
                      }`}
                    /> */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold ${step.state === "completed"
                        ? "bg-green-500 border-green-500 text-white"
                        : step.state === "active"
                          ? "bg-indigo-500 border-indigo-500 text-white animate-pulse"
                          : "bg-gray-100 border-gray-200 text-gray-400"
                        }`}
                    >
                      {step.state === "completed" && (
                        <Check className="w-6 h-6 text-white" strokeWidth={3} />
                      )}
                    </div>

                    <div className="text-xs font-semibold text-center whitespace-pre-line">
                      <div className="mb-1">{step.icon}</div>
                      {step.label}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Guidelines */}
            <section className="mb-10">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                ⚠️ Important Guidelines
              </h2>
              <div className="space-y-3">
                {[
                  {
                    icon: "❌",
                    color: "border-red-500",
                    text: "Do not refresh or close the page once the exam has started.",
                  },
                  {
                    icon: "✅",
                    color: "border-green-500",
                    text: "You can take the exam on Laptop, PC, Mobile, or Tablet.",
                  },
                  {
                    icon: "❌",
                    color: "border-red-500",
                    text: "Do not switch tabs or windows during the exam.",
                  },
                  {
                    icon: "✅",
                    color: "border-green-500",
                    text: "Ensure stable internet connectivity to avoid interruptions.",
                  },
                ].map((rule, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 bg-gray-50 border-l-4 ${rule.color} rounded-xl px-4 py-3 hover:bg-gray-100 transition`}
                  >
                    <span className="text-lg">{rule.icon}</span>
                    <p className="text-gray-700 text-sm font-medium">
                      {rule.text}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Exam Structure */}
            <section>
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                📝 Exam Structure
              </h2>
              <div className="flex justify-center items-center gap-2 bg-amber-100 text-amber-800 font-semibold rounded-lg py-3 mb-5">
                ⏰ Total Duration: <span>30 Minutes</span>
              </div>

              <table className="w-full border-collapse overflow-hidden rounded-xl shadow-md">
                <thead className="bg-indigo-500 text-white">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold">
                      Topic
                    </th>
                    <th className="text-center p-4 text-sm font-semibold">
                      Questions
                    </th>
                    <th className="text-center p-4 text-sm font-semibold">
                      Marks
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { icon: "🧠", topic: "Logical Reasoning", q: 15, marks: 45 },
                    {
                      icon: "🔢",
                      topic: "Quantitative Aptitude",
                      q: 10,
                      marks: 30,
                    },
                    { icon: "👁️", topic: "Visual Reasoning", q: 5, marks: 15 },
                  ].map((item, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 border-b border-gray-100"
                    >
                      <td className="p-4 flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span>{item.topic}</span>
                      </td>
                      <td className="p-4 text-center">{item.q}</td>
                      <td className="p-4 text-center text-indigo-600 font-semibold">
                        {item.marks}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-indigo-50 font-bold text-gray-800">
                    <td className="p-4">Total</td>
                    <td className="p-4 text-center">30</td>
                    <td className="p-4 text-center">90</td>
                  </tr>
                </tbody>
              </table>

              <div className="inline-flex items-center justify-center gap-2 bg-green-100 text-green-800 px-4 py-3 rounded-lg mt-5 font-semibold">
                ⚡ No Negative Marking
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 z-50">
        <div className="max-w-3xl mx-auto flex justify-center">
          <button
            onClick={handleStartExam}
            className="bg-green-500 hover:bg-green-600 text-white text-lg font-semibold px-10 py-4 rounded-xl shadow-lg flex items-center gap-2 transition-all"
          >
            {examStatus === "retest_available" ? "Start Retest" : "Start Exam"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ICATInstructions;
