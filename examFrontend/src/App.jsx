import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import QuizPage from "./pages/QuizPage";
import HomePage from "./pages/HomePage";
import SubmissionPage from "./pages/SubmissionPage";
import SubmissionPageNew from "./pages/SubmissionPageNew";
import InternshipDashboard from "./pages/ApplyInternshipJobSteps";
import ThankYouFree from "./pages/FreePage";

// Create a context for user data
export const UserContext = React.createContext(null);

// Wrapper component to handle URL parameters and authentication
const AuthHandler = ({ children }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyLogin = async (userId, hash, examId = 1) => {
      const myHeaders = new Headers();
      myHeaders.append("userid", userId);
      myHeaders.append("hash", hash);
      myHeaders.append("Content-Type", "application/json");

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify({ exam_id: examId }),
      };

      try {
        const response = await fetch(
          "https://examapi.internshipstudio.com/api/user_login_verify",
          requestOptions
        );
        const result = await response.json();

        if (result.status === 200) {
          return { success: true, data: result.data };
        } else {
          return { success: false, error: result.message };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    };

    const checkAuth = async () => {
      const userId =
        searchParams.get("user_id") || sessionStorage.getItem("user_id");
      const hash = searchParams.get("hash") || sessionStorage.getItem("hash");
      const source = searchParams.get("source") || sessionStorage.getItem("source");

      if (userId && hash) {
        if (searchParams.get("user_id")) {
          sessionStorage.setItem("user_id", userId);
          sessionStorage.setItem("hash", hash);
          if (source) sessionStorage.setItem("source", source);
          navigate("/", { replace: true });
        }

        const result = await verifyLogin(userId, hash);

        if (result.success) {
          sessionStorage.setItem("userEmail", result.data.user_details.email);

          console.log(result);

          setUserData(result.data.user_details);
          setIsLoading(false);
        } else {
          sessionStorage.removeItem("user_id");
          sessionStorage.removeItem("hash");
          sessionStorage.removeItem("userEmail");
          window.location.href = "https://dashboard.internshipstudio.com";
        }
      } else {
        window.location.href = "https://dashboard.internshipstudio.com";
      }
    };

    checkAuth();
  }, [searchParams, navigate]);

  if (isLoading) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  return (
    <UserContext.Provider value={userData}>{children}</UserContext.Provider>
  );
};

// Protected Route wrapper component
const ProtectedRoute = ({ children }) => {
  const userData = React.useContext(UserContext);

  if (!userData) {
    window.location.href = "https://dashboard.internshipstudio.com/login";
    return null;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthHandler>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz"
            element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/end-exam"
            element={
              <ProtectedRoute>
                <SubmissionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/end-exam-new"
            element={
              <ProtectedRoute>
                <SubmissionPageNew />
              </ProtectedRoute>
            }
          />
          <Route
            path="/free-thank-you"
            element={
              <ProtectedRoute>
                <ThankYouFree />
              </ProtectedRoute>
            }
          />
          <Route
            path="/applying-internship-jobs"
            element={
              <ProtectedRoute>
                <InternshipDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthHandler>
    </Router>
  );
}

export default App;
