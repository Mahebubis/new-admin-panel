import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QuestionModal from "./QuestionModal";
import SummaryModal from "./SummaryModal";
import QuizLoader from "./QuizLoader";
import ImageModal from "./ImageModal";
import axios from "axios";

const QuizPanel = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState(new Set());
  // const [timeLeft, setTimeLeft] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(null);
  const [showWarning, setShowWarning] = useState(false);
  const [tabChangeCount, setTabChangeCount] = useState(0);
  const [unsavedAnswer, setUnsavedAnswer] = useState(null);
  const [isStaging, setIsStaging] = useState(false);


  const navigate = useNavigate();

  // Add tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShowWarning(true);
        setTabChangeCount((prev) => prev + 1);

        // Auto submit after 5 tab changes
        if (tabChangeCount >= 4) {
          // Will trigger on the 5th change (0-based index)
          handleAutoSubmit();
        }
      }
    };

    // Add warning when user tries to leave the page
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [tabChangeCount]);

  useEffect(() => {
    // Fetch questions and exam start time from the backend API
    const fetchExamData = async () => {
      const myHeaders = new Headers();
      myHeaders.append("userid", sessionStorage.getItem("user_id"));
      myHeaders.append("hash", sessionStorage.getItem("hash"));
      myHeaders.append("Content-Type", "application/json");

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({ exam_id: 1 }),
      };

      try {
        const response = await fetch(
          "https://examapi.internshipstudio.com/api/start_exam_process",
          requestOptions
        );
        const result = await response.json();

        // if (result.status === 200) {
        //   setQuestions(result.data.data);

        //   // Calculate remaining time
        //   const examDuration = 30 * 60; // 30 minutes in seconds
        //   const startTime = new Date(result.data.start_exam);
        //   const currentTime = new Date();
        //   const elapsedTime = Math.floor((currentTime - startTime) / 1000);
        //   const remainingTime = examDuration - elapsedTime;

        //   setTimeLeft(remainingTime > 0 ? remainingTime : 0);

        //   // Load previous answers if any
        //   const previousAnswers = {};
        //   result.data.data.forEach((question, index) => {
        //     if (
        //       question.selected_option !== null &&
        //       question.selected_option !== undefined
        //     ) {
        //       previousAnswers[index] = question.selected_option;
        //     }
        //   });
        //   setAnswers(previousAnswers);
        // } else if (result.status === 200 && result.message === "Exam Ended") {

        //   try {
        //     const res = await axios.post(
        //       "https://dashboard.internshipstudio.com/api/get_user_name.php",
        //       { user_id: sessionStorage.getItem("user_id") }
        //     );

        //     const domain = res?.data?.data?.domain?.toLowerCase() || "live";

        //     // if (domain === "staging") {
        //     //   navigate("/end-exam-new");
        //     // } else {
        //     //   navigate("/end-exam");
        //     // }
        //     if (domain === "staging") {

        //       setIsStaging(true);

        //       localStorage.setItem("platform", JSON.stringify({
        //         value: "staging",
        //         expiry: Date.now() + 3600000 // 1 hour = 3600000ms
        //       }));

        //       navigate("/end-exam-new");

        //     } else {
        //       setIsStaging(false);
        //       navigate("/end-exam");
        //     }


        //   } catch (error) {
        //     console.error("Domain API Failed:", error);
        //     navigate("/end-exam"); // default fallback
        //   }

        //   // Exam has already ended
        //   // navigate("/end-exam");
        // }



        if (result.status === 200 && result.message === "Exam Ended") {

          try {
            const res = await axios.post(
              "https://dashboard.internshipstudio.com/api/get_user_name.php",
              { user_id: sessionStorage.getItem("user_id") }
            );

            const domain = res?.data?.data?.domain?.toLowerCase() || "live";

            // if (domain === "staging") {
            //   navigate("/end-exam-new");
            // } else {
            //   navigate("/end-exam");
            // }
            if (domain === "staging") {

              setIsStaging(true);

              localStorage.setItem("platform", JSON.stringify({
                value: "staging",
                expiry: Date.now() + 3600000 // 1 hour = 3600000ms
              }));

              navigate("/end-exam-new");

            } else {
              setIsStaging(false);
              navigate("/end-exam");
            }


          } catch (error) {
            console.error("Domain API Failed:", error);
            navigate("/end-exam"); // default fallback
          }

          // Exam has already ended
          // navigate("/end-exam");
        } else if (result.status === 200) {
          setQuestions(result.data.data);

          // Calculate remaining time
          const examDuration = 30 * 60; // 30 minutes in seconds
          const startTime = new Date(result.data.start_exam);
          const currentTime = new Date();
          const elapsedTime = Math.floor((currentTime - startTime) / 1000);
          const remainingTime = examDuration - elapsedTime;

          setTimeLeft(remainingTime > 0 ? remainingTime : 0);

          // Load previous answers if any
          const previousAnswers = {};
          result.data.data.forEach((question, index) => {
            if (
              question.selected_option !== null &&
              question.selected_option !== undefined
            ) {
              previousAnswers[index] = question.selected_option;
            }
          });
          setAnswers(previousAnswers);
        }
      } catch (error) {
        console.error("Network error: " + error.message);
      }
    };

    fetchExamData();
  }, [navigate]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && questions.length > 0) {
      handleAutoSubmit();
    }
  }, [timeLeft, questions]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleAnswer = (optionId) => {
    setUnsavedAnswer(optionId);
  };

  const saveAnswer = async (questionIndex, optionId) => {
    const questionId = questions[questionIndex].question_id;
    const updatedAnswers = {
      ...answers,
      [questionIndex]: optionId,
    };
    setAnswers(updatedAnswers);

    // Update exam data on the backend
    const myHeaders = new Headers();
    myHeaders.append("userid", sessionStorage.getItem("user_id"));
    myHeaders.append("hash", sessionStorage.getItem("hash"));
    myHeaders.append("Content-Type", "application/json");

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify({
        exam_id: 1,
        user_answers: {
          [questionId]: optionId,
        },
      }),

    };

    try {
      await fetch(
        "https://examapi.internshipstudio.com/api/update_exam_data",
        requestOptions
      );
    } catch (error) {
      console.error("Error updating exam data:", error);
    }
  };

  const moveToNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setUnsavedAnswer(null);
    }
  };

  const handleMarkForReview = () => {
    const newMarkedForReview = new Set(markedForReview);
    if (newMarkedForReview.has(currentQuestion)) {
      newMarkedForReview.delete(currentQuestion);
    } else {
      newMarkedForReview.add(currentQuestion);
    }
    setMarkedForReview(newMarkedForReview);
  };

  const handleSaveAndNext = async () => {
    if (unsavedAnswer !== null) {
      await saveAnswer(currentQuestion, unsavedAnswer);
    }
    moveToNextQuestion();
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setUnsavedAnswer(null);
    }
  };

  const handleShowSummary = async () => {
    if (unsavedAnswer !== null) {
      await saveAnswer(currentQuestion, unsavedAnswer);
      setUnsavedAnswer(null); // Reset unsavedAnswer after saving
    }
    setShowSummaryModal(true);
  };

  function isWebview() {
    const navigator = window.navigator;
    const userAgent = navigator.userAgent;
    const normalizedUserAgent = userAgent.toLowerCase();
    const standalone = navigator.standalone;

    const isIos =
      /ip(ad|hone|od)/.test(normalizedUserAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(normalizedUserAgent);
    const isSafari = /safari/.test(normalizedUserAgent);
    const isWebview =
      (isAndroid && /; wv\)/.test(normalizedUserAgent)) ||
      (isIos && !standalone && !isSafari);

    return isWebview;
  }

  // for goal conversion
  function getCampaignAttribution() {
    const match = document.cookie.match(/(?:^|; )campaign_attr=([^;]*)/);
    if (!match) return null;
    try {
      return JSON.parse(decodeURIComponent(match[1]));
    } catch {
      return null;
    }
  }


  const handleEndExam = async () => {
    const userAnswers = {};
    for (const [index, answer] of Object.entries(answers)) {
      const questionId = questions[index].question_id;
      userAnswers[questionId] = answer;
    }

    const myHeaders = new Headers();
    myHeaders.append("userid", sessionStorage.getItem("user_id"));
    myHeaders.append("hash", sessionStorage.getItem("hash"));
    myHeaders.append("Content-Type", "application/json");
    const res = await axios.post(
      "https://dashboard.internshipstudio.com/api/get_user_name.php",
      { user_id: sessionStorage.getItem("user_id") }
    );

    const domain = res?.data?.data?.domain?.toLowerCase() || "live";

    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: JSON.stringify({
        exam_id: 1,
        user_answers: userAnswers,
        isWebview: isWebview(),
        instant_result: domain === "staging" ? "on" : "off",
      }),
    };

    try {
      const response = await fetch(
        "https://examapi.internshipstudio.com/api/end_exam",
        requestOptions
      );
      const result = await response.json();

      if (result.status === 200) {


        // for goal conversion
        const attribution = getCampaignAttribution();
        axios.post("https://dashboard.internshipstudio.com/api/record_exam_success.php", {
          user_id: sessionStorage.getItem("user_id"),
          status: "completed",
          result_score: result?.data?.score ?? null,
          campaign_id: attribution?.campaignId || null,
          medium: attribution?.medium || null,
          attr_clicked_at: attribution?.clickedAt || null,
        }).catch((error) => console.error("record_exam_success failed:", error));



        try {
          const res = await axios.post(
            "https://dashboard.internshipstudio.com/api/get_user_name.php",
            { user_id: sessionStorage.getItem("user_id") }
          );

          const domain = res?.data?.data?.domain?.toLowerCase() || "live";

          // if (domain === "staging") {
          //   navigate("/end-exam-new");
          // } else {
          //   navigate("/end-exam");
          // }

          if (domain === "staging") {

            setIsStaging(true);

            localStorage.setItem("platform", JSON.stringify({
              value: "staging",
              expiry: Date.now() + 3600000 // 1 hour = 3600000ms
            }));

            navigate("/end-exam-new");

          } else {
            setIsStaging(false);
            navigate("/end-exam");
          }


        } catch (error) {
          console.error("Domain API Failed:", error);
          navigate("/end-exam"); // default fallback
        }


        // navigate("/end-exam");
      } else {
        console.error("Error ending exam: " + result.message);
      }
    } catch (error) {
      console.error("Network error: " + error.message);
    }




    const sessionUserId = sessionStorage.getItem("user_id");
    try {
      const res = await axios.post(
        "https://dashboard.internshipstudio.com/api/assign_link_while_exam.php",
        { user_id: sessionUserId }
      );

      if (res.data.success) {
        console.log("Success:", res.data.message);
      } else {
        console.warn("Failed:", res.data.message);
      }
    } catch (error) {
      console.error("API Error:", error);
    }
  };

  const handleAutoSubmit = async () => {
    await handleEndExam();
  };

  const getQuestionStatus = (index) => {
    if (markedForReview.has(index)) return "review";
    if (answers[index] !== undefined) return "answered";
    return "unanswered";
  };

  const decodeHTMLEntities = (text) => {
    var textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  };

  // Custom Warning Component
  const Warning = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 mb-4 text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-red-600 mb-2">Warning!</h3>
          <p className="text-gray-700 text-center mb-4">
            Switching tabs during the exam is not allowed. You have switched
            tabs {tabChangeCount}/5 time(s).
            {tabChangeCount >= 4 && (
              <span className="block mt-2 font-bold text-red-600">
                The exam will be automatically submitted on the next tab switch!
              </span>
            )}
          </p>
          <button
            onClick={() => setShowWarning(false)}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );

  if (questions.length === 0) {
    return <QuizLoader />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {showWarning && <Warning />}

      {showSummaryModal && (
        <SummaryModal
          questions={questions}
          answers={answers}
          markedForReview={markedForReview}
          getQuestionStatus={getQuestionStatus}
          setShowSummaryModal={setShowSummaryModal}
          handleEndExam={handleEndExam}
          setSelectedQuestionIndex={setSelectedQuestionIndex}
        />
      )}
      {selectedQuestionIndex !== null && (
        <QuestionModal
          question={questions[selectedQuestionIndex]}
          userAnswer={answers[selectedQuestionIndex]}
          onClose={() => setSelectedQuestionIndex(null)}
        />
      )}

      {isImageZoomed && questions[currentQuestion].question_image && (
        <ImageModal
          imageUrl={`https://cit.internshipstudio.com/assets/exam/${questions[currentQuestion].question_image}`}
          onClose={() => setIsImageZoomed(false)}
        />
      )}

      {/* Main Header Bar */}
      <div className="bg-white rounded-lg shadow mb-4">
        <div className="mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold">
              Internship Common Aptitude Test
            </h1>

            {/* Stats and Actions */}
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              {/* Progress */}
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg">
                <span className="text-gray-600">Progress:</span>
                <span className="font-medium">
                  {Object.keys(answers).length}/{questions.length}
                </span>
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-lg text-orange-800">
                <span>Time Left:</span>
                <span className="font-medium">{formatTime(timeLeft)}</span>
              </div>

              {/* End Exam Button */}
              <button
                onClick={handleShowSummary}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                End Exam
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-6 flex-col md:flex-row">
        <div className="w-full md:w-80 bg-white rounded-lg p-4 shadow">
          <h2 className="font-semibold mb-4">Question Navigator</h2>
          <div className="overflow-x-auto md:overflow-x-hidden">
            <div className="flex md:grid md:grid-cols-5 gap-2 min-w-max md:min-w-0 pb-2 md:pb-0">
              {questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentQuestion(index);
                    setUnsavedAnswer(null);
                  }}
                  className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm transition-colors ${currentQuestion === index
                    ? "bg-orange-500 text-white"
                    : getQuestionStatus(index) === "answered"
                      ? "bg-green-500 text-white"
                      : getQuestionStatus(index) === "review"
                        ? "bg-blue-500 text-white"
                        : "bg-orange-200 text-orange-800"
                    }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm">Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-200 rounded"></div>
              <span className="text-sm">Not Answered</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-sm">Marked for Review</span>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-white rounded-lg p-6 shadow">
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">
                Question {currentQuestion + 1} of {questions.length}
              </h3>
              {questions[currentQuestion].question_text && (
                <p className="text-gray-800 mb-4">
                  {decodeHTMLEntities(questions[currentQuestion].question_text)}
                </p>
              )}
              {questions[currentQuestion].question_image && (
                <img
                  src={`https://cit.internshipstudio.com/assets/exam/${questions[currentQuestion].question_image}`}
                  alt="Question illustration"
                  className="max-w-full h-auto rounded-lg mb-4 cursor-pointer"
                  onClick={() => setIsImageZoomed(true)}
                />
              )}
            </div>

            <div className="space-y-3">
              {questions[currentQuestion].options.map((option) => (
                <div
                  key={option.option_id}
                  onClick={() => handleAnswer(option.option_id)}
                  className={`flex items-center space-x-2 w-full p-4 rounded transition-colors cursor-pointer ${unsavedAnswer === option.option_id ||
                    (!unsavedAnswer &&
                      answers[currentQuestion] === option.option_id)
                    ? "bg-green-100 border-2 border-green-500"
                    : "bg-gray-50 hover:bg-gray-100"
                    }`}
                >
                  <input
                    type="radio"
                    value={option.option_id}
                    checked={
                      unsavedAnswer === option.option_id ||
                      (!unsavedAnswer &&
                        answers[currentQuestion] === option.option_id)
                    }
                    onChange={() => handleAnswer(option.option_id)}
                    className="w-4 h-4 text-green-500 cursor-pointer"
                  />
                  <label className="flex-1 cursor-pointer">
                    {option.option_text}
                  </label>
                </div>
              ))}
            </div>

            {/* Navigation Buttons - Modified for mobile responsiveness */}
            <div className="flex justify-between mt-6">
              <button
                onClick={handlePrevious}
                disabled={currentQuestion === 0}
                className={`px-2 py-1 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${currentQuestion === 0
                  ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                  : "bg-[#f38f3d] text-white hover:bg-[#f38f3d]/90"
                  }`}
              >
                Previous
              </button>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleMarkForReview}
                  className={`px-2 py-1 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg transition-colors ${markedForReview.has(currentQuestion)
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-blue-50 text-blue-800 hover:bg-blue-100"
                    }`}
                >
                  {markedForReview.has(currentQuestion)
                    ? "Unmark"
                    : "Mark for Review"}
                </button>

                {currentQuestion === questions.length - 1 ? (
                  <button
                    onClick={handleShowSummary}
                    className="px-2 py-1 sm:px-4 sm:py-2 text-sm sm:text-base bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    Submit
                  </button>
                ) : (
                  <button
                    onClick={handleSaveAndNext}
                    className="px-2 py-1 sm:px-4 sm:py-2 text-sm sm:text-base bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    {unsavedAnswer !== null ? "Save & Next" : "Next"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPanel;
