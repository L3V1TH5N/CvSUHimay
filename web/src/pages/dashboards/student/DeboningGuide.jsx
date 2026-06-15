// file path: web/src/pages/dashboards/student/learning/DeboningGuide.jsx

import './DeboningGuide.css'; // page-scoped — do not import elsewhere

import { useState } from "react";
import { ArrowRight, ArrowLeft, Info, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { STEP_DEFINITIONS } from "../../../simulation/config/stepDefinitions";
import { STEP_TO_STATE }    from "../../../simulation/config/fsmConfig";

// ─── 3-class error taxonomy (thesis §Algorithm Overview) ─────────────────────
const ERROR_CLASSES = {
  CUT_PATH:     "Wrong cut path",
  FLESH_DAMAGE: "Excess flesh damage",
  MISSED_BONE:  "Missed bone",
};

// ─── Student-facing warning text per error class ─────────────────────────────
const STUDENT_WARNINGS = {
  [ERROR_CLASSES.CUT_PATH]:
    "Cuts outside the correct path waste usable flesh and can nick adjacent bones",
  [ERROR_CLASSES.FLESH_DAMAGE]:
    "Removing too much flesh reduces yield — keep cuts and forceps close to the bone",
  [ERROR_CLASSES.MISSED_BONE]:
    "Any unremoved fragment is a choking hazard — feel the flesh after each extraction",
};

// ─── Required skills for bangus deboning ─────────────────────────────────────
const REQUIRED_SKILLS = [
  {
    title:       "Manual Dexterity",
    description: "Precise hand movements and finger control for accurate cuts and bone removal without damaging flesh.",
    level:       "Essential",
  },
  {
    title:       "Hand-Eye Coordination",
    description: "Ability to coordinate visual input with hand movements to follow bone lines and make clean cuts.",
    level:       "Essential",
  },
  {
    title:       "Anatomical Knowledge",
    description: "Understanding bangus bone structure, its four bone zones, and internal anatomy to anticipate bone locations.",
    level:       "Important",
  },
  {
    title:       "Knife Safety Skills",
    description: "Proper knife handling, grip techniques, and safety awareness to prevent injuries during processing.",
    level:       "Critical",
  },
  {
    title:       "Patience & Focus",
    description: "Sustained concentration and careful execution, especially for the filamentous Y-shaped spines along the lateral line.",
    level:       "Important",
  },
  {
    title:       "Technique Mastery",
    description: "Learning and applying correct cutting angles, pressure control, and the sequential zone-by-zone extraction workflow.",
    level:       "Essential",
  },
];

// ─── Bangus data — the only species in CvSUHimay's scope ────────────────────
const BANGUS = {
  name:           "Bangus (Milkfish)",
  scientificName: "Chanos chanos",
  difficulty:     "Advanced",
  stepCount:      STEP_DEFINITIONS.length,
  bones:
    "Backbone (vertebral column); rib bones along the body cavity wall; " +
    "dorsal intermuscular spines running head-to-tail along the upper back; " +
    "ventral intermuscular spines below the lateral line (belly side); " +
    "filamentous Y-shaped spines along the lateral line. " +
    "Total: approximately 196–209 bones.",
  technique:
    "Filipino butterfly method (dorsal split) with systematic zone-by-zone " +
    "intermuscular-spine extraction — ribs → dorsal → ventral → lateral — followed by a comprehensive ",
  tips:
    "Always grip forceps close to the bone's base — never mid-shaft — to prevent " +
    "Y-spines from snapping and leaving buried fragments in the flesh. " +
    "After finishing, run your fingers across all four bone zones on both sides " +
    "of the fish before packaging.",
  description:
    "Bangus (milkfish, Chanos chanos) is the canonical species for CvSUHimay " +
    "training and the only fish fully modeled in the 3D simulator. It is " +
    "notoriously bony — with an estimated 196 to 209 total bones — yet deboning " +
    "it is a high-value skill because boneless bangus commands a significantly " +
    "higher market price and is acceptable to a much wider consumer base, " +
    "including children who would otherwise avoid it. Bones are distributed " +
    "across four distinct anatomical zones: the dorsal intermuscular spines " +
    "(upper back), the rib bones (body cavity wall), the ventral intermuscular " +
    "spines (belly side), and the filamentous Y-shaped spines along the lateral " +
    "line. The standard Philippine method — a dorsal butterfly split — gives the " +
    "processor full access to all four zones without separating the two fillets, " +
    "making sequential extraction possible in a single continuous workflow.",
  timeEstimate:  "20–30 min (beginner) · 8–12 min (expert)",
  practicalUse:  "Rellenong bangus, boneless bangus, smoked bangus (tinapa), daing na bangus",
  learningObjectives: [
    "Identify the four anatomical bone zones: dorsal intermuscular spines, rib bones, " +
      "ventral intermuscular spines, and lateral Y-shaped spines",
    "Execute the dorsal butterfly split without cutting through the belly or the skin",
    "Remove the backbone cleanly using the preferred bare-hand technique to minimize meat damage",
    "Apply zone-specific extraction techniques for each bone group, including the " +
      "thumb-and-index-finger meat support required for ventral spine removal",
    "Conduct a systematic bilateral quality check across all four bone zones before packaging",
  ],
  safetyTips: [
    "Use a sharp, flexible deboning knife — dull blades require more force and are more likely to slip",
    "Keep fingers away from the blade path; always cut away from your non-dominant hand",
    "Work on a stable, non-slip cutting board (plastic or hardwood)",
    "Grip forceps near the bone's base so Y-spines do not snap and leave fragments behind in the flesh",
    "Use cold water at all stages of washing — warm water promotes bacterial growth on exposed flesh surfaces",
  ],
  procedureSteps: [
    {
      title: "Trim fins and remove the anal fin",
      body:
        "Scaling is optional but reduces slip during handling. Using scissors or a knife, trim all fins " +
        "close to the body. For the anal fin specifically, make a shallow cut around its base and pull it " +
        "forward — toward the head — to extract both the fin and the attached nuisance bones in one clean " +
        "motion. Always pull forward: pulling backward tears the surrounding flesh.",
      fsmStates: [STEP_TO_STATE[1]],
      errors:    [ERROR_CLASSES.FLESH_DAMAGE],
    },
    {
      title: "Wash the fish thoroughly",
      body:
        "Rinse the fish under clean, cold running water. Remove loose scales, surface slime, and any debris " +
        "from the body surface. A well-rinsed fish is easier to grip and reduces contamination risk on the " +
        "flesh surfaces that will be exposed during the subsequent cuts.",
      fsmStates: [STEP_TO_STATE[2]],
      errors:    [],
    },
    {
      title: "Dorsal split — open the fish like a butterfly",
      body:
        "Lay the fish on its side. Slice from just behind the head down to the tail along the dorsal (back) " +
        "side, cutting only as deep as the backbone — do not cut through the belly. Turn the knife flat and " +
        "extend the cut from tail to head, running the blade edge along the underside of the backbone. " +
        "Open the fish flat like a butterfly fillet.",
      fsmStates: [STEP_TO_STATE[4]],
      errors:    [ERROR_CLASSES.CUT_PATH, ERROR_CLASSES.FLESH_DAMAGE],
    },
    {
      title: "Remove the gills and internal organs",
      body:
        "With the fish opened flat, locate and remove the gills — the feathery red structures just behind " +
        "the head at the base of the gill cover. Then clear out all internal organs: the alimentary canal, " +
        "stomach, liver, and other viscera. Wash the body cavity thoroughly in cold water before moving on.",
      fsmStates: [STEP_TO_STATE[5]],
      errors:    [ERROR_CLASSES.MISSED_BONE],
    },
    {
      title: "Remove the backbone",
      body:
        "Lay the fish flat on its skin. You can remove the backbone with a knife or — preferably — with your " +
        "bare hands. The manual method is favored in practice: your fingers give you continuous tactile feedback " +
        "along the bone's full length. Grip the backbone near the head end and peel it away along its natural " +
        "axis, working steadily toward the tail.",
      fsmStates: [STEP_TO_STATE[4]],
      errors:    [ERROR_CLASSES.CUT_PATH, ERROR_CLASSES.MISSED_BONE],
    },
    {
      title: "Remove the rib bones",
      body:
        "Place the fish flat on a shallow tray. Using forceps (mosquito forceps are the standard tool), grip " +
        "each rib bone close to its base and pull with a smooth, controlled motion. Work rib by rib. Be " +
        "especially careful along the belly portion: the belly fat layer is thin, and excessive force will tear it.",
      fsmStates: [STEP_TO_STATE[6]],
      errors:    [ERROR_CLASSES.MISSED_BONE, ERROR_CLASSES.FLESH_DAMAGE],
    },
    {
      title: "Remove the dorsal intermuscular spines",
      body:
        "Make a superficial slit along the dent of the dorsal muscle — the visible groove that runs from head " +
        "to tail along the upper back. Using forceps, pull each spine out individually, working from head to tail. " +
        "These spines have a characteristic Y-shape visible once extracted.",
      fsmStates: [STEP_TO_STATE[7]],
      errors:    [ERROR_CLASSES.MISSED_BONE, ERROR_CLASSES.FLESH_DAMAGE],
    },
    {
      title: "Remove the ventral intermuscular spines",
      body:
        "The ventral spines are located below the lateral line, running through the belly-side portion of the " +
        "flesh. Use the same head-to-tail pulling technique. A critical technique: press your thumb and index " +
        "finger firmly against the flesh on either side of the spine to prevent surrounding meat from being " +
        "carried away.",
      fsmStates: [STEP_TO_STATE[8]],
      errors:    [ERROR_CLASSES.MISSED_BONE, ERROR_CLASSES.FLESH_DAMAGE],
    },
    {
      title: "Remove the Y-shaped spines along the lateral line",
      body:
        "Score along the lateral line to locate the filamentous Y-shaped spines. Grip each spine with forceps " +
        "as close to the base as possible — gripping too far out causes the spine to snap at mid-shaft, leaving " +
        "a buried fragment. Pull in the direction the spine naturally points.",
      fsmStates: [STEP_TO_STATE[9]],
      errors:    [ERROR_CLASSES.MISSED_BONE, ERROR_CLASSES.FLESH_DAMAGE],
    },
    {
      title: "Final rinse",
      body:
        "Wash the fully deboned fish under clean, cold running water to flush away any bone chips, loose scales, " +
        "or surface contamination. Cold water is essential — warm water accelerates bacterial growth on exposed " +
        "flesh surfaces. Drain thoroughly before packaging.",
      fsmStates: [STEP_TO_STATE[10]],
      errors:    [],
    },
    {
      title: "Quality inspection — check all four zones, both sides",
      body:
        "Run your fingertips slowly and systematically across the entire flesh surface. Check all four zones on " +
        "both sides: (1) dorsal zone, (2) rib zone, (3) ventral zone, and (4) the lateral line for Y-spine " +
        "fragments. A single missed fragment is a choking hazard. Once confirmed clean, pack in a plastic bag " +
        "and freeze.",
      fsmStates: [STEP_TO_STATE[11]],
      errors:    [ERROR_CLASSES.MISSED_BONE],
    },
  ],
};

// ─── Data for the click-to-enlarge image modals ──────────────────────────────
const IMAGE_MODALS = {
  whole: {
    src:      "/img/fish/bangus.png",
    alt:      "Whole bangus (milkfish)",
    eyebrow:  "Chanos chanos",
    title:    "Bangus (Milkfish)",
    facts: [
      { label: "Bone count",  value: "~196–209 total bones" },
      { label: "Muscle type", value: "Pelagic · mid-spectrum dark muscle" },
      { label: "Edible yield", value: "~60% of whole weight" },
      { label: "Difficulty",  value: "Advanced — four distinct bone zones" },
    ],
    body:
      "Bangus is notoriously bony, which is why many consumers — especially children — avoid " +
      "it whole. Deboning removes approximately 196–209 bones distributed across four anatomical " +
      "zones, significantly widening market acceptability and enabling higher-value processed products " +
      "like rellenong bangus and daing na bangus.",
  },
  butterflied: {
    src:      "/img/fish/butterflied1.png",
    alt:      "Butterflied bangus",
    eyebrow:  "Dorsal Butterfly Method",
    title:    "Butterflied Bangus",
    facts: [
      { label: "Split side",   value: "Dorsal (back) — belly skin kept intact" },
      { label: "Result",       value: "Flat butterfly fillet, skin-side down" },
      { label: "Next steps",   value: "Rib → dorsal → ventral → lateral bone removal" },
      { label: "In simulator", value: "Models this exact open-flat form" },
    ],
    body:
      "The dorsal butterfly split is the standard Philippine commercial approach. The fish is " +
      "opened along the back rather than the belly, keeping the belly skin intact and producing " +
      "a clean flat fillet. This gives the processor full access to all four bone zones without " +
      "separating the two fillets — making sequential zone-by-zone extraction possible in one " +
      "continuous workflow. The 3D simulator models this exact form.",
  },
};

// ─── Level → CSS modifier map for skill cards ─────────────────────────────────
const SKILL_LEVEL_MOD = {
  Critical:  "dg-skill-level--critical",
  Essential: "dg-skill-level--essential",
  Important: "dg-skill-level--important",
};

// =============================================================================
// DeboningGuide
// Props:
//   onBack            — () => void : navigates back to the learning hub
//   onStartSimulation — () => void : launches the bangus deboning simulator
// =============================================================================
const DeboningGuide = ({ onBack, onStartSimulation }) => {
  const [showSkillsModal, setShowSkillsModal] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [imageModal, setImageModal] = useState(null); // 'whole' | 'butterflied' | null
  const activeStepData = STEP_DEFINITIONS.find(s => s.id === activeStep);
  const navigate = useNavigate();

  // ── Skills Modal ──────────────────────────────────────────────────────────
  // Overlay listing the six skills required for bangus deboning and how the
  // simulator develops them progressively.
  const SkillsModal = () => (
    <div
      className="dg-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) setShowSkillsModal(false); }}
    >
      <div className="dg-panel">
        {/* Header */}
        <div className="dg-panel-header">
          <div>
            <div className="dg-panel-title">Essential Deboning <span className="it">Skills</span></div>
            <div className="dg-panel-sub">Master these for successful bangus processing</div>
          </div>
          <button
            className="dg-panel-close"
            onClick={() => setShowSkillsModal(false)}
            aria-label="Close skills modal"
          >
            ×
          </button>
        </div>

        <div className="dg-panel-body">
          {/* Intro copy */}
          <div className="dg-section">
            <p>
              Bangus deboning requires a unique combination of physical coordination, anatomical
              knowledge, and technique. CvSUHimay develops these skills progressively through
              structured practice and immediate FSM-driven feedback — from a single bone zone
              at a time up to the full sequential workflow.
            </p>
          </div>

          {/* Skill cards — 2-column grid matching design system gap pattern */}
          <div className="dg-skill-grid">
            {REQUIRED_SKILLS.map((skill) => (
              <div key={skill.title} className="dg-skill-card">
                <div className="dg-skill-card-top">
                  <span className="dg-skill-name">{skill.title}</span>
                  <span className={`dg-skill-level ${SKILL_LEVEL_MOD[skill.level]}`}>
                    {skill.level}
                  </span>
                </div>
                <p className="dg-skill-desc">{skill.description}</p>
              </div>
            ))}
          </div>

          {/* How CvSUHimay helps */}
          <div className="dg-how-box">
            <div className="dg-how-label">How CvSUHimay develops these skills</div>
            <div className="dg-how-list">
              {[
                ["Zone-by-Zone Progression",  "Practice each of the four bone zones in sequence — ribs → dorsal → ventral → lateral — before combining them into a full run"],
                ["Safe Practice Environment",  "Build confidence without risk of injury, fish wastage, or contamination"],
                ["Immediate Feedback",         "The FSM detects wrong cut paths, excess flesh damage, and missed bones in real time"],
                ["Unlimited Repetition",       "Reset and repeat any step or the full session as many times as needed"],
              ].map(([title, desc]) => (
                <div key={title} className="dg-how-item">
                  <span className="dg-how-check">✓</span>
                  <span><strong>{title}:</strong> {desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="dg-panel-footer">
          <button className="dg-practice-btn" onClick={() => setShowSkillsModal(false)}>
            Got it
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Image Modal ───────────────────────────────────────────────────────────
  const ImageModal = () => {
    const data = IMAGE_MODALS[imageModal];
    if (!data) return null;
    return (
      <div
        className="dg-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) setImageModal(null); }}
      >
        <div className="dg-img-modal-panel">
          {/* Header */}
          <div className="dg-panel-header">
            <div>
              <div className="dg-panel-title">{data.title}</div>
              <div className="dg-panel-sub">{data.eyebrow}</div>
            </div>
            <button
              className="dg-panel-close"
              onClick={() => setImageModal(null)}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          <div className="dg-img-modal-body">
            {/* Large image */}
            <div className="dg-img-modal-img-wrap">
              <img src={data.src} alt={data.alt} className="dg-img-modal-img" />
            </div>

            {/* Quick facts grid */}
            <div className="dg-fact-grid">
              {data.facts.map(({ label, value }) => (
                <div key={label} className="dg-fact-cell">
                  <span className="dg-fact-cell-label">{label}</span>
                  <span className="dg-fact-cell-val">{value}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="dg-section">
              <p>{data.body}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Detail view is now a dedicated page: DeboningGuideFull

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-full">
      <div className="px-8 lg:px-10 py-8 lg:py-10">
        {/* ── Page header — matches .sim-ph / .quiz-ph / .mod-ph pattern ── */}
        <div className="dg-ph">
        <div>
          <h1 className="dg-ph-title">
            Bangus <span className="it">Deboning</span> Guide
          </h1>
          <p className="dg-ph-sub">
            Complete reference for the milkfish dorsal butterfly method — the only species in CvSUHimay's scope
          </p>
        </div>
        <div className="dg-ph-actions">
          <button
            className="dg-ghost-btn dg-ghost-btn--green"
            onClick={() => setShowSkillsModal(true)}
          >
            Required Skills
          </button>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="dg-body">

        {/* ── Hero card — flat bordered, matches .sim-hero ── */}
        <div className="dg-hero">

          {/* Top: eyebrow + title + primary CTA button */}
          <div className="dg-hero-top">
            <div>
              <div className="dg-hero-eyebrow">
                {/* Bangus-specific context label */}
                BANGUS · MILKFISH
                <span className="target-pill">TARGET SPECIES</span>
              </div>
              <h2>
                <span className="it">Chanos chanos</span> Deboning
              </h2>
              {/* Difficulty inline tag under title */}
              <div className="dg-difficulty">
                <span className="dg-difficulty-dot" aria-hidden="true" />
                {BANGUS.difficulty}
              </div>
            </div>
            {/* Primary CTA — goes straight to simulator */}
            <button
              className="dg-hero-cta"
              onClick={() => onStartSimulation?.()}
            >
              Start Practice
              <ArrowRight size={14} />
            </button>
          </div>

          {/* Description */}
          <p className="dg-hero-desc">{BANGUS.description}</p>

          {/* ── Procedure roadmap — interactive step flow ── */}
          <div className="dg-flow">
            <div className="dg-flow-top">
              <span className="dg-flow-label">Procedure Roadmap</span>
              <span className="dg-flow-badge">{STEP_DEFINITIONS.length} Steps</span>
            </div>
            <div className="dg-flow-rail-wrap">
              <div className="dg-flow-rail">
                {STEP_DEFINITIONS.flatMap((step, i) => {
                  const node = (
                    <button
                      key={`n-${step.id}`}
                      className={`dg-flow-step${activeStep === step.id ? ' active' : ''}`}
                      onMouseEnter={() => setActiveStep(step.id)}
                      onClick={() => setActiveStep(step.id)}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="dg-flow-dot">
                        <span className="dg-flow-num">{String(step.id).padStart(2, '0')}</span>
                      </div>
                      <span className="dg-flow-short">{step.shortTitle}</span>
                    </button>
                  );
                  if (i === STEP_DEFINITIONS.length - 1) return [node];
                  return [
                    node,
                    <div
                      key={`c-${step.id}`}
                      className="dg-flow-conn"
                      style={{ animationDelay: `${i * 40 + 20}ms` }}
                    />,
                  ];
                })}
              </div>
            </div>
            <div className="dg-flow-detail" key={activeStep}>
              <div className="dg-flow-detail-icon">{activeStepData.icon}</div>
              <div className="dg-flow-detail-meta">
                <span className="dg-flow-detail-eyebrow">
                  Step {activeStepData.id} of {STEP_DEFINITIONS.length}
                </span>
                <span className="dg-flow-detail-name">{activeStepData.title}</span>
              </div>
              <div className="dg-flow-detail-right">
                <span className="dg-flow-detail-score-val">
                  {activeStepData.scoreWeight === 0 ? '—' : activeStepData.scoreWeight}
                </span>
                <span className="dg-flow-detail-score-label">
                  {activeStepData.scoreWeight === 0 ? 'transition' : 'score pts'}
                </span>
              </div>
            </div>
          </div>

          {/* Pro tip callout — left-bordered, gold accent */}
          <div className="dg-tip">
            <div className="dg-tip-label">Pro tip</div>
            <p>{BANGUS.tips}</p>
          </div>

          {/* Footer: View Full Guide (secondary) + Start Practice (primary) */}
          <div className="dg-hero-footer">
            <button
              className="dg-guide-btn"
              onClick={() => navigate('/student/deboning-guide/full')}
            >
              View Full Guide
              <ArrowRight size={13} />
            </button>
            <button
              className="dg-practice-btn"
              onClick={() => onStartSimulation?.()}
            >
              Start Practice
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Model disclaimer — real photo + note about the 3D model ─── */}
        <div className="dg-model-note">

          {/* Full-width header explaining the section */}
          <div className="dg-model-note-header">
            <div>
              <div className="dg-model-note-header-label">
                <Info size={14} />
                Disclaimer about the 3D Simulator
              </div>
              <div className="dg-model-note-header-sub">
                Reference photos of the actual fish. Click either image to learn more.
              </div>
            </div>
          </div>

          {/* Left panel: whole fish */}
          <div className="dg-model-note-panel dg-model-note-panel--left">
            <button
              className="dg-model-note-img-btn"
              onClick={() => setImageModal('whole')}
              aria-label="Enlarge whole bangus photo"
            >
              <img src="/img/fish/bangus.png" alt="Whole bangus (milkfish)" className="dg-model-note-img" />
            </button>
            <div className="dg-model-note-detail">
              <div className="dg-model-note-detail-eyebrow">Whole · Chanos chanos</div>
              <div className="dg-model-note-detail-title">Visuals are simplified.</div>
              <p className="dg-model-note-detail-body">
                The 3D model won't look exactly like this — fin shape, texture, and
                proportions are approximated so it runs smoothly on any school computer.
              </p>
            </div>
          </div>

          {/* Right panel: butterflied fish */}
          <div className="dg-model-note-panel dg-model-note-panel--right">
            <button
              className="dg-model-note-img-btn"
              onClick={() => setImageModal('butterflied')}
              aria-label="Enlarge butterflied bangus photo"
            >
              <img src="/img/fish/butterflied1.png" alt="Butterflied bangus" className="dg-model-note-img" />
            </button>
            <div className="dg-model-note-detail">
              <div className="dg-model-note-detail-eyebrow">Butterflied · Dorsal split</div>
              <div className="dg-model-note-detail-title">The procedure is accurate.</div>
              <p className="dg-model-note-detail-body">
                Every step, bone location, and tool interaction follows the actual FASD
                deboning curriculum. Focus on the process, not the visuals.
              </p>
            </div>
          </div>

        </div>

        {/* ── Scope note — communicates bangus-only limitation to students ── */}
        <div className="dg-scope-note">
          <Info size={14} />
          <span>
            CvSUHimay is scoped to bangus (milkfish) deboning. The 3D simulation, FSM logic,
            and all learning materials cover this species only, as outlined in the thesis scope and limitation.
          </span>
        </div>

      </div>
    </div>

    {/* ── Modals ── */}
    {showSkillsModal && <SkillsModal />}
    {imageModal     && <ImageModal />}
  </div>
  );
};

export default DeboningGuide;