import { useState, useEffect, useRef, useContext } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { AlertTriangle } from "lucide-react";
import { AppContext } from "../../../context/AppContext";

import ClassSummaryTab from "./analytics/ClassSummaryTab";
import SimulationTab   from "./analytics/SimulationTab";
import QuizzesTab      from "./analytics/QuizzesTab";
import StudentsTab     from "./analytics/StudentsTab";
import InfoModal       from "./analytics/shared/InfoModal";
import "./AnalyticsReport.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const TAB_MODALS = {
  summary: {
    title: "Class Summary Tab",
    description: "A high-level overview of your entire class's performance across both simulation sessions and quizzes.",
    purpose: "Gives you a single-page snapshot before diving into tab-specific analytics.",
    guide: "Start here. If any summary stat is in the red, switch to the corresponding tab for drill-down. Cross-reference Sim Pass Rate with Quiz Pass Rate — a gap suggests theory-to-practice transfer issues.",
  },
  simulation: {
    title: "Simulation Tab",
    description: "Detailed analytics from your students' fish deboning simulation sessions: scores, errors, step mastery, tool usage, and learning curves.",
    purpose: "Identifies which procedural steps and error types are causing the most difficulty.",
    guide: "Use the Error Heatmap to find the worst step-error combinations, then cross-reference with Step Mastery to see if mastery is improving over time.",
  },
  quizzes: {
    title: "Quizzes Tab",
    description: "Analytics across all five knowledge modules: pass rates, first-pass performance, streaks, quiz coverage, and the hardest individual questions.",
    purpose: "Identifies which theory modules are weakest and which questions students consistently miss.",
    guide: "Low first-pass rate on Module 4 (Bangus Deboning) directly predicts high missed-bone errors in the simulator. Address quiz gaps before expecting simulation improvement.",
  },
  students: {
    title: "Students Tab",
    description: "Per-student view of simulation performance, quiz attempts, module completion, and engagement status.",
    purpose: "Find individual students who need intervention — either underperforming or disengaged.",
    guide: "Sort by Avg Score to find struggling students, or filter by engagement dot to find inactive students. Click any row to see their full individual analytics.",
  },
};

// Compute ISO timestamp from a preset key. Called at fetch time so the
// window is always relative to "now" rather than relative to last render.
const getSince = (preset) => {
  if (!preset) return null;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[preset];
  return days ? new Date(Date.now() - days * 86400000).toISOString() : null;
};

const AnalyticsReports = () => {
  const { token } = useContext(AppContext);

  const [courses,              setCourses]              = useState([]);
  const [selectedCourse,       setSelectedCourse]       = useState(null);
  const [sincePreset,          setSincePreset]          = useState("");
  const [activeTab,            setActiveTab]            = useState("summary");
  const [activeModal,          setActiveModal]          = useState(null);

  const [simData,              setSimData]              = useState(null);
  const [quizData,             setQuizData]             = useState([]);
  const [hardestQuestions,     setHardestQuestions]     = useState([]);
  const [scoreDistribution,    setScoreDistribution]    = useState([]);
  const [learningCurveData,    setLearningCurveData]    = useState([]);
  const [learningCurveHasMore, setLearningCurveHasMore] = useState(false);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState(null);

  const abortCtrlRef = useRef(null);

  // Load course list once
  useEffect(() => {
    axios
      .get(`${API_URL}/api/courses/instructor/my-courses`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(res => setCourses(res.data.courses || []))
      .catch(() => toast.error("Failed to load courses"));
  }, [token]);

  // Refetch analytics whenever course or date preset changes
  useEffect(() => {
    fetchAnalytics();
    return () => { if (abortCtrlRef.current) abortCtrlRef.current.abort(); };
  }, [selectedCourse, sincePreset, token]);

  const fetchAnalytics = async () => {
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
    abortCtrlRef.current = new AbortController();
    const { signal } = abortCtrlRef.current;

    setLoading(true);
    setError(null);
    const since = getSince(sincePreset);

    // Build query string helper
    const qs = (params) => {
      const entries = Object.entries(params).filter(([, v]) => v != null);
      return entries.length ? "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&") : "";
    };

    const simUrl = selectedCourse
      ? `${API_URL}/api/sim/analytics/course/${selectedCourse}${qs({ since })}`
      : `${API_URL}/api/sim/analytics/instructor${qs({ since })}`;

    const lcUrl = `${API_URL}/api/sim/analytics/learning-curve${qs({ courseId: selectedCourse, since })}`;
    const qBase = `${API_URL}/api/instructor/quiz`;

    let cancelled = false;
    try {
      const [simRes, quizRes, hqRes, lcRes] = await Promise.all([
        axios.get(simUrl,                                                                  { headers: { Authorization: `Bearer ${token}` }, signal }),
        axios.get(`${qBase}/overview${qs({ courseId: selectedCourse, since })}`,           { headers: { Authorization: `Bearer ${token}` }, signal }),
        axios.get(`${qBase}/hardest-questions${qs({ courseId: selectedCourse, since })}`, { headers: { Authorization: `Bearer ${token}` }, signal }),
        axios.get(lcUrl,                                                                   { headers: { Authorization: `Bearer ${token}` }, signal }),
      ]);

      setSimData(simRes.data);
      setScoreDistribution(simRes.data.score_distribution || []);

      const seen = new Set();
      setQuizData((quizRes.data.overview || []).filter(r => !seen.has(r.module_id) && seen.add(r.module_id)));
      setHardestQuestions(hqRes.data.questions || []);
      setLearningCurveData(lcRes.data.students || []);
      setLearningCurveHasMore(lcRes.data.has_more || false);
    } catch (err) {
      if (axios.isCancel(err)) { cancelled = true; return; }
      const msg = err.response?.data?.error || "Failed to load analytics";
      setError(msg);
      toast.error(msg);
    } finally {
      if (!cancelled) setLoading(false);
    }
  };

  const TABS = [
    { key: "summary",    label: "Class Summary" },
    { key: "simulation", label: "Simulation" },
    { key: "quizzes",    label: "Quizzes" },
    { key: "students",   label: "Students" },
  ];

  return (
    <div className="ar-page">
      <header className="ar-header">
        <h1 className="ar-title">Analytics <span className="it">& Reports.</span></h1>
      </header>

      <div className="ar-controls">
        <select
          className="ar-course-select"
          value={selectedCourse ?? ""}
          onChange={e => setSelectedCourse(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.code_name ? `${c.code_name} · ${c.name}` : c.name}
            </option>
          ))}
        </select>

        <select
          className="ar-date-select"
          value={sincePreset}
          onChange={e => setSincePreset(e.target.value)}
        >
          <option value="">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 3 months</option>
        </select>

        <div className="ar-tab-rail">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`ar-tab-pill${activeTab === tab.key ? " active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span
                className="ar-tab-info-btn"
                onClick={(e) => { e.stopPropagation(); setActiveModal(TAB_MODALS[tab.key]); }}
                aria-label={`About ${tab.label}`}
                title={`About ${tab.label}`}
              >ℹ</span>
            </button>
          ))}
        </div>
      </div>

      {activeTab === "students" ? (
        <StudentsTab token={token} selectedCourse={selectedCourse} since={getSince(sincePreset)} onInfoClick={setActiveModal} />
      ) : loading ? (
        <div className="ar-loading"><div className="ar-spinner" /><p>Loading analytics…</p></div>
      ) : error ? (
        <div className="ar-error-state">
          <AlertTriangle size={28} />
          <p>{error}</p>
          <button className="ar-retry-btn" onClick={fetchAnalytics}>Retry</button>
        </div>
      ) : (
        <>
          {activeTab === "summary"    && (
            <ClassSummaryTab
              simData={simData}
              quizData={quizData}
              onInfoClick={setActiveModal}
            />
          )}
          {activeTab === "simulation" && (
            <SimulationTab
              simData={simData}
              scoreDistribution={scoreDistribution}
              learningCurveData={learningCurveData}
              learningCurveHasMore={learningCurveHasMore}
              onInfoClick={setActiveModal}
            />
          )}
          {activeTab === "quizzes" && (
            <QuizzesTab
              quizData={quizData}
              hardestQuestions={hardestQuestions}
              onInfoClick={setActiveModal}
            />
          )}
        </>
      )}

      <InfoModal info={activeModal} onClose={() => setActiveModal(null)} />
    </div>
  );
};

export default AnalyticsReports;
