// file path: web/src/App.jsx

import React, { lazy, Suspense } from "react";
import { Route, Routes, useNavigate, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import ScrollToTop from "./components/ScrollToTop";
import LandingPage from "./pages/LandingPage";
import HowItWorks from "./pages/HowItWorks";
import About from "./pages/About";
import SignIn from "./pages/auth/SignIn";
import GetStarted from "./pages/auth/GetStarted";
import StudentDashboard from "./pages/dashboards/StudentDashboard";
import InstructorDashboard from "./pages/dashboards/InstructorDashboard";
import AdminDashboard from "./pages/dashboards/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";

// Heavy 3D-canvas routes (R3F + Three.js + drei) are code-split so the main
// bundle isn't bloated with the simulation runtime for users who never open it.
// Each lazy() call becomes its own Vite chunk; first navigation triggers fetch.
const Step01Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step01Preview'))
const Step02Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step02Preview'))
const Step03Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step03Preview'))
const Step04Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step04Preview'))
const Step05Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step05Preview'))
const Step06Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step06Preview'))
const Step07Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step07Preview'))
const Step08Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step08Preview'))
const Step09Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step09Preview'))
const Step10Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step10Preview'))
const Step11Preview       = lazy(() => import('./simulation/dev-do-not-touch/Step11Preview'))
const StepCompletePreview = lazy(() => import('./simulation/dev-do-not-touch/StepCompletePreview'))

// Student pages
import Profile from "./pages/dashboards/student/Profile";
import ProfileEdit from "./pages/dashboards/student/profile/ProfileProgress";
import StudentOverview from "./pages/dashboards/student/Overview";
import Courses from "./pages/dashboards/student/Courses";
import CourseDetails from "./pages/dashboards/student/CourseDetails";
import Modules from "./pages/dashboards/student/Modules";
import Quizzes from "./pages/dashboards/student/Quizzes";
import QuizAttempt from "./pages/dashboards/student/learning/QuizAttempt";
import DeboningGuide from "./pages/dashboards/student/DeboningGuide";
import DeboningGuideFull from "./pages/dashboards/student/DeboningGuideFull";
import ModuleReader from "./pages/dashboards/student/learning/ModuleReader";
// Simulations is the heaviest student page (mounts the BangusDeboningSim).
// Lazy-loaded so the dashboard FCP isn't blocked by the Three.js bundle.
const Simulations = lazy(() => import("./pages/dashboards/student/Simulations"));
import Leaderboard from "./pages/dashboards/student/Leaderboard";
import StudentSettings from "./pages/dashboards/student/Settings";

// Instructor pages
import InstructorOverview from "./pages/dashboards/instructor/Overview";
import CourseManagement from "./pages/dashboards/instructor/CourseManagement";
import InstructorCourseDetails from "./pages/dashboards/instructor/InstructorCourseDetails";
import StudentManagement from "./pages/dashboards/instructor/StudentManagement";
import AnalyticsReports from "./pages/dashboards/instructor/AnalyticsReport";
import InstructorSettings from "./pages/dashboards/instructor/Settings";

// Admin pages
import AdminOverview from "./pages/dashboards/admin/Overview";
import UserManagement from "./pages/dashboards/admin/UserManagement";
import ActivityLogs from "./pages/dashboards/admin/ActivityLogs";
import SystemSettings from "./pages/dashboards/admin/Settings";

// onBack removed from Modules, Quizzes, DeboningGuide wrappers
const QuizzesRoute       = () => { const n = useNavigate(); return <Quizzes          onBack={() => n("/student")} />; };
const QuizAttemptRoute   = () => <QuizAttempt />;
const DeboningGuideRoute = () => { const n = useNavigate(); return <DeboningGuide onBack={() => n("/student")} />; };

// Minimal fallback for the lazy-loaded heavy routes. Plain CSS, no extra
// dependencies — shows for the brief window while the simulation chunk fetches.
// Fullscreen loading screen for lazy-loaded simulation routes.
const LazyRouteFallback = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100vw', height: '100vh', background: '#0a0a0a', color: '#aaa',
    fontFamily: "'Rajdhani', sans-serif", fontSize: 14, letterSpacing: '0.08em',
  }}>
    Loading simulation…
  </div>
);

// Wraps a lazy element in a single shared Suspense boundary so each dev/sim
// route gets the same fallback without repeating <Suspense> per <Route>.
const lazyRoute = (Element) => (
  <Suspense fallback={<LazyRouteFallback />}>
    <Element />
  </Suspense>
);

const App = () => {
  return (
    <div>
      <Toaster position="top-right" />
      <ScrollToTop />
      <Routes>

        {/* ── Public ──────────────────────────────────────────────── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/about" element={<About />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/get-started" element={<GetStarted />} />

        {/* ── Dev-only step previews (unprotected, direct URL access) ──── */}
        {/* Lazy-loaded — each preview is its own Vite chunk so they don't
            ship with the main bundle for end users who never visit /dev/*. */}
        <Route path="/dev/step01"       element={lazyRoute(Step01Preview)} />
        <Route path="/dev/step02"       element={lazyRoute(Step02Preview)} />
        <Route path="/dev/step03"       element={lazyRoute(Step03Preview)} />
        <Route path="/dev/step04"       element={lazyRoute(Step04Preview)} />
        <Route path="/dev/step05"       element={lazyRoute(Step05Preview)} />
        <Route path="/dev/step06"       element={lazyRoute(Step06Preview)} />
        <Route path="/dev/step07"       element={lazyRoute(Step07Preview)} />
        <Route path="/dev/step08"       element={lazyRoute(Step08Preview)} />
        <Route path="/dev/step09"       element={lazyRoute(Step09Preview)} />
        <Route path="/dev/step10"       element={lazyRoute(Step10Preview)} />
        <Route path="/dev/step11"       element={lazyRoute(Step11Preview)} />
        <Route path="/dev/step-complete" element={lazyRoute(StepCompletePreview)} />

        {/* ── Student — all routes live under /student ───────────── */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentOverview />} />
          <Route path="profile" element={<Profile />} />
          <Route path="profile/edit" element={<ProfileEdit />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/:courseId" element={<CourseDetails />} />
          <Route path="modules" element={<Modules />} />
          <Route path="modules/:moduleId" element={<ModuleReader />} />
          <Route path="quizzes" element={<QuizzesRoute />} />
          <Route path="quizzes/:moduleId" element={<QuizAttemptRoute />} />
          <Route path="deboning-guide" element={<DeboningGuideRoute />} />
          <Route path="deboning-guide/full" element={<DeboningGuideFull />} />
          <Route path="simulator" element={<Simulations />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="settings" element={<StudentSettings />} />
        </Route>

        {/* Old redirects */}
        <Route path="/student/dashboard"   element={<Navigate to="/student" replace />} />
        <Route path="/student/dashboard/*" element={<Navigate to="/student" replace />} />

        {/* ── Instructor ───────────────────────────────────────────── */}
        <Route
          path="/instructor/dashboard"
          element={
            <ProtectedRoute allowedRoles={["instructor"]}>
              <InstructorDashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<InstructorOverview />} />
          <Route path="courses" element={<CourseManagement />} />
          <Route path="courses/:courseId" element={<InstructorCourseDetails />} />
          <Route path="students" element={<StudentManagement />} />
          <Route path="analytics" element={<AnalyticsReports />} />
          <Route path="settings" element={<InstructorSettings />} />
        </Route>

        {/* ── Admin ────────────────────────────────────────────────── */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="activity-logs" element={<ActivityLogs />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="analytics" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="courses" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="announcements" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

      </Routes>
    </div>
  );
};

export default App;