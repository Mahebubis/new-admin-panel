import { useEffect, useState, useRef } from "react";
import { LayoutGrid, Download, Play, CheckCircle2, Cpu, Briefcase, ChevronLeft, ChevronRight, Coins, ChevronDown, ArrowRight, ShoppingBag, BarChart2, Smartphone } from 'lucide-react';
import PricingSection from "./PricingSection";
import SkillSpiderChartModal from "./SkillSpiderChartModal";
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from "react-router-dom";

export default function InternshipDashboard() {
    const [selectedBatch, setSelectedBatch] = useState('');
    const [showVideo, setShowVideo] = useState(false);

    const [domains, setDomains] = useState([]);
    const [subdomains, setSubdomains] = useState([]);
    const [selectedDomainId, setSelectedDomainId] = useState('');
    const [selectedSubdomainId, setSelectedSubdomainId] = useState('');
    const [projects, setProjects] = useState([]);
    const [currentProjectIndex, setCurrentProjectIndex] = useState(0);
    const [currentJobIndex, setCurrentJobIndex] = useState(0);
    const [jobs, setJobs] = useState([]);
    const [examDate, setExamDate] = useState(null);
    const [showCertificateDownload, setShowCertificateDownload] = useState(false);

    const [skills, setSkills] = useState([]);
    const [showContent, setShowContent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState("");
    const [avatar, setAvatar] = useState("");
    const [showPlanModal, setShowPlanModal] = useState(false);
    // const [inputErrors, setInputErrors] = useState({ subdomain: false, batch: false });
    const [inputErrors, setInputErrors] = useState({ subdomain: true, batch: true });


    const [score, setScore] = useState(0);
    const [phone, setPhone] = useState("");

    const [batches, setBatches] = useState([]);
    const [showSpiderChart, setShowSpiderChart] = useState(false);
    const [highlightSkillIndex, setHighlightSkillIndex] = useState(0);



    const [rank, setRank] = useState(0);
    const [qualifiedStatus, setQualifiedStatus] = useState(false);
    const finalPrice = qualifiedStatus ? 590 : 2000;

    const navigate = useNavigate();

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

    // 👉 ADD THIS RIGHT BELOW FEATURES ARRAY
    const comparisonFeatures = features.map(f => ({
        feature: f.name,
        free: f.nonQualified ? true : false,
        premium: f.qualifiedEnrolled ? true : false
    }));



    const subdomainImages = {
        "artificial intelligence internship": "/ai.jpg",
        "machine learning internship": "/ml.jpg",
        "data science internship": "/ds.jpg",
        "data analytics internship": "/da.jpg",

        "website design and development internship": "/webdev.jpg",
        "ui/ux design internship": "/ui.jpg",
        "cpp and data structures internship": "/cpp.jpg",
        "java internship": "/java.jpg",

        "aws internship": "/aws.jpg",
        "devops internship": "/devops.jpg",

        "ethical hacking internship": "/eh.jpg",

        "excel automation internship": "/excel.jpg",
        "software testing internship": "/st.jpg",

        "finance internship": "/finance.jpg",
        "international business internship": "/ib.jpg",
        "energy conversion and management internship": "/ecm.jpg",

        "human resource internship": "/hr.jpg",

        "autocad internship": "/ac.jpg",
        "rcc structure design internship": "/rcc.jpg",

        "graphic design internship": "/gd.jpg",
        "video editing internship": "/ve.jpg",

        "pharmaceutical internship": "/pharma.jpg",
        "psychology internship": "/psychology.jpg",
        "marketing internship": "/marketing.jpg",
        "vr internship": "/vr.jpg"
    };





    const projectScrollRef = useRef(null);
    const jobScrollRef = useRef(null);

    const API_BASE = "https://dashboard.internshipstudio.com/api/get_data_for_result_page.php";

    function getIcon(iconName) {
        const icons = {
            Briefcase,
            ShoppingBag,
            BarChart2,
            Smartphone
        };
        return icons[iconName] || Briefcase;
    }

    const formatAmount = (value) => {
        if (!value) return value;
        return Number(value).toString().replace(/\.00$/, "");
    };


    useEffect(() => {
        const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id');
        fetch("https://dashboard.internshipstudio.com/api/get_batches.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: userId })
        })
            .then(res => res.json())
            .then(data => {
                let filtered = (data?.batches || [])
                    .filter(b => b.show_date == "1")
                    .filter(b => b.status?.toLowerCase() !== "full")
                    .sort((a, b) => convertDate(a.date) - convertDate(b.date));

                setBatches(filtered);
                console.log("📅 FINAL BATCH LIST:", filtered);
            })
            .catch(err => console.log("Batch Fetch Error:", err));
    }, []);






    const readStoredValue = (key) => {
        const item = localStorage.getItem(key);
        if (!item) return null;

        try {
            const parsed = JSON.parse(item);
            return parsed.value ?? null;
        } catch {
            return item;
        }
    };


    useEffect(() => {
        fetchDomains();
    }, []);



    const fetchDomains = async () => {
        try {
            const response = await fetch(`${API_BASE}?action=get_domains`);
            const data = await response.json();

            if (data.status === "success") {
                setDomains(data.data);

                const savedDomainId = readStoredValue("savedDomainID");
                if (savedDomainId) setSelectedDomainId(String(savedDomainId).replace(/"/g, '').trim());

            }
        } catch (err) {
            console.error("Error fetching domains:", err);
        }
    };



    useEffect(() => {
        if (selectedDomainId) {
            fetchSubdomains(selectedDomainId).then(() => {
                const savedSub = readStoredValue("savedSubdomainID");
                if (savedSub) setSelectedSubdomainId(String(savedSub).replace(/"/g, '').trim());

            });
        }
    }, [selectedDomainId]);



    const fetchSubdomains = async (domainId) => {
        try {
            const response = await fetch(`${API_BASE}?action=get_subdomains&domain_id=${domainId}`);
            const data = await response.json();
            if (data.status === "success") {
                setSubdomains(data.data);
            }
            return true;
        } catch (err) {
            console.error("Error fetching subdomains:", err);
            return false;
        }
    };

    const downloadCertificate = () => {
        if (!examDate) return alert("Exam date missing");

        const exam = new Date(examDate);
        const releaseTime = new Date(exam);

        releaseTime.setDate(releaseTime.getDate() + 1);
        releaseTime.setHours(17, 0, 0, 0);

        const now = new Date();

        if (now < releaseTime) {
            setShowCertificateDownload(true);
            return;
        }

        const userId = sessionStorage.getItem("user_id") || localStorage.getItem("user_id");
        window.open(`https://cit2.internshipstudio.com/certificates/participation_certificate_new.php?user_id=${userId}`, "_blank");
    };




    useEffect(() => {
        if (selectedSubdomainId) {
            setShowContent(false);
            fetchSubdomainData(selectedSubdomainId);
        } else {
            setProjects([]);
            setJobs([]);
            setSkills([]);
            setShowContent(false);
        }
    }, [selectedSubdomainId]);


    useEffect(() => {
        const fetchUserName = async () => {
            const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
            if (!userId) return;

            const res = await fetch("https://dashboard.internshipstudio.com/api/get_user_name.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId }),
            });

            const result = await res.json();
            if (result.status === "success") {
                setName(result.data.name);
                setAvatar(result.data.photo);
                setPhone(result.data.phone);

                const finalScore = Math.ceil(parseFloat(result.data.exam.score)) || 0;

                const formattedRank = Number(result.data.exam.rank).toLocaleString('en-IN');

                const qualified = finalScore >= 9;

                setScore(finalScore);
                setRank(formattedRank);
                setQualifiedStatus(qualified);
                const price = qualified ? 590 : 2000;
                localStorage.setItem("finalPrice", price);

                if (result.data?.exam?.timestamp) {
                    setExamDate(result.data.exam.timestamp);
                }


            }
        };
        fetchUserName();
    }, []);

    useEffect(() => {
        localStorage.setItem("finalPrice", finalPrice);
    }, [finalPrice]);


    const fetchSubdomainData = async (subdomainId) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}?action=get_subdomain_data&subdomain_id=${subdomainId}`);
            const data = await response.json();
            if (data.status === "success") {
                const formattedProjects = data.data.projects.map(p => ({
                    ...p,
                    icon: getIcon(p.icon)
                }));
                setProjects(formattedProjects);
                setJobs(data.data.jobs);
                setSkills(data.data.skills);


                setTimeout(() => {
                    setShowContent(true);
                }, 100);
            }
        } catch (err) {
            console.error("Error fetching subdomain data:", err);
        } finally {
            setLoading(false);
        }
    };


    function convertDate(dateStr) {
        return new Date(dateStr.replace(/(\d+)(st|nd|rd|th)/, "$1"));
    }

    const handleUnlockPremium = () => {
        const subError = !selectedSubdomainId;
        const batchError = !selectedBatch;

        setInputErrors({
            subdomain: subError,
            batch: batchError
        });

        if (subError || batchError) return;

        const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
        const subdomain_name = localStorage.getItem("savedSubdomainName") || "";

        const payload = {
            autopay: "true",
            user_id: userId,

            internship_name: subdomain_name, // correct param name
            batch_date: batches.find(b => b.id == selectedBatch)?.date || "",

            phone_number: phone,
            amount: "590.00",

            from: "result_page",

            return_url: "https://staging.internshipstudio.com/payment-status"
        };


        // 🔥 Convert payload to URL query params
        const queryString = new URLSearchParams(payload).toString();

        // 🔥 Redirect instead of calling API
        window.location.href = `https://staging.internshipstudio.com/initiate-payment?${queryString}`;
    };




    // const saveDomainSelection = async (domainName = "", subdomainName = "") => {

    //     const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
    //     const userEmail = sessionStorage.getItem("email");

    //     console.log('userId: ', userId);

    //     if (!userId) {
    //         console.error("❌ Missing user_id or email in sessionStorage.");
    //         return;
    //     }

    //     const params = new URLSearchParams();
    //     params.append("user_id", userId);
    //     params.append("email", userEmail);

    //     if (domainName) params.append("domain_name", domainName);
    //     if (subdomainName) params.append("subdomain_name", subdomainName);

    //     params.append("custom_domain", "");

    //     try {
    //         const response = await fetch("https://api.internshipstudio.com/api/saveUserDomain.php", {
    //             method: "POST",
    //             headers: { "Content-Type": "application/x-www-form-urlencoded" },
    //             body: params.toString()
    //         });

    //         const result = await response.json();
    //         console.log("🚀 API Response:", result);

    //     } catch (error) {
    //         console.error("❌ API Error:", error);
    //     }
    // };



    const saveDomainSelection = async (domainName = "", subdomainName = "") => {

        const userId = localStorage.getItem("user_id") || sessionStorage.getItem("user_id");
        const userEmail = sessionStorage.getItem("email");

        console.log('userId: ', userId);

        if (!userId) {
            console.error("❌ Missing user_id or email in sessionStorage.");
            return;
        }

        // ❌ If domainName is chosen, DO NOT call API
        if (domainName && !subdomainName) {
            console.log("ℹ️ Domain selected — Skipping API call.");
            return;
        }

        // ✅ Only process API call if subdomain is selected
        if (!subdomainName) {
            console.error("❌ No subdomain provided. API will not be called.");
            return;
        }

        const params = new URLSearchParams();
        params.append("user_id", userId);
        params.append("email", userEmail);
        params.append("instant_result", "on");


        // ✅ Send subdomain as domain to backend
        params.append("domain_name", subdomainName);
        params.append("custom_domain", "");

        try {
            const response = await fetch("https://api.internshipstudio.com/api/saveUserDomain.php", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString()
            });

            const result = await response.json();
            console.log("🚀 API Response:", result);

        } catch (error) {
            console.error("❌ API Error:", error);
        }
    };


    const handleDomainChange = async (e) => {
        const domainId = e.target.value;
        setSelectedDomainId(domainId);
        setSelectedSubdomainId("");

        if (domainId) {
            const selectedDomain = domains.find(d => d.id == domainId);
            if (selectedDomain) {
                localStorage.setItem("savedDomainID", domainId);
                localStorage.setItem("savedDomainName", selectedDomain.name);

                saveDomainSelection(selectedDomain.name, "");
            }
        }
    };




    // const handleSubdomainChange = async (e) => {
    //     const subId = e.target.value;
    //     setSelectedSubdomainId(subId);
    //     setInputErrors(prev => ({ ...prev, subdomain: false }));

    //     if (subId) {
    //         const selectedSub = subdomains.find(s => s.id == subId);
    //         if (selectedSub) {
    //             localStorage.setItem("savedSubdomainID", subId);
    //             localStorage.setItem("savedSubdomainName", selectedSub.name);

    //             saveDomainSelection("", selectedSub.name);
    //         }
    //     }
    // };

    const handleSubdomainChange = async (e) => {
        const subId = e.target.value;
        setSelectedSubdomainId(subId);

        setInputErrors(prev => ({ ...prev, subdomain: !subId }));

        if (subId) {
            const selectedSub = subdomains.find(s => s.id == subId);
            if (selectedSub) {
                localStorage.setItem("savedSubdomainID", subId);
                localStorage.setItem("savedSubdomainName", selectedSub.name);
                saveDomainSelection("", selectedSub.name);
            }
        }
    };



    // const scrollProjects = (direction) => {
    //     if (projectScrollRef.current) {
    //         const scrollAmount = 340;
    //         projectScrollRef.current.scrollBy({
    //             left: direction === 'left' ? -scrollAmount : scrollAmount,
    //             behavior: 'smooth'
    //         });
    //     }
    // };



    // const scrollJobs = (direction) => {
    //     if (jobScrollRef.current) {
    //         const scrollAmount = 280;
    //         jobScrollRef.current.scrollBy({
    //             left: direction === 'left' ? -scrollAmount : scrollAmount,
    //             behavior: 'smooth'
    //         });
    //     }
    // };

    const scrollProjects = (direction) => {
        if (projectScrollRef.current) {
            const scrollAmount = 340;
            projectScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });

            // Update current index
            if (direction === 'right' && currentProjectIndex < projects.length - 1) {
                setCurrentProjectIndex(currentProjectIndex + 1);
            } else if (direction === 'left' && currentProjectIndex > 0) {
                setCurrentProjectIndex(currentProjectIndex - 1);
            }
        }
    };

    const scrollJobs = (direction) => {
        if (jobScrollRef.current) {
            const scrollAmount = 280;
            jobScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });

            // Update current index
            if (direction === 'right' && currentJobIndex < jobs.length - 1) {
                setCurrentJobIndex(currentJobIndex + 1);
            } else if (direction === 'left' && currentJobIndex > 0) {
                setCurrentJobIndex(currentJobIndex - 1);
            }
        }
    };

    return (
        <div className="bg-gray-50 text-gray-700 antialiased min-h-screen flex flex-col relative selection:bg-indigo-200 selection:text-indigo-900">
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-indigo-100/40 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[20%] left-[-10%] w-[30rem] h-[30rem] bg-blue-100/40 rounded-full blur-[100px]"></div>
            </div>

            <nav className="w-full border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-8xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-[70px] h-[70px] sm:w-[100px] sm:h-[100px] flex items-center justify-center">
                            <img src="/logo_black.png" alt="logo" className="w-full h-full object-contain" />
                        </div>

                        <span className="text-indigo-900 text-sm font-medium tracking-tight">{name}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full border border-gray-800 flex items-center justify-center overflow-hidden">

                            {avatar ? (
                                <img
                                    src={avatar}
                                    alt="profile"
                                    className="w-full h-full object-cover rounded-full"
                                />
                            ) : (
                                <span className="text-red-500 font-bold text-sm uppercase bg-black w-full h-full flex items-center justify-center rounded-full">
                                    {name ? `${name.split(" ")[0][0]}${name.split(" ")[1] ? name.split(" ")[1][0] : ""}` : "U"}
                                </span>
                            )}

                        </div>

                    </div>
                </div>
            </nav>


            <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6">
                <section className="mt-10 mb-10 bg-[#F7F9FF] border border-indigo-100 rounded-xl p-6 shadow-sm">
                    {qualifiedStatus ? (
                        <h2
                            className="text-base sm:text-xl md:text-2xl text-center mb-3 font-semibold bg-green-100 text-green-900 py-2"
                        >
                            <span className="block sm:hidden">Congratulations! 🎉 You have successfully Qualified the Exam</span>
                            <span className="hidden sm:block">Congratulations! 🎉 You have successfully Qualified the Exam</span>
                        </h2>
                    ) : (
                        <h2
                            className="text-base sm:text-xl md:text-2xl text-center mb-3 font-semibold bg-gray-200 text-gray-900 py-2"
                        >
                            <span className="block sm:hidden">Regret! You have not Qualified the Exam</span>
                            <span className="hidden sm:block">Regret! You have not Qualified the Exam</span>
                        </h2>
                    )}

                    <h2 className="text-base sm:text-lg font-medium text-gray-900 tracking-tight">iCAT Score</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-200 bg-white border border-gray-200 rounded-xl overflow-hidden backdrop-blur-sm shadow-sm">
                        <div className="flex flex-col gap-1 p-4 sm:p-6 items-center justify-center">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Marks Obtained</span>
                            <span className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                                {score}<span className="text-gray-400 text-base sm:text-lg font-normal">/90</span>
                            </span>
                        </div>
                        <div className="flex flex-col p-4 sm:p-6 items-center justify-center">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-center">All India Rank</span>
                            <span className="text-xl sm:text-2xl font-semibold text-indigo-600 tracking-tight">#{rank}</span>
                        </div>
                        <div className="flex flex-col gap-1 p-4 sm:p-6 items-center justify-center">
                            <span className="uppercase text-xs font-medium text-gray-500 tracking-wider">Status</span>
                            <span className={`text-sm sm:text-lg font-medium rounded-full px-2 sm:px-3 py-0.5 
    ${qualifiedStatus
                                    ? "text-emerald-600 bg-emerald-50 border border-emerald-200"
                                    : "text-red-600 bg-red-50 border border-red-300"
                                }`}>
                                {qualifiedStatus ? "Qualified" : "Not Qualified"}
                            </span>

                        </div>
                        <div className="flex flex-col p-4 sm:p-6 gap-3 items-center justify-center">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Certificate</span>
                            <button onClick={downloadCertificate} className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-md transition-colors shadow-sm">
                                <span className="hidden sm:inline">Download</span>
                                <Download className="w-4 h-4" />
                            </button>

                        </div>
                    </div>
                </section>


                <section className="mb-10">
                    <div className="flex items-center justify-between mb-4 px-1 md:w-[50%]">
                        <h2 className="text-base sm:text-lg font-medium text-gray-900 tracking-tight">About Internship Program</h2>
                    </div>

                    {/* <div className="relative aspect-video w-full md:w-3/4 lg:w-2/3 xl:w-3/5 mx-auto rounded-xl border border-gray-200 bg-white overflow-hidden group cursor-pointer shadow-sm"> */}
                    <div
                        onClick={() => setShowVideo(true)}
                        className="relative aspect-video w-full md:w-3/4 lg:w-2/3 xl:w-3/5 mx-auto rounded-xl border border-gray-200 bg-white overflow-hidden group cursor-pointer shadow-sm"
                    >

                        {/* <div className="absolute inset-0 bg-gradient-to-tr from-gray-100 via-gray-50 to-indigo-50"></div> */}
                        <img
    src="/thumbnail.png"
    alt="Internship Program Overview"
    className="absolute inset-0 w-full h-full object-cover"
/>

                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                        <div className="flex absolute inset-0 items-center justify-center">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm border border-indigo-400">
                                <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-1" fill="currentColor" />
                            </div>
                        </div>

                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                            <div>
                                <p className="text-sm font-medium text-gray-900">Program Overview</p>
                                <p className="text-xs text-gray-600">Duration: 4 mins</p>
                            </div>
                        </div>
                    </div>
                </section>



                <section className="mb-10 bg-[#F7F9FF] border border-indigo-100 rounded-xl p-6 shadow-sm">
                    <section className="mb-10">
                        <h2 className="text-base sm:text-lg font-medium text-gray-900 tracking-tight">Select Your Path</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="relative group">
                                <label className="block text-xs font-medium text-gray-600 mb-2 ml-1">Domain</label>
                                <select
                                    value={selectedDomainId}
                                    onChange={handleDomainChange}
                                    className="w-full appearance-none bg-white text-gray-700 border border-gray-300 rounded-lg px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-gray-400 transition-colors cursor-pointer shadow-sm"
                                >
                                    <option value="">Select Domain</option>
                                    {domains.map(domain => (
                                        <option key={domain.id} value={domain.id}>
                                            {domain.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-[70%] -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>

                            <div className="relative group">
                                <label className="block text-xs font-medium text-gray-600 mb-2 ml-1">Subdomain</label>
                                <select
                                    value={selectedSubdomainId}
                                    onChange={handleSubdomainChange}
                                    disabled={!selectedDomainId}
                                    className={`w-full appearance-none bg-white text-gray-700 border ${inputErrors.subdomain ? 'border-red-500 border-2' : 'border-gray-300'} rounded-lg px-4 py-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 hover:border-gray-400 transition-colors cursor-pointer shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed`}
                                >
                                    <option value="">Select Subdomain</option>
                                    {subdomains.map(subdomain => (
                                        <option key={subdomain.id} value={subdomain.id}>
                                            {subdomain.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-[70%] -translate-y-1/2 pointer-events-none text-gray-500">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {loading && (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        </div>
                    )}

                    {!loading && selectedSubdomainId && showContent && (
                        <div className="animate-fade-in-up">
                            <div className="relative pl-4 md:pl-6">
                                <div className="absolute left-4 md:left-6 top-2 bottom-0 w-px bg-gray-200"></div>
                                <h2 className="text-lg sm:text-xl font-medium text-gray-900 tracking-tight mb-3">You are eligible for Internship Program as follows.</h2>

                                <div className="relative pb-16 pl-12 md:pl-16">
                                    <div className="absolute left-0 md:left-2 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-blue-600 border-4 border-gray-50 flex items-center justify-center z-10 shadow-lg">
                                        <span className="text-xs font-bold text-white">1</span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-6 tracking-tight flex items-center gap-2 flex-wrap">
                                        Training Module
                                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-600 font-medium border border-gray-200">
                                            In Progress
                                        </span>
                                    </h3>
                                    <div className="grid md:grid-cols-2 gap-6 p-1 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 transition-colors shadow-sm">

                                        <div
                                            className="relative aspect-video md:min-h-[170px] rounded-xl overflow-hidden group cursor-pointer border border-gray-200"
                                        >
                                            <img
                                                src={subdomainImages[subdomains.find(s => s.id == selectedSubdomainId)?.name?.toLowerCase()]}
                                                alt="Subdomain Banner"
                                                className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105"
                                            />

                                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/40 backdrop-blur-xl 
                        flex items-center justify-center border border-white/60 shadow-lg 
                        hover:scale-110 transition-all duration-300">
                                                    <Play className="text-indigo-600 w-6 h-6 ml-0.5" fill="currentColor" />
                                                </div>
                                            </div>

                                            <div className="absolute inset-0 bg-black/10"></div>
                                        </div>


                                        <div className="py-4 pr-6 pl-2 md:pl-0 flex flex-col justify-center">
                                            <h4 className="text-sm font-medium text-gray-900 mb-4">Core Competencies</h4>
                                            <ul className="space-y-3">
                                                <li className="flex items-start gap-3 text-xs text-gray-700">
                                                    <CheckCircle2 className="text-blue-600 mt-0.5 shrink-0 w-4 h-4" />
                                                    <span>Industry expert-led technical training sessions</span>
                                                </li>
                                                <li className="flex items-start gap-3 text-xs text-gray-700">
                                                    <Cpu className="text-blue-600 mt-0.5 shrink-0 w-4 h-4" />
                                                    <span>Hands-on with cutting-edge technologies</span>
                                                </li>
                                                <li className="flex items-start gap-3 text-xs text-gray-700">
                                                    <Briefcase className="text-blue-600 mt-0.5 shrink-0 w-4 h-4" />
                                                    <span>Real-world project infrastructure setup</span>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative pb-16 pl-12 md:pl-16">
                                    <div className="absolute left-0 md:left-2 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center z-10 text-gray-600 shadow-sm">
                                        <span className="text-xs font-bold">2</span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-6 tracking-tight">Skills Acquired</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {skills.length > 0 ? (
                                            skills.map((skillObj, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => {
                                                        setHighlightSkillIndex(index);
                                                        setShowSpiderChart(true);
                                                    }}
                                                    className="px-3 py-1.5 rounded-full border border-gray-300 bg-white text-xs 
                   text-gray-700 hover:border-indigo-500 hover:text-indigo-600 
                   transition-colors cursor-pointer shadow-sm animate-scale-in"
                                                    style={{ animationDelay: `${index * 0.1}s` }}
                                                >
                                                    {/* {skillObj.name} — {skillObj.percent}% */}
                                                    {skillObj.name}
                                                </div>
                                            ))

                                        ) : (
                                            <p className="text-sm text-gray-500">No skills data available</p>
                                        )}
                                    </div>
                                </div>

                                <div className="relative pb-16 pl-12 md:pl-16">
                                    <div className="absolute left-0 md:left-2 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center z-10 text-gray-600 shadow-sm">
                                        <span className="text-xs font-bold">3</span>
                                    </div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-base sm:text-lg font-medium text-gray-900 tracking-tight">Internship Simulation</h3>

                                    </div>
                                    {/* <div
                                        ref={projectScrollRef}
                                        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth" */}
                                    {/* <div
                                        ref={projectScrollRef}
                                        className="flex gap-4 pb-4 snap-x snap-mandatory scroll-smooth
               overflow-x-auto md:overflow-x-auto
               pl-4 md:pl-0 -ml-4 md:ml-0 pr-[25%] md:pr-0"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    > */}
                                    <div
                                        ref={projectScrollRef}
                                        className="flex gap-2 md:gap-4 pb-4 snap-x snap-mandatory scroll-smooth
               overflow-x-auto md:overflow-x-auto
               pl-1 md:pl-0 -ml-1 md:ml-0 pr-[40%] md:pr-0"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    >
                                        {projects.length > 0 ? (
                                            projects.map((project, index) => {
                                                const Icon = project.icon;
                                                return (
                                                    //                                                 <div
                                                    //                                                     key={project.id}
                                                    //                                                     className="
                                                    // snap-start 
                                                    // min-w-[85vw] sm:min-w-[320px]
                                                    // md:min-w-[320px]
                                                    //                 p-4 sm:p-5 
                                                    //                 rounded-xl border border-gray-200 bg-white
                                                    //                 hover:bg-gray-50 hover:border-gray-300 
                                                    //                 transition-all duration-300 group shadow-sm
                                                    //                 animate-slide-in
                                                    //             "
                                                    //                                                     style={{ animationDelay: `${index * 0.15}s` }}
                                                    //                                                 >
                                                    //                                                     <div className="flex items-start justify-between mb-3 sm:mb-4">
                                                    //                                                         <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${project.bgColor} flex items-center justify-center border ${project.borderColor} ${project.textColor}`}>
                                                    //                                                             <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    //                                                         </div>

                                                    //                                                         <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                    //                                                             {project.difficulty}
                                                    //                                                         </span>
                                                    //                                                     </div>

                                                    //                                                     <h4 className="text-[13px] sm:text-sm font-semibold text-gray-900 mb-1">{project.title}</h4>
                                                    //                                                     <p className="text-[10px] sm:text-xs text-gray-500 mb-2">{project.company}</p>
                                                    //                                                     <p className="text-[10px] sm:text-xs text-gray-600 leading-relaxed mb-4 sm:mb-6 line-clamp-2">{project.description}</p>

                                                    //                                                     <div className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 w-fit">
                                                    //                                                         {/* <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> */}
                                                    //                                                         <span className="text-[10px] sm:text-xs font-medium">
                                                    //                                                             Earning Potential ₹{formatAmount(project.earning)}
                                                    //                                                         </span>

                                                    //                                                     </div>
                                                    //                                                 </div>

                                                    <div
                                                        key={project.id}
                                                        className="
        snap-start 
        min-w-[60vw] sm:min-w-[320px]
        md:min-w-[320px]
        p-2.5 sm:p-5 
        rounded-lg border border-gray-200 bg-white
        hover:bg-gray-50 hover:border-gray-300 
        transition-all duration-300 group shadow-sm
        animate-slide-in
        min-h-[180px] sm:min-h-auto
    "
                                                        style={{ animationDelay: `${index * 0.15}s` }}
                                                    >
                                                        <div className="flex items-start justify-between mb-2 sm:mb-4">
                                                            <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg ${project.bgColor} flex items-center justify-center border ${project.borderColor} ${project.textColor}`}>
                                                                <Icon className="w-3 h-3 sm:w-5 sm:h-5" />
                                                            </div>

                                                            <span className="px-1.5 py-[2px] rounded text-[7px] sm:text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                                {project.difficulty}
                                                            </span>
                                                        </div>

                                                        <h4 className="text-[10px] sm:text-sm font-semibold text-gray-900 mb-1 sm:mb-1 line-clamp-2">{project.title}</h4>
                                                        <p className="text-[8px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">{project.company}</p>
                                                        <p className="text-[8px] sm:text-xs text-gray-600 leading-relaxed mb-3 sm:mb-6 line-clamp-3">{project.description}</p>

                                                        <div className="flex items-center gap-1 sm:gap-2 px-1.5 py-1 sm:px-3 sm:py-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 w-fit mt-auto">
                                                            <span className="text-[8px] sm:text-xs font-medium">
                                                                ₹{formatAmount(project.earning)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-sm text-gray-500">No projects available</p>
                                        )}

                                    </div>
                                    {projects.length > 1 && (
                                        <div className="flex items-center justify-center gap-3 mt-4">
                                            <button
                                                onClick={() => scrollProjects('left')}
                                                disabled={currentProjectIndex === 0}
                                                className="group relative w-10 h-10 rounded-full bg-white border-2 border-gray-300 
                       flex items-center justify-center hover:border-indigo-500 hover:bg-indigo-50
                       transition-all duration-300 shadow-md hover:shadow-lg
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
                                            >
                                                <ChevronLeft className="w-5 h-5 text-gray-600 group-hover:text-indigo-600 transition-colors" />
                                                <div className="absolute inset-0 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            </button>

                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
                                                <span className="text-xs font-semibold text-indigo-600">{currentProjectIndex + 1}</span>
                                                <span className="text-xs text-gray-400">/</span>
                                                <span className="text-xs text-gray-600">{projects.length}</span>
                                            </div>

                                            <button
                                                onClick={() => scrollProjects('right')}
                                                disabled={currentProjectIndex === projects.length - 1}
                                                className="group relative w-10 h-10 rounded-full bg-white border-2 border-gray-300 
                       flex items-center justify-center hover:border-indigo-500 hover:bg-indigo-50
                       transition-all duration-300 shadow-md hover:shadow-lg
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
                                            >
                                                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-600 transition-colors" />
                                                <div className="absolute inset-0 rounded-full bg-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            </button>
                                        </div>
                                    )}

                                </div>

                                <div className="relative pb-8 pl-12 md:pl-16">
                                    <div className="absolute left-0 md:left-2 top-0 -translate-x-1/2 w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center z-10 text-gray-600 shadow-sm">
                                        <span className="text-xs font-bold">4</span>
                                    </div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-base sm:text-lg font-medium text-gray-900 tracking-tight">Hiring Opportunities</h3>
                                        {/* {jobs.length > 2 && (
                                            <div className="hidden sm:flex gap-2">
                                                <button
                                                    onClick={() => scrollJobs('left')}
                                                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => scrollJobs('right')}
                                                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )} */}



                                    </div>
                                    {/* <div
                                        ref={jobScrollRef}
                                        className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth" */}
                                    {/* <div
                                        ref={jobScrollRef}
                                        className="flex gap-4 pb-4 snap-x snap-mandatory scroll-smooth
               overflow-x-auto md:overflow-x-auto
               pl-4 md:pl-0 -ml-4 md:ml-0 pr-[25%] md:pr-0"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    > */}
                                    <div
                                        ref={jobScrollRef}
                                        className="flex gap-2 md:gap-4 pb-4 snap-x snap-mandatory scroll-smooth
               overflow-x-auto md:overflow-x-auto
               pl-1 md:pl-0 -ml-1 md:ml-0 pr-[40%] md:pr-0"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    >
                                        {jobs.length > 0 ? (
                                            jobs.map((job, index) => (
                                                <div
                                                    key={job.id}
                                                    className="
        snap-start 
        min-w-[60vw] sm:min-w-[260px]
        md:min-w-[260px]
        p-2.5 sm:p-4 rounded-lg 
        border border-gray-200 bg-white 
        hover:border-gray-300 transition-all
        duration-300 shadow-sm animate-slide-in
        min-h-[180px] sm:min-h-auto
        flex flex-col
    "
                                                    style={{ animationDelay: `${index * 0.15}s` }}
                                                >
                                                    <div className="flex items-start justify-between mb-2 sm:mb-4">
                                                        <div className="flex items-center gap-1.5 sm:gap-3">
                                                            <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded ${job.bgColor} text-white flex items-center justify-center text-[9px] sm:text-sm font-bold`}>
                                                                {job.initial}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-[10px] sm:text-sm font-medium text-gray-900 line-clamp-1">{job.title}</h4>
                                                                <p className="text-[7px] sm:text-[10px] text-gray-500">{job.company}</p>
                                                            </div>
                                                        </div>

                                                        <span className="text-[7px] sm:text-[10px] text-gray-600 border border-gray-300 px-1 py-[2px] rounded bg-gray-50 whitespace-nowrap">
                                                            {job.type}
                                                        </span>
                                                    </div>

                                                    <div className="bg-gray-50 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4 border border-gray-200 flex-grow">
                                                        <p className="text-[7px] sm:text-[10px] text-gray-500 mb-1 sm:mb-1">
                                                            {job.type === 'Contract' ? 'Monthly Salary' : 'Monthly Stipend'}
                                                        </p>
                                                        <p className={`text-[11px] sm:text-sm font-medium ${job.textColor}`}>
                                                            ₹{formatAmount(job.stipend)}
                                                        </p>
                                                    </div>

                                                    <button className={`w-full py-1.5 sm:py-2.5 ${job.btnColor} text-white text-[9px] sm:text-xs font-medium rounded-lg transition-all hover:opacity-90 mt-auto`}>
                                                        Apply Now
                                                    </button>
                                                </div>
                                            ))

                                        ) : (
                                            <p className="text-sm text-gray-500">No hiring opportunities available</p>
                                        )}
                                    </div>
                                    {jobs.length > 2 && (
                                        <div className="flex items-center justify-center gap-3 mt-4">
                                            <button
                                                onClick={() => scrollJobs('left')}
                                                disabled={currentJobIndex === 0}
                                                className="group relative w-10 h-10 rounded-full bg-white border-2 border-gray-300 
                       flex items-center justify-center hover:border-emerald-500 hover:bg-emerald-50
                       transition-all duration-300 shadow-md hover:shadow-lg
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
                                            >
                                                <ChevronLeft className="w-5 h-5 text-gray-600 group-hover:text-emerald-600 transition-colors" />
                                                <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            </button>

                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
                                                <span className="text-xs font-semibold text-emerald-600">{currentJobIndex + 1}</span>
                                                <span className="text-xs text-gray-400">/</span>
                                                <span className="text-xs text-gray-600">{jobs.length}</span>
                                            </div>

                                            <button
                                                onClick={() => scrollJobs('right')}
                                                disabled={currentJobIndex === jobs.length - 1}
                                                className="group relative w-10 h-10 rounded-full bg-white border-2 border-gray-300 
                       flex items-center justify-center hover:border-emerald-500 hover:bg-emerald-50
                       transition-all duration-300 shadow-md hover:shadow-lg
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-300 disabled:hover:bg-white"
                                            >
                                                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-emerald-600 transition-colors" />
                                                <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                            </button>
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    )}






                    {showCertificateDownload && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm z-50">
                            <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative text-center">
                                <button onClick={() => setShowCertificateDownload(false)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                                    ✖
                                </button>

                                <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
                                    ⏳
                                </div>

                                <h2 className="text-lg font-semibold mb-2 text-gray-900">Certificate Not Available Yet</h2>

                                <p className="text-gray-600">
                                    You can download your certificate on<br />
                                    {(() => {
                                        let d = new Date(examDate);
                                        d.setDate(d.getDate() + 1);
                                        d.setHours(17, 0, 0, 0);
                                        return (
                                            <span className="font-semibold">
                                                {d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
                                                &nbsp;at 5:00 PM
                                            </span>
                                        );
                                    })()}

                                </p>

                                <button onClick={() => setShowCertificateDownload(false)}
                                    className="mt-4 bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600">
                                    OK
                                </button>
                            </div>
                        </div>
                    )}






                    {showPlanModal && (
                        <div
                            onClick={(e) => {
                                if (e.target === e.currentTarget) {
                                    setShowPlanModal(false);
                                }
                            }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-3 sm:p-4"
                        >
                            <div
                                onClick={(e) => e.stopPropagation()}
                                className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col"
                            >
                                {/* HEADER - Sticky */}
                                <div className="sticky top-0 bg-white px-3 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex items-center justify-between z-10 shrink-0">
                                    <div>
                                        <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Choose Your iCAT Learning Path</h2>
                                        <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-600 mt-0.5">
                                            Select the plan that matches your qualification status
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => setShowPlanModal(false)}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* SCROLLABLE CONTENT */}
                                <div className="overflow-y-auto flex-1">
                                    <div className="p-3 sm:p-4 md:p-6">

                                        {/* ========== DESKTOP TABLE VIEW ========== */}
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
                                                        onClick={() => {
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

                                                            navigate("/free-thank-you");
                                                        }}
                                                        className="w-full py-2 lg:py-2.5 text-center text-gray-900 text-[11px] lg:text-sm font-bold"
                                                    >
                                                        Get Started
                                                    </a>
                                                </div>

                                                <div className="p-3 lg:p-4 bg-purple-50">
                                                    <button
                                                        onClick={handleUnlockPremium}
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
                                                        <span className="font-bold">iCAT Qualified Special:</span> Save ₹{finalPrice === 2000 ? '6,500' : '7,910'} instantly! Exclusive offer for qualified students.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ========== MOBILE VIEW - MATCHING PRICING SECTION ========== */}
                                        <div className="md:hidden">
                                            {/* Plan Headers Side by Side */}
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                {/* Non-Qualified Plan */}
                                                {/* <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden shadow-sm"> */}
                                                <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden shadow-sm flex flex-col">

                                                    <div className="bg-gray-100 p-2.5 border-b border-gray-200 text-center">
                                                        <h3 className="text-[11px] font-bold text-gray-900 mb-0.5">iCAT Non-Qualified</h3>
                                                        <div className="mb-0.5">
                                                            <span className="text-xl font-bold text-gray-900">Free</span>
                                                        </div>
                                                        <p className="text-[8px] text-gray-600">Basic Features</p>
                                                    </div>
                                                    <div className="p-2 space-y-1.5">
                                                        {comparisonFeatures.map((feature, idx) => (
                                                            <div key={idx} className="flex items-start gap-1">
                                                                {feature.free === false ? (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                                    </svg>
                                                                ) : (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                        <polyline points="20 6 9 17 4 12"></polyline>
                                                                    </svg>
                                                                )}
                                                                <span className={`text-[9px] leading-tight ${feature.free === false ? 'text-gray-400' : 'text-gray-900 font-medium'}`}>
                                                                    {feature.feature}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {/* <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-center items-center"> */}
                                                    <div className="p-2 bg-gray-50 border-t border-gray-200 flex justify-center items-center mt-auto">

                                                        <a
                                                            onClick={() => {
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

                                                                navigate("/free-thank-you");
                                                            }}
                                                            className="w-full text-center py-1.5 text-gray-900 text-[9px] font-bold"
                                                        >
                                                            Get Started
                                                        </a>
                                                    </div>
                                                </div>

                                                {/* Qualified Plan */}
                                                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg overflow-hidden shadow-lg relative">
                                                    <div className="absolute top-1 right-1.5 z-10">
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
                                                        {comparisonFeatures.map((feature, idx) => (
                                                            <div key={idx} className="flex items-start gap-1">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-emerald-300 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                                </svg>
                                                                <span className="text-[9px] text-white font-medium leading-tight">
                                                                    {feature.feature}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="p-2 bg-white/10 border-t border-white/20">
                                                        <button
                                                            onClick={handleUnlockPremium}
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
                                                        <span className="font-bold text-purple-700">iCAT Special:</span> Save ₹{finalPrice === 2000 ? '6,500' : '7,910'}! Exclusive for qualified students.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>

                            </div>
                        </div>
                    )}


                </section>


                {showVideo && (
                    <div
                        className="fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-4"
                        onClick={() => setShowVideo(false)}
                    >
                        <div
                            className="relative w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <video
                                className="w-full h-full"
                                src="/internship-overview.mp4"   // ✅ your public folder file
                                controls
                                autoPlay
                                playsInline
                            >
                                Your browser does not support the video tag.
                            </video>

                        </div>
                    </div>
                )}

            </main>
            <main className="flex-grow w-full max-w-4xl mx-auto px-4 sm:px-6">

                <section className="mt-10 mb-10 bg-[#F7F9FF] border border-indigo-100 rounded-xl shadow-sm">

                    <PricingSection
                        onUnlockPremium={handleUnlockPremium}
                        selectedSubdomainId={selectedSubdomainId}
                        selectedBatch={selectedBatch}
                        setInputErrors={setInputErrors}
                        qualifiedStatus={qualifiedStatus}
                        finalPrice={finalPrice}
                    />




                </section>
            </main>



            <div className="fixed bottom-0 left-0 w-full z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">

                <div className="max-w-8xl mx-auto px-4 sm:px-6 py-4">

                    <div className="flex flex-col gap-3 md:hidden">

                        <div className="flex w-full gap-2">

                            <div className="relative w-1/2">
                                <select
                                    value={selectedSubdomainId}
                                    onChange={handleSubdomainChange}
                                    disabled={!selectedDomainId}
                                    className={`w-full px-3 py-2 text-[12px] font-medium bg-white border ${inputErrors.subdomain ? 'border-red-500 border-2' : 'border-gray-300'} rounded-md shadow-sm appearance-none disabled:bg-gray-200`}
                                >
                                    <option value="">Subdomain</option>
                                    {subdomains.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 w-3 pointer-events-none" />
                            </div>

                            <div className="relative w-1/2">
                                <select
                                    value={selectedBatch}
                                    // onChange={(e) => {
                                    //     setSelectedBatch(e.target.value);
                                    //     setInputErrors(prev => ({ ...prev, batch: false }));
                                    // }}
                                    // onChange={(e) => {
                                    //     const batchId = e.target.value;
                                    //     setSelectedBatch(batchId);
                                    //     setInputErrors(prev => ({ ...prev, batch: false }));

                                    //     // ⭐ Save in localStorage
                                    //     const batchObj = batches.find(b => b.id == batchId);
                                    //     if (batchObj) {
                                    //         localStorage.setItem("savedBatchID", batchId);
                                    //         localStorage.setItem("savedBatchDate", batchObj.date);
                                    //     }
                                    // }}

                                    onChange={(e) => {
                                        const batchId = e.target.value;
                                        setSelectedBatch(batchId);

                                        setInputErrors(prev => ({ ...prev, batch: !batchId }));

                                        const batchObj = batches.find(b => b.id == batchId);
                                        if (batchObj) {
                                            localStorage.setItem("savedBatchID", batchId);
                                            localStorage.setItem("savedBatchDate", batchObj.date);
                                        }
                                    }}


                                    className={`w-full px-3 py-2 text-[12px] font-medium bg-white border ${inputErrors.batch ? 'border-red-500 border-2' : 'border-gray-300'} rounded-md shadow-sm appearance-none`}
                                >
                                    <option value="">Select Batch</option>
                                    {batches.length === 0 && (
                                        <option disabled>🚫 No Upcoming Batches Available</option>
                                    )}

                                    {batches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.date} {b.is_special == "1" && "🌟"}
                                        </option>
                                    ))}

                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 w-3 pointer-events-none" />
                            </div>
                        </div>

                        <div className="w-full">
                            <button className="w-full bg-gray-900 text-white text-[15px] font-semibold px-4 py-3 rounded-md shadow-md flex items-center justify-center gap-1" onClick={() => {
                                if (selectedSubdomainId && selectedBatch) {
                                    setShowPlanModal(true);
                                } else {
                                    // highlight the missing fields
                                    setInputErrors({
                                        subdomain: !selectedSubdomainId,
                                        batch: !selectedBatch
                                    });
                                }
                            }}>

                                Start Internship <ArrowRight className="w-5" />
                            </button>

                        </div>
                    </div>



                    <div className="hidden md:flex items-center justify-between gap-4">

                        <div className="flex items-center gap-4 w-[70%]">

                            <div className="relative w-1/2">
                                <label className="text-xs font-semibold text-gray-600 ml-1">Subdomain</label>
                                <select
                                    value={selectedSubdomainId}
                                    onChange={handleSubdomainChange}
                                    disabled={!selectedDomainId}
                                    className={`w-full bg-white border ${inputErrors.subdomain ? 'border-red-500 border-2' : 'border-gray-300'} rounded-lg px-4 py-3 shadow-sm appearance-none text-sm`}
                                >
                                    <option value="">Select Subdomain</option>
                                    {subdomains.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-[60%] -translate-y-1/2 text-gray-500 w-4 pointer-events-none" />
                            </div>

                            <div className="relative w-1/2">
                                <label className="text-xs font-semibold text-gray-600 ml-1">Batch</label>
                                <select
                                    value={selectedBatch}
                                    // onChange={(e) => {
                                    //     setSelectedBatch(e.target.value);
                                    //     setInputErrors(prev => ({ ...prev, batch: false }));
                                    // }}
                                    // onChange={(e) => {
                                    //     const batchId = e.target.value;
                                    //     setSelectedBatch(batchId);
                                    //     setInputErrors(prev => ({ ...prev, batch: false }));

                                    //     // ⭐ Save in localStorage
                                    //     const batchObj = batches.find(b => b.id == batchId);
                                    //     if (batchObj) {
                                    //         localStorage.setItem("savedBatchID", batchId);
                                    //         localStorage.setItem("savedBatchDate", batchObj.date);
                                    //     }
                                    // }}
                                    onChange={(e) => {
                                        const batchId = e.target.value;
                                        setSelectedBatch(batchId);

                                        setInputErrors(prev => ({ ...prev, batch: !batchId }));

                                        const batchObj = batches.find(b => b.id == batchId);
                                        if (batchObj) {
                                            localStorage.setItem("savedBatchID", batchId);
                                            localStorage.setItem("savedBatchDate", batchObj.date);
                                        }
                                    }}


                                    className={`w-full bg-white border ${inputErrors.batch ? 'border-red-500 border-2' : 'border-gray-300'} rounded-lg px-4 py-3 shadow-sm appearance-none text-sm`}
                                >
                                    <option value="">Select Batch</option>
                                    {batches.map(b => (
                                        <option key={b.id} value={b.id}>{b.date}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-[60%] -translate-y-1/2 text-gray-500 w-4 pointer-events-none" />
                            </div>

                        </div>

                        <button className="px-8 py-3 bg-gray-900 text-white rounded-lg shadow-lg font-semibold flex items-center gap-2 mt-6" onClick={() => {
                            if (selectedSubdomainId && selectedBatch) {
                                setShowPlanModal(true);
                            } else {
                                // highlight the missing fields
                                setInputErrors({
                                    subdomain: !selectedSubdomainId,
                                    batch: !selectedBatch
                                });
                            }
                        }}>
                            Start Internship <ArrowRight className="w-4" />
                        </button>
                    </div>

                </div>
            </div>





            {/* <style jsx>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes scale-in {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                @keyframes slide-in {
                    from {
                        opacity: 0;
                        transform: translateX(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .animate-fade-in-up {
                    animation: fade-in-up 0.6s ease-out;
                }

                .animate-scale-in {
                    animation: scale-in 0.4s ease-out backwards;
                }

                .animate-slide-in {
                    animation: slide-in 0.5s ease-out backwards;
                }

                div::-webkit-scrollbar {
                    display: none;
                }

                div {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style> */}

            <style jsx>{`
    @keyframes fade-in-up {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes scale-in {
        from {
            opacity: 0;
            transform: scale(0.9);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    @keyframes slide-in {
        from {
            opacity: 0;
            transform: translateX(-20px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    /* NEW: Card stack effect */
    @media (max-width: 768px) {
        [ref="projectScrollRef"] > div:not(:first-child),
        [ref="jobScrollRef"] > div:not(:first-child) {
            transform: scale(0.95) translateY(8px);
            opacity: 0.7;
        }
    }

    .animate-fade-in-up {
        animation: fade-in-up 0.6s ease-out;
    }

    .animate-scale-in {
        animation: scale-in 0.4s ease-out backwards;
    }

    .animate-slide-in {
        animation: slide-in 0.5s ease-out backwards;
    }

    div::-webkit-scrollbar {
        display: none;
    }

    div {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
`}</style>
            <Toaster
                position="top-center"
                containerStyle={{
                    zIndex: 9999999,
                }}
                toastOptions={{
                    duration: 3000,
                }}
            />

            <SkillSpiderChartModal
                show={showSpiderChart}
                onClose={() => setShowSpiderChart(false)}
                skills={skills.map(s => s.name)}
                skillLevels={skills.map(s => s.percent)}
                highlightIndex={highlightSkillIndex}
                subdomain={subdomains.find(s => s.id == selectedSubdomainId)?.name || ""}
            />


        </div>
    );
}