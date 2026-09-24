import React, { useState, useEffect, useRef, useContext } from "react";
import { UserContext } from "../App";
import { Link, useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import pdfToText from "react-pdftotext";
import { createWorker } from "tesseract.js";

import {
    Upload,
    Target,
    MessageCircle,
    CheckCircle,
    XCircle,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    QrCode,
    X,
    FileText,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import axios from "axios";


// 📌 INSERT HERE (just below ResumeUploadModal)

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
                    <button onClick={onClose}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        No, Continue
                    </button>

                    <button onClick={onConfirmRetest}
                        className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                        Yes, Retest
                    </button>
                </div>
            </div>
        </div>
    </div>
);


const QRCodeModal = ({ onClose, qrLink }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Join Whatsapp</h3>
                <button
                    onClick={onClose}
                    className="hover:bg-gray-100 p-2 rounded-full"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
            <div className="bg-gray-50 aspect-square rounded-xl flex items-center justify-center mb-6">
                <QRCodeSVG value={qrLink} size={200} />
            </div>
            <p className="text-center text-gray-600">
                Scan to join our Whatsapp Group
            </p>
        </div>
    </div>
);

const ResumeUploadModal = ({ onClose, onUploadSuccess, userId, setResumeUploaded }) => {


    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    // const startAutoUpload = async (selectedFile) => {
    //     setIsUploading(true);
    //     const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

    //     const formData = new FormData();
    //     formData.append("file", selectedFile);
    //     formData.append("user_id", userId.toString());

    //     try {
    //         // 1️⃣ Upload resume
    //         const res = await fetch("https://dashboard.internshipstudio.com/api/upload_resume.php", {
    //             method: "POST",
    //             body: formData
    //         });

    //         const upload = await res.json();
    //         console.log('upload: ', upload)

    //         if (!upload.status === "success") {
    //             toast.error("Resume upload failed");
    //             setIsUploading(false);
    //             return;
    //         }

    //         // toast.success("Resume Uploaded Successfully!");
    //         if (upload.status === "success") {
    //             onUploadSuccess();
    //             onClose();
    //             setIsUploading(false);
    //         }

    //         // 2️⃣ Extract text
    //         const extractedText = await extractTextFromPDF(selectedFile);

    //         if (!extractedText || extractedText.length < 50) {
    //             console.error("Text extraction failed");
    //             return;
    //         }

    //         // 3️⃣ Parse resume
    //         const parseRes = await fetch("https://dashboard.internshipstudio.com/api/parse_resume2.php", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/json" },
    //             body: JSON.stringify({ resume_text: extractedText, user_id: userId.toString() })
    //         });

    //         const parsed = await parseRes.json();
    //         console.log('parsed: ', parsed)

    //     } catch (err) {
    //         console.error("Something went wrong");
    //         console.error(err);
    //     }
    // };

    const startAutoUpload = async (selectedFile) => {
        setIsUploading(true);
        const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');

        try {
            // 1️⃣ Upload resume
            const formData = new FormData();
            formData.append("file", selectedFile);
            formData.append("user_id", userId.toString());

            const res = await fetch(
                "https://dashboard.internshipstudio.com/api/upload_resume.php",
                {
                    method: "POST",
                    body: formData
                }
            );

            const upload = await res.json();

            if (upload.status !== "success") {
                toast.error("Resume upload failed");
                setIsUploading(false);
                return;
            }

            onUploadSuccess();
            onClose();

            // 2️⃣ Parse resume (PDF → backend)
            const parseFormData = new FormData();
            parseFormData.append("resume_pdf", selectedFile); // ✅ IMPORTANT
            parseFormData.append("user_id", userId.toString());

            const parseRes = await fetch(
                "https://dashboard.internshipstudio.com/api/parse_resume2.php",
                {
                    method: "POST",
                    body: parseFormData
                }
            );

            const parsed = await parseRes.json();
            console.log("parsed:", parsed);

        } catch (err) {
            console.error("Upload/Parse failed", err);
        } finally {
            setIsUploading(false);
        }
    };



    const handleChange = async (e) => {

        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            setFile(selected);
            await startAutoUpload(selected);   // ← Auto starts upload
        }
    };


    const extractTextWithOCR = async (file) => {
        try {
            const pdfjs = window.pdfjsLib;
            if (!pdfjs) throw new Error("PDF.js is missing");

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

            const worker = await createWorker("eng");
            let text = "";
            const pages = Math.min(pdf.numPages, 3);

            for (let i = 1; i <= pages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2 });

                let canvas = document.createElement("canvas");
                let ctx = canvas.getContext("2d");
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: ctx, viewport }).promise;

                const imgBlob = await new Promise((resolve) =>
                    canvas.toBlob(resolve, "image/png")
                );

                const result = await worker.recognize(imgBlob);
                text += result.data.text + "\n";
            }

            await worker.terminate();

            return text.trim();
        } catch (err) {
            console.error("OCR failed:", err);
            return "";
        }
    };


    const extractTextFromPDF = async (file) => {
        try {
            const text = await pdfToText(file);
            const cleanText = text.trim().replace(/\s+/g, " ");

            // If we got good text, return it
            if (cleanText.length >= 100) {
                return cleanText;
            }

            // If standard extraction gave minimal results, try OCR
            if (onProgress)
                onProgress("Standard extraction insufficient, trying OCR...");
            return await extractTextWithOCR(file, onProgress);
        } catch (error) {
            console.warn("Standard PDF extraction failed, falling back to OCR:", error);
            if (onProgress) onProgress("Standard extraction failed, trying OCR...");
            return await extractTextWithOCR(file, onProgress);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Upload Your Resume</h3>
                    <button
                        onClick={onClose}
                        className="hover:bg-gray-100 p-2 rounded-full"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${dragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 bg-gray-50"
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <Upload className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="text-gray-700 font-medium mb-2">
                            {file ? file.name : "Drop your resume here"}
                        </p>
                        <p className="text-sm text-gray-500 mb-4">or</p>
                        <label className="cursor-pointer">
                            <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block">
                                Browse Files
                            </span>
                            <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx"
                                onChange={handleChange}
                            />
                        </label>
                        <p className="text-xs text-gray-400 mt-4">
                            Supported formats: PDF, DOC, DOCX
                        </p>
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    {/* <button
                        disabled={!file || isUploading}
                        className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${file && !isUploading
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "bg-gray-300 cursor-not-allowed"
                            }`}
                    >
                        {isUploading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Uploading...
                            </div>
                        ) : (
                            "Upload Resume"
                        )}
                    </button> */}
                    <button
                        onClick={() => {
                            setResumeUploaded(true);
                            toast.success("You can upload resume later");
                            onClose(); // 👉 CLOSE POPUP
                        }}
                        className="w-full py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                    >
                        I'll do this later
                    </button>
                </div>

                <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-900">
                        <span className="font-semibold">🎁 Bonus:</span> Upload now get a
                        free ATS-friendly template & instant analysis.
                    </p>
                </div>
            </div>
        </div>
    );
};

const JourneyStep = ({ title, status, isCompleted, isLast }) => (
    <div className="flex-1 flex items-center min-w-[100px]">
        <div className="flex flex-col items-center flex-1">
            <div className="relative">
                <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isCompleted
                        ? "bg-[#10b981] text-white shadow-lg scale-110"
                        : "bg-gray-200 text-gray-400"
                        }`}
                >
                    {isCompleted ? (
                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
                    )}
                </div>
                {isCompleted && (
                    <div className="absolute inset-0 rounded-full bg-[#10b981] animate-ping opacity-20"></div>
                )}
            </div>
            <p className="text-[11px] md:text-xs font-semibold mt-1.5 text-center text-gray-800">
                {title}
            </p>
            <p
                className={`text-[9px] md:text-[10px] mt-0.5 text-center ${isCompleted ? "text-[#10b981] font-medium" : "text-gray-500"
                    }`}
            >
                {status}
            </p>
        </div>
        {!isLast && (
            <div className="flex-1 mx-1.5 md:mx-2 max-w-[50px] md:max-w-[70px]">
                <div
                    className={`h-0.5 rounded-full transition-all duration-500 ${isCompleted ? "bg-[#10b981]" : "bg-gray-200"
                        }`}
                />
            </div>
        )}
    </div>
);

const ResultsPageNew = () => {
    const userData = useContext(UserContext);
    const navigate = useNavigate();

    const [showQRWhatsApp, setShowQRWhatsApp] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [platform, setPlatform] = useState("");

    const [whatsAppLink, setWhatsAppLink] = useState("");
    const [internships, setInternships] = useState([]);
    // 📌 Add inside state list (below whatsapp/domain states)
    const [showRetestModal, setShowRetestModal] = useState(false);
    const [retestLoading, setRetestLoading] = useState(false);

    const [selectedDomain, setSelectedDomain] = useState("");
    const [selectedDomainName, setSelectedDomainName] = useState("");
    const [whatsappJoined, setWhatsappJoined] = useState(false);
    const [resumeUploaded, setResumeUploaded] = useState(false);
    const [domainSaved, setDomainSaved] = useState(false);
    const [showAllDomains, setShowAllDomains] = useState(false);
    const [highlightSection, setHighlightSection] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [userId, setUserId] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [scrollOpacity, setScrollOpacity] = useState(1);

    const resumeSectionRef = useRef(null);
    const domainSectionRef = useRef(null);
    const whatsappSectionRef = useRef(null);

    // 👇 NEW STATE — Onboarding Step (Resume + Domain + WhatsApp Combined)
    const onboardingCompleted = resumeUploaded && domainSaved && whatsappJoined;


    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            const maxScroll = 200;
            const opacity = Math.max(0.85, 1 - scrollPosition / maxScroll);
            setScrollOpacity(opacity);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);


    useEffect(() => {
        const fetchDomains = async () => {
            try {
                const res = await fetch("https://dashboard.internshipstudio.com/api/get_data_for_result_page.php?action=get_domains");
                const data = await res.json();

                if (data.status === "success") {
                    setInternships(data.data); // NOW internships = ALL domains with id
                }
            } catch (e) {
                console.error("Domain Fetch Failed", e);
            }
        }
        fetchDomains();
    }, []);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const sessionUserId = sessionStorage.getItem("user_id");
                const sessionUserEmail = sessionStorage.getItem("userEmail");
                const storedPlatform = localStorage.getItem("platform");
                if (storedPlatform) setPlatform(storedPlatform);


                if (sessionUserId) setUserId(sessionUserId);
                if (sessionUserEmail) setUserEmail(sessionUserEmail);

                const waLinkResponse = await fetch(
                    "https://api.internshipstudio.com/api/fetchMisc.php?action=end_exam_wa_link"
                );
                const waLinkData = await waLinkResponse.json();
                setWhatsAppLink(waLinkData.value);

                // const internshipResponse = await fetch(
                //     "https://api.internshipstudio.com/api/getInternship.php"
                // );
                // const internshipData = await internshipResponse.json();

                // if (internshipData.success && internshipData.data) {
                //     setInternships(internshipData.data);
                // }

                setIsLoading(false);


                // Restore resume upload status
                const cachedResume = getWithExpiry("resumeUploaded");
                if (cachedResume) setResumeUploaded(true);

                // Restore domain selection
                // Restore saved domain (Valid for 1 hour)
                const cachedID = getWithExpiry("savedDomainID");
                const cachedName = getWithExpiry("savedDomainName");

                if (cachedID && cachedName) {
                    setSelectedDomain(cachedID);
                    setSelectedDomainName(cachedName);
                    setDomainSaved(true);
                }


                // Restore WhatsApp join
                const cachedWA = getWithExpiry("waJoined");
                if (cachedWA) setWhatsappJoined(true);



                // setTimeout(() => {
                //     setShowResumeModal(true);
                // }, 1000);
            } catch (error) {
                console.error("Error fetching data", error);
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);


    // 📌 Insert below last useEffect() inside ResultsPageNew


    // NEW — Full checkExamResult function
    const checkExamResult = async () => {
        try {
            const res = await fetch("https://examapi.internshipstudio.com/api/fetch_result", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId, exam_id: 1 })
            });

            const result = await res.json();

            // If score <= 9 → show retest popup
            if (result.status === 200 && result.data?.score <= 9) {
                setShowRetestModal(true);
            }

            // TEMP: post-exam email disabled — uncomment to re-enable
            // // If score > 9 → send email
            // if (result.status === 200 && result.data?.score > 9) {
            //     const sessionUserId = localStorage.getItem('user_id') || sessionStorage.getItem("user_id");
            //     await axios.post(
            //         "https://dashboard.internshipstudio.com/api/send_email_after_exam_completed.php",
            //         { user_id: sessionUserId }
            //     );
            // }
        } catch (error) {
            console.error("checkExamResult failed", error);
        }
    };


    useEffect(() => {
        const checkExamScore = async () => {
            try {
                const res = await fetch("https://examapi.internshipstudio.com/api/fetch_result", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ user_id: userId, exam_id: 1 })
                });
                const data = await res.json();

                if (data.status === 200 && data.data.score <= 9) {
                    setShowRetestModal(true);  // 🔥 Popup opens automatically
                }
            } catch (err) {
                console.error("Score fetch failed", err);
            }
        };

        if (userId) checkExamScore();
    }, [userId]);

    useEffect(() => {
        if (userId) {
            checkExamResult();
        }
    }, [userId]);


    const handleStartSimulation = () => {
        if (selectedDomain && resumeUploaded && whatsappJoined) {
            setSimulationStarted(true);
            alert("Starting simulation for " + selectedDomain);
        }
    };



    const handleResumeUploadSuccess = () => {
        setResumeUploaded(true);
        toast.success("Resume uploaded successfully!");

        setTimeout(() => { }, 200); // small delay makes animation smooth

        storeWithExpiry("resumeUploaded", true); // <-- save status
    };

    // Store with 1 hour expiry
    const storeWithExpiry = (key, value) => {
        const data = {
            value,
            expiry: Date.now() + 60 * 60 * 1000 // 1 hour
        };
        localStorage.setItem(key, JSON.stringify(data));
    };

    // Read and auto-expire
    const getWithExpiry = (key) => {
        const item = localStorage.getItem(key);
        if (!item) return null;

        const data = JSON.parse(item);
        if (Date.now() > data.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return data.value;
    };


    // const handleDomainSelect = (domainId) => {
    //     const selectedDomainObj = internships.find(
    //         (d) => d.id.toString() === domainId
    //     );
    //     const domainName = selectedDomainObj ? selectedDomainObj.name : "";


    //     setSelectedDomain(domainId);
    //     setSelectedDomainName(domainName);
    //     setDomainSaved(false);
    // };

    // const handleDomainSelect = async (domainId) => {
    //     const userId = localStorage.getItem('user_id') || sessionStorage.getItem("user_id");  // ← FORCE FIX
    //     const email = userEmail || sessionStorage.getItem("userEmail");

    //     if (!userId) {
    //         toast.error("User ID missing — try refreshing page");
    //         return;
    //     }

    //     const selectedDomainObj = internships.find(d => d.id.toString() === domainId);
    //     const domainName = selectedDomainObj ? selectedDomainObj.name : "";

    //     setSelectedDomain(domainId);
    //     setSelectedDomainName(domainName);
    //     setIsSaving(true);

    //     // exactly like handleSaveDomain — matches backend format
    //     const params = new URLSearchParams({
    //         user_id: userId,
    //         email: email,
    //         domain_name: domainName,
    //         domain_id: domainId,
    //         custom_domain: ""
    //     });

    //     try {
    //         const res = await fetch("https://api.internshipstudio.com/api/saveUserDomain.php", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/x-www-form-urlencoded" },
    //             body: params.toString(),
    //         });

    //         const result = await res.json();

    //         if (result.success) {
    //             setDomainSaved(true);
    //             toast.success("Domain saved automatically! 🚀");
    //             storeWithExpiry("savedDomainID", domainId);
    //             storeWithExpiry("savedDomainName", domainName);
    //         } else {
    //             toast.error(result.message || "Save failed");
    //         }
    //     } catch (e) {
    //         console.log(e);
    //         toast.error("Network error");
    //     }

    //     setIsSaving(false);
    // };


    const handleDomainSelect = (domainId) => {
        const userId = localStorage.getItem('user_id') || sessionStorage.getItem("user_id");
        const email = userEmail || sessionStorage.getItem("userEmail");

        if (!userId) {
            toast.error("User ID missing — try refreshing page");
            return;
        }

        const selectedDomainObj = internships.find(d => d.id.toString() === domainId);
        const domainName = selectedDomainObj ? selectedDomainObj.name : "";

        setSelectedDomain(domainId);
        setSelectedDomainName(domainName);
        setIsSaving(true);

        // ✅ Save to localStorage only — no API call
        storeWithExpiry("savedDomainID", domainId);
        storeWithExpiry("savedDomainName", domainName);

        setDomainSaved(true);
        toast.success("Domain saved! 🚀");

        setIsSaving(false);
    };




    const handleSaveDomain = async () => {
        if (!selectedDomain || !userId) {
            toast.error("Please select a domain first");
            return;
        }

        setIsSaving(true);

        const params = new URLSearchParams();
        params.append("user_id", userId.toString());
        params.append("email", userEmail);
        params.append("instant_result", "on");

        params.append("domain_name", selectedDomainName);  // backend requires name
        params.append("domain_id", selectedDomain);        // <-- ADDED
        params.append("custom_domain", "");

        try {
            const res = await fetch(
                "https://api.internshipstudio.com/api/saveUserDomain.php",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: params.toString(),
                }
            );

            const result = await res.json();

            if (result.success) {
                setDomainSaved(true);
                toast.success("Domain saved successfully!");

                // 🔥 Store both ID & NAME with expiry
                storeWithExpiry("savedDomainID", selectedDomain);
                storeWithExpiry("savedDomainName", selectedDomainName);
            } else {
                toast.error(result.message || "Failed to save domain");
            }
        } catch (err) {
            console.error("Error saving domain selection", err);
            toast.error("Network error. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleWhatsAppJoin = async () => {
        try {
            await axios.post(
                "https://dashboard.internshipstudio.com/api/assign_link.php",
                { assigned_link: "https://chat.whatsapp.com/GUdph3HMoJz6DXE0UH7MSP?mode=hqrc", user_id: userId }
            );

            setWhatsappJoined(true);
            storeWithExpiry("waJoined", true); // save for 1 hour
            toast.success("Joined Placement Club successfully!");


            setTimeout(() => {
                window.open("https://chat.whatsapp.com/GUdph3HMoJz6DXE0UH7MSP?mode=hqrc", "_blank");
            }, 500);
        } catch (error) {
            console.error("Error assigning link:", error);
            toast.error("Failed to join. Please try again.");
        }
    };

    const handleApplyInternships = () => {
        console.log('domainSaved: ', domainSaved)
        if (domainSaved) {
            sessionStorage.setItem("selectedDomainForInternship", selectedDomain);
            navigate("/applying-internship-jobs");
        } else {
            toast.error("Please save your domain first");
        }
    };

    // 📌 INSERT below handleApplyInternships()

    const handleRetest = async () => {
        setRetestLoading(true);
        try {
            await fetch("https://examapi.internshipstudio.com/api/request_retest", {
                method: "POST",
                headers: { "Content-Type": "application/json", userid: userId, hash: sessionStorage.getItem("hash") },
                body: JSON.stringify({ exam_id: 1 })
            });
            navigate("/");  // Redirect to exam page
        } finally { setRetestLoading(false); }
    };



    // NEW — Handle continue without retest
    const handleContinueWithoutRetest = async () => {
        setShowRetestModal(false);

        // TEMP: post-exam email disabled — uncomment to re-enable
        // // send email after exam like old checkExamResult()
        // try {
        //     const sessionUserId = localStorage.getItem('user_id') || sessionStorage.getItem("user_id");
        //     await axios.post(
        //         "https://dashboard.internshipstudio.com/api/send_email_after_exam_completed.php",
        //         { user_id: sessionUserId }
        //     );
        // } catch (err) {
        //     console.error("Failed sending exam completed email", err);
        // }
    };


    const handleContinue = () => setShowRetestModal(false);


    const handleStatusClick = (section) => {
        const refMap = {
            "resume-section": resumeSectionRef,
            "domain-section": domainSectionRef,
            "whatsapp-section": whatsappSectionRef,
        };

        const targetRef = refMap[section];
        if (targetRef?.current) {
            targetRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightSection(section);
            setTimeout(() => setHighlightSection(null), 2000);
        }
    };

    const getCompletionPercentage = () => {
        let progress = 0;

        if (resumeUploaded) progress += 33;   // Blue
        if (domainSaved) progress += 33;      // Green
        if (whatsappJoined) progress += 34;   // Purple

        return progress;
    };




    const completionPercentage = getCompletionPercentage();
    const visibleDomains = showAllDomains ? internships : internships.slice(0, 3);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg font-semibold text-gray-700">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>

            <Toaster position="top-center" />

            {/* Journey Section */}
            <div
                className="sticky top-0 z-40 backdrop-blur-sm transition-all duration-300 border-b border-gray-200"
                style={{
                    backgroundColor: `rgba(255, 255, 255, ${scrollOpacity})`,
                    boxShadow: `0 2px 4px rgba(0, 0, 0, ${(1 - scrollOpacity) * 0.1})`,
                }}
            >
                <div className="max-w-6xl mx-auto px-3 md:px-6 py-2 md:py-2">
                    {/* <div className="text-center mb-3 md:mb-4">
            <h2 className="text-base md:text-xl font-bold text-gray-800">
              Your Journey to Success
            </h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Complete all steps to unlock internship opportunities
            </p>
          </div> */}

                    {/* Desktop Journey */}
                    <div className="hidden md:block overflow-x-auto">
                        <div className="flex min-w-[750px] px-4 mx-auto">
                            <JourneyStep
                                title="Registration"
                                status="Completed"
                                isCompleted={true}
                            />
                            <JourneyStep title="Exam" status="Completed" isCompleted={true} />
                            {/* <JourneyStep
                                title="Upload Resume"
                                status={resumeUploaded ? "Completed" : "Pending"}
                                isCompleted={resumeUploaded}
                            />
                            <JourneyStep
                                title="Select Domain"
                                status={domainSaved ? "Completed" : "Pending"}
                                isCompleted={domainSaved}
                            />
                            <JourneyStep
                                title="Join Groups"
                                status={whatsappJoined ? "Completed" : "Pending"}
                                isCompleted={whatsappJoined}
                            /> */}
                            <JourneyStep
                                title="Domain Selection"
                                status={onboardingCompleted ? "Completed" : "Pending"}
                                isCompleted={onboardingCompleted}
                            />

                            <JourneyStep
                                title="Apply Internships"
                                status="Ready"
                                isCompleted={false}
                                isLast={true}
                            />
                        </div>
                    </div>

                    {/* Mobile Journey */}
                    <div className="md:hidden overflow-x-auto pb-1 -mx-3">
                        <div className="flex px-3" style={{ minWidth: "max-content" }}>
                            <JourneyStep
                                title="Registration"
                                status="Done"
                                isCompleted={true}
                            />
                            <JourneyStep title="Exam" status="Done" isCompleted={true} />
                            {/* <JourneyStep
                                title="Resume"
                                status={resumeUploaded ? "Done" : "Pending"}
                                isCompleted={resumeUploaded}
                            />
                            <JourneyStep
                                title="Groups"
                                status={whatsappJoined ? "Done" : "Pending"}
                                isCompleted={whatsappJoined}
                            />
                            <JourneyStep
                                title="Domain"
                                status={domainSaved ? "Done" : "Pending"}
                                isCompleted={domainSaved}
                            /> */}
                            <JourneyStep
                                title="Domain Selection"
                                status={onboardingCompleted ? "Completed" : "Pending"}
                                isCompleted={onboardingCompleted}
                            />

                            <JourneyStep
                                title="Apply"
                                status="Ready"
                                isCompleted={false}
                                isLast={true}
                            />
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {/* <div className="mt-3 max-w-xl mx-auto">
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#10b981] transition-all duration-700 ease-out"
                                style={{ width: `${completionPercentage}%` }}
                            />
                        </div>
                        <p className="text-center text-xs text-gray-600 mt-1.5 font-medium">
                            {completionPercentage}% Complete
                        </p>
                    </div> */}
                </div>
            </div>

            {/* Main Content */}
            <p className="text-sm md:text-lg font-bold bg-yellow-100 text-yellow-500 w-[90%] md:w-[30%] text-center py-1 mt-4 mx-auto">
                You are just 1 step away.
            </p>
            <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
                {/* Resume Upload Section */}
                <div
                    id="resume-section"
                    ref={resumeSectionRef}
                    className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5 transition-all duration-500 animate-fadeInUp ${highlightSection === "resume-section"
                        ? "ring-4 ring-blue-400 ring-opacity-75 shadow-xl scale-[1.02]"
                        : ""
                        }`}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <h2 className="text-lg font-bold text-gray-900">
                            Resume & Profile
                        </h2>
                    </div>

                    {!resumeUploaded ? (
                        <>
                            <button
                                onClick={() => setShowResumeModal(true)}
                                className="w-full py-4 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm hover:shadow-md mb-3"
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <Upload className="w-5 h-5" />
                                    Upload Resume
                                </div>
                            </button>
                            <button
                                onClick={() => {
                                    setResumeUploaded(true);
                                    toast.success("You can upload resume later");
                                }}
                                className="w-full py-3 rounded-xl font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all"
                            >
                                I'll do this later / No Resume
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center justify-center gap-3 py-4 bg-[#10b981] text-white rounded-xl">
                            <Upload className="w-5 h-5" />
                            <span className="font-semibold">Resume Uploaded ✓</span>
                        </div>
                    )}

                    <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-900">
                            <span className="font-semibold">🎁 Bonus:</span> Upload now get a
                            free ATS-friendly template & instant analysis.
                        </p>
                    </div>
                </div>

                {/* Select Your Domain Section */}
                <div
                    id="domain-section"
                    ref={domainSectionRef}
                    className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5 transition-all duration-500 animate-fadeInUp ${highlightSection === "domain-section"
                        ? "ring-4 ring-blue-400 ring-opacity-75 shadow-xl scale-[1.02]"
                        : ""
                        }`}
                    style={{ animationDelay: "0.1s" }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-gray-600" />
                        <h2 className="text-lg font-bold text-gray-900">
                            Select Your Track
                        </h2>
                    </div>
                    <div className="space-y-2.5">
                        {visibleDomains.map((domain) => (
                            <button
                                key={domain.id}
                                onClick={() => handleDomainSelect(domain.id.toString())}
                                disabled={isSaving}
                                // className={`w-full px-4 py-3.5 rounded-xl font-medium text-left transition-all border-2 ${selectedDomain === domain.id.toString()
                                //     ? "bg-[#d1fae5] border-[#10b981] text-gray-900"
                                //     : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                //     } ${isSaving ? "opacity-50 cursor-not-allowed" : ""}`}
                                className={`w-full px-4 py-3.5 rounded-xl font-medium text-left transition-all border-2 
    ${selectedDomain === domain.id.toString()
                                        ? "bg-[#d1fae5] border-[#10b981]"
                                        : "bg-white border-gray-200"}
    ${isSaving ? "opacity-50 pointer-events-none" : ""}
`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{domain.name}</span>
                                    {selectedDomain === domain.id.toString() && (
                                        <CheckCircle className="w-5 h-5 text-[#10b981]" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                    {internships.length > 3 && (
                        <button
                            onClick={() => setShowAllDomains(!showAllDomains)}
                            className="w-full mt-4 py-3 rounded-xl font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all border border-gray-200"
                        >
                            <div className="flex items-center justify-center gap-2">
                                {showAllDomains ? (
                                    <>
                                        Show Less
                                        <ChevronUp className="w-4 h-4" />
                                    </>
                                ) : (
                                    <>
                                        View All {internships.length} Domains
                                        <ChevronDown className="w-4 h-4" />
                                    </>
                                )}
                            </div>
                        </button>
                    )}

                    {/* {selectedDomain && !domainSaved && (
                        <button
                            onClick={handleSaveDomain}
                            disabled={isSaving}
                            className={`w-full mt-4 py-3 rounded-xl font-semibold text-white transition-all ${isSaving
                                ? "bg-gray-400 cursor-not-allowed"
                                : "bg-[#10b981] hover:bg-[#059669]"
                                }`}
                        >
                            {isSaving ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </div>
                            ) : (
                                "Save Domain"
                            )}
                        </button>
                    )} */}

                    {domainSaved && (
                        <div className="mt-4 p-3 bg-[#d1fae5] rounded-lg border border-[#10b981]">
                            <p className="text-sm text-gray-900">
                                <span className="font-semibold">✓ Selected:</span>{" "}
                                {selectedDomainName}
                            </p>
                        </div>
                    )}
                </div>

                {/* WhatsApp Section */}
                <div
                    id="whatsapp-section"
                    ref={whatsappSectionRef}
                    className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-5 transition-all duration-500 animate-fadeInUp ${highlightSection === "whatsapp-section"
                        ? "ring-4 ring-blue-400 ring-opacity-75 shadow-xl scale-[1.02]"
                        : ""
                        }`}
                    style={{ animationDelay: "0.2s" }}
                >
                    <div className="flex items-center gap-2 mb-4">
                        <MessageCircle className="w-5 h-5 text-gray-600" />
                        <h2 className="text-lg font-bold text-gray-900">Stay Connected</h2>
                    </div>
                    {/* {!whatsappJoined ? (
                        <>
                            <p className="text-sm text-gray-600 mb-4">
                                Get instant updates on job openings, internship opportunities,
                                and placement preparation tips directly on WhatsApp.
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleWhatsAppJoin}
                                    className="flex-1 py-4 rounded-xl font-semibold text-white bg-[#10b981] hover:bg-[#059669] transition-all shadow-sm hover:shadow-md"
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <MessageCircle className="w-5 h-5" />
                                        Join Placement Club
                                    </div>
                                </button>
                                <button
                                    onClick={() => setShowQRWhatsApp(true)}
                                    className="flex items-center justify-center px-4 py-4 bg-[#10b981] text-white rounded-xl hover:bg-[#059669] transition-all shadow-sm hover:shadow-md"
                                >
                                    <QrCode className="w-5 h-5" />
                                </button>
                            </div>
                        </>
                    ) : ( */}
                    {!whatsappJoined ? (
                        <>
                            <p className="text-sm text-gray-600 mb-4">
                                Get instant updates on job openings, internship opportunities,
                                and placement preparation tips directly on WhatsApp.
                            </p>

                            {/* 🔥 If platform = staging → show different button */}
                            {platform === "staging" ? (
                                <div className="flex gap-2">
                                    <a
                                        href="https://chat.whatsapp.com/GUdph3HMoJz6DXE0UH7MSP?mode=hqrc"
                                        target="_blank"
                                        className="w-full py-4 block text-center rounded-xl font-semibold text-white bg-[#10b981] hover:bg-[#059669] transition-all shadow-sm hover:shadow-md"
                                    >
                                        Join Placement Club
                                    </a>
                                    <button
                                        onClick={() => setShowQRWhatsApp(true)}
                                        className="flex items-center justify-center px-4 py-4 bg-[#10b981] text-white rounded-xl hover:bg-[#059669] transition-all shadow-sm hover:shadow-md"
                                    >
                                        <QrCode className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleWhatsAppJoin}
                                        className="flex-1 py-4 rounded-xl font-semibold text-white bg-[#10b981] hover:bg-[#059669] transition-all shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            <MessageCircle className="w-5 h-5" />
                                            Join Placement Club
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => setShowQRWhatsApp(true)}
                                        className="flex items-center justify-center px-4 py-4 bg-[#10b981] text-white rounded-xl hover:bg-[#059669] transition-all shadow-sm hover:shadow-md"
                                    >
                                        <QrCode className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (

                        <div className="flex items-center justify-center gap-3 py-4 bg-[#d1fae5] rounded-xl border-2 border-[#10b981]">
                            <CheckCircle className="w-6 h-6 text-[#10b981]" />
                            <span className="font-semibold text-gray-900">
                                Successfully Joined Placement Club!
                            </span>
                        </div>
                    )
                    }
                </div>
            </div>

            {/* Bottom Action Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-2xl z-20">



                <div className="max-w-2xl mx-auto px-4 py-4">
                    {/* Status Indicators */}
                    <div className="flex items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm mb-3">
                        <button
                            onClick={() =>
                                !resumeUploaded && handleStatusClick("resume-section")
                            }
                            className="flex items-center gap-1.5 cursor-pointer hover:scale-110 transition-transform"
                        >
                            {resumeUploaded ? (
                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#10b981]" />
                            ) : (
                                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                            )}
                            <span
                                className={
                                    resumeUploaded
                                        ? "text-[#10b981] font-semibold"
                                        : "text-red-500 font-semibold"
                                }
                            >
                                Resume
                            </span>
                        </button>
                        <button
                            onClick={() => !domainSaved && handleStatusClick("domain-section")}
                            className="flex items-center gap-1.5 cursor-pointer hover:scale-110 transition-transform"
                        >
                            {domainSaved ? (
                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#10b981]" />
                            ) : (
                                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                            )}
                            <span
                                className={
                                    domainSaved
                                        ? "text-[#10b981] font-semibold"
                                        : "text-red-500 font-semibold"
                                }
                            >
                                Domain
                            </span>
                        </button>
                        <button
                            onClick={() =>
                                !whatsappJoined && handleStatusClick("whatsapp-section")
                            }
                            className="flex items-center gap-1.5 cursor-pointer hover:scale-110 transition-transform"
                        >
                            {whatsappJoined ? (
                                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#10b981]" />
                            ) : (
                                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                            )}
                            <span
                                className={
                                    whatsappJoined
                                        ? "text-[#10b981] font-semibold"
                                        : "text-red-500 font-semibold"
                                }
                            >
                                WhatsApp
                            </span>
                        </button>
                    </div>

                    {/* Apply Button */}
                    {/* <button
                        onClick={handleApplyInternships}
                        // disabled={!domainSaved}
                        disabled={completionPercentage < 100}
                        className={`w-full py-3.5 sm:py-4 rounded-xl font-bold text-white text-base sm:text-lg transition-all relative overflow-hidden 
    ${completionPercentage === 100
                                ? "bg-[#10b981] hover:bg-[#059669] shadow-lg hover:shadow-xl hover:scale-[1.02]"
                                : "bg-gray-300 cursor-not-allowed"}`}

                    >
                        {completionPercentage === 100 && (
                            <div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
                                style={{
                                    backgroundSize: "200% 100%",
                                    animation: "shimmer 2s infinite",
                                }}
                            />
                        )}
                        <div className="flex items-center justify-center gap-2 relative z-10">
                            Apply Internships & Jobs 🚀
                        </div>

                    </button> */}
                    {/* Apply Button - Sleek & Compact with Smooth Progress */}
                    {/* <button
    onClick={handleApplyInternships}
    disabled={completionPercentage < 100}
    className={`relative w-full py-3 rounded-xl font-bold text-base transition-all overflow-hidden
    ${completionPercentage === 100 
        ? "shadow-lg hover:shadow-xl hover:scale-[1.01] cursor-pointer" 
        : "cursor-not-allowed shadow-sm"}`}
>
  
    <div className="absolute inset-0 bg-gray-300"></div>

   
    <div 
        className="absolute inset-0 bg-gradient-to-r from-[#10b981] via-[#059669] to-[#10b981] transition-all duration-700 ease-out"
        style={{
            width: `${completionPercentage}%`,
            backgroundSize: '200% 100%',
        }}
    >
        
        <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
            style={{
                animation: 'shimmer 2.5s infinite',
                backgroundSize: '200% 100%',
            }}
        />
    </div>

    
    {completionPercentage === 100 && (
        <div className="absolute inset-0 bg-[#10b981] animate-pulse opacity-20 rounded-xl"></div>
    )}

    
    <div className="relative z-10 flex items-center justify-center gap-2.5 px-4">
        {completionPercentage === 100 ? (
            // Success State
            <div className="flex items-center gap-2">
                <span className="text-white font-extrabold drop-shadow-md tracking-wide">
                    Apply Internships & Jobs
                </span>
                <span className="text-xl">🚀</span>
            </div>
        ) : (
            // Progress State
            <>
             
                <div className="bg-white bg-opacity-25 backdrop-blur-sm px-3 py-0.5 rounded-full">
                    <span className="text-white font-extrabold text-lg drop-shadow-md">
                        {completionPercentage}%
                    </span>
                </div>
                
               
                <div className="w-px h-5 bg-white opacity-40"></div>
                
               
                <span className="text-white font-bold drop-shadow-md opacity-80">
                    Apply Internships & Jobs 🚀
                </span>
            </>
        )}
    </div>
</button> */}


                    {/* Apply Button - Multi-Color Progress (Blue → Green → Purple) */}
                    <button
                        onClick={handleApplyInternships}
                        disabled={completionPercentage < 100}
                        className={`relative w-full py-3 rounded-xl font-bold text-base transition-all overflow-hidden
    ${completionPercentage === 100
                                ? "shadow-lg hover:shadow-xl hover:scale-[1.01] cursor-pointer"
                                : "cursor-not-allowed shadow-sm"}`}
                    >
                        {/* Background Layer */}
                        <div className="absolute inset-0 bg-gray-300"></div>

                        {/* Multi-Stage Progress Fill */}
                        <div className="absolute inset-0 transition-all duration-700 ease-out"
                            style={{ width: `${completionPercentage}%` }}>

                            {/* Stage 1: Blue (0-33%) - Resume */}
                            {completionPercentage >= 1 && (
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500"
                                    style={{
                                        backgroundSize: '200% 100%',
                                        width: completionPercentage >= 33 ? '100%' : `${(completionPercentage / 33) * 100}%`
                                    }}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
                                        style={{ animation: 'shimmer 2.5s infinite', backgroundSize: '200% 100%' }} />
                                </div>
                            )}

                            {/* Stage 2: Green (33-66%) - Domain */}
                            {completionPercentage >= 33 && (
                                <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-green-600 to-green-500"
                                    style={{
                                        backgroundSize: '200% 100%',
                                        width: completionPercentage >= 66 ? '100%' : `${((completionPercentage - 33) / 33) * 100}%`
                                    }}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
                                        style={{ animation: 'shimmer 2.5s infinite', backgroundSize: '200% 100%' }} />
                                </div>
                            )}

                            {/* Stage 3: Purple (66-100%) - WhatsApp */}
                            {completionPercentage >= 66 && (
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-500"
                                    style={{
                                        backgroundSize: '200% 100%',
                                        width: `${((completionPercentage - 66) / 34) * 100}%`
                                    }}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-20"
                                        style={{ animation: 'shimmer 2.5s infinite', backgroundSize: '200% 100%' }} />
                                </div>
                            )}
                        </div>

                        {/* Success Pulse at 100% */}
                        {completionPercentage === 100 && (
                            <div className="absolute inset-0 bg-purple-500 animate-pulse opacity-20 rounded-xl"></div>
                        )}

                        {/* Content Layer */}
                        <div className="relative z-10 flex items-center justify-center gap-2.5 px-4">
                            {completionPercentage === 100 ? (
                                // Success State
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-extrabold drop-shadow-md tracking-wide">
                                        Apply Internships & Jobs
                                    </span>
                                    <span className="text-xl">🚀</span>
                                </div>
                            ) : (
                                // Progress State
                                <>
                                    {/* Percentage Badge */}
                                    <div className="bg-white bg-opacity-25 backdrop-blur-sm px-3 py-0.5 rounded-full">
                                        <span className="text-white font-extrabold text-lg drop-shadow-md">
                                            {completionPercentage}%
                                        </span>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-px h-5 bg-white opacity-40"></div>

                                    {/* Button Label (Slightly Faded) */}
                                    <span className="text-white font-bold drop-shadow-md opacity-80">
                                        Apply Internships & Jobs 🚀
                                    </span>
                                </>
                            )}
                        </div>
                    </button>



                </div>
            </div>

            {/* Modals */}
            {showQRWhatsApp && (
                <QRCodeModal
                    qrLink={platform === "staging" ? 'https://chat.whatsapp.com/GUdph3HMoJz6DXE0UH7MSP?mode=hqrc' : whatsAppLink}
                    onClose={() => setShowQRWhatsApp(false)}
                />
            )}

            {showResumeModal && (
                <ResumeUploadModal
                    onClose={() => setShowResumeModal(false)}
                    onUploadSuccess={handleResumeUploadSuccess}
                    setResumeUploaded={setResumeUploaded}   // ← ADD THIS
                />
            )}

            {/* 📌 Add just BEFORE closing </div> of ResultsPageNew */}

            {showRetestModal && (
                // <RetestModal
                //     onClose={handleContinue}
                //     onConfirmRetest={handleRetest}
                // />
                <RetestModal
                    onClose={handleContinueWithoutRetest}
                    onConfirmRetest={handleRetest}
                />

            )}

        </div>
    );
};

export default ResultsPageNew;