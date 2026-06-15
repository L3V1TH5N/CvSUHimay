// file path: web/src/pages/HowItWorks.jsx

import { useContext, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ArrowUpRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

/* Section label — numeric + tracked uppercase, matches LandingPage rhythm. */
function SectionLabel({ num, label, center = false }) {
  return (
    <div
      className={`flex items-center gap-3 mb-10 text-[11px] uppercase tracking-[0.22em] ink-faint ${
        center ? "justify-center" : ""
      }`}
    >
      <span className="ink font-semibold text-[12px]">{num}</span>
      <span className="w-8 h-px bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

const HowItWorks = () => {
  const { user } = useContext(AppContext);

  const dashboardPath =
    user?.role === "admin"      ? "/admin/dashboard"      :
    user?.role === "instructor" ? "/instructor/dashboard" :
                                  "/student/dashboard";

  const ctaPath  = user ? dashboardPath : "/get-started";
  const ctaLabel = user ? "Open dashboard" : "Enter the simulator";

  const heroRef = useRef(null);
  const mainRef = useRef(null);

  /* Hero entrance */
  useGSAP(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.55 })
      .from(".hero-h-word",  { opacity: 0, y: 36, duration: 0.85, stagger: 0.06 }, "-=0.2")
      .from(".hero-rule",    { scaleX: 0, transformOrigin: "0 50%", duration: 0.8 }, "-=0.5")
      .from(".hero-sub",     { opacity: 0, y: 14, duration: 0.55 }, "-=0.45")
      .from(".hero-back",    { opacity: 0, y: 12, duration: 0.5 }, "-=0.35");
  }, { scope: heroRef });

  /* Below-fold reveals */
  useGSAP(() => {
    const root = mainRef.current;
    if (!root) return;
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const els = gsap.utils.toArray(root.querySelectorAll(".gsap-reveal"));
    if (reduced) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }
    gsap.set(els, { opacity: 0, y: 24 });
    els.forEach((el) => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.75, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
      });
    });
  }, { scope: mainRef });

  /* ScrollTrigger refresh on font/asset load — kept in a plain effect with
     a mounted flag so a late-resolving promise can't poke a torn-down tree. */
  useEffect(() => {
    let alive = true;
    const refresh = () => { if (alive) ScrollTrigger.refresh(); };
    if (document.fonts?.ready) document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => {
      alive = false;
      window.removeEventListener("load", refresh);
    };
  }, []);

  /* ── Source data ───────────────────────────────────────────────────── */

  const procedure = [
    {
      n: "00",
      title: "Wash the fish.",
      body: "Hygiene pre-step added at CvSU before any cut is made — a quick rinse with the bangus laid skin-down on the cutting board. The simulator opens here so the student gets used to the tray layout before the first knife motion.",
      tools: "Cutting board · running water",
    },
    {
      n: "01",
      title: "Trim the fins.",
      body: "Cut around the base of the dorsal, pelvic, and pectoral fins, then pull each fin forward to extract its embedded ray bones. The anal fin comes out the same way. Done correctly, no fin bone is left behind in the flesh.",
      tools: "Knife · forceps",
    },
    {
      n: "02",
      title: "Split down the dorsal side.",
      body: "Lay the fish on its side and run the knife from the tail toward the head along the backbone, opening the body like a butterfly. The gills and viscera are removed in the same motion — alimentary canal, organs, and urogenital tract.",
      tools: "Knife · bowl",
    },
    {
      n: "03",
      title: "Remove the backbone.",
      body: "Lay the butterflied fish flat on its skin. With the knife held horizontally, separate the vertebral column from the flesh in one continuous pass. The flesh stays attached to the skin; the spine lifts free.",
      tools: "Knife · cutting board",
    },
    {
      n: "04",
      title: "Pull the rib bones.",
      body: "Working on a shallow tray, use forceps to extract each rib bone from the dorsal-muscle dent. A superficial slit is made along the dent first. The intermuscular spines — the Y-shaped bones along the lateral line — are pulled from head toward tail, one by one.",
      tools: "Forceps · shallow tray",
    },
    {
      n: "05",
      title: "Remove the ventral spines.",
      body: "The same method applies to the ventral spines and the filamentous Y-shaped spines along the lateral line. This is the hardest sub-skill of the procedure — the entire reason the deboning course exists — and the simulator gates progression here until extraction is clean.",
      tools: "Forceps",
    },
    {
      n: "06",
      title: "Wash, pack, freeze.",
      body: "A final rinse, packed flat in a sealed plastic bag, into the freezer. The simulator closes the session here and writes the report — time per step, error counts by class, and any bones that were missed.",
      tools: "Plastic bag · freezer",
    },
  ];

  const anatomy = [
    ["Myotomes",                    "The muscle layers — the edible flakes a cooked fish breaks into."],
    ["Myocommata",                  "The connective sheets that sit between myotomes."],
    ["Lateral line",                "The dark midline that runs head-to-tail; the landmark for finding the Y-bones."],
    ["Intermuscular spines (Y-bones)","Y-shaped bones along the lateral line — the central learning outcome of this course."],
    ["Backbone (vertebrae)",        "The spinal column. Removed in step 03."],
    ["Viscera",                     "The alimentary canal, internal organs, and urogenital system. Removed in step 02."],
    ["Dorsal · anal · caudal fins", "Surface fins extracted in step 01 along with their embedded ray bones."],
    ["Edible portion",              "About 60% of whole weight in a bony fish like bangus."],
  ];

  const errorClasses = [
    {
      n: "01",
      title: "The cut wandered.",
      body1: "Triggered when your gesture leaves the step's tolerated region or angle. The simulator checks the path frame-by-frame against a tolerance map specific to that step — not a general 'close enough' threshold.",
      body2: "The deviating segment is highlighted in red on the mesh while you cut. You retry the same step before the next one unlocks. In the instructor's report, this appears as a wrong-path event with a timestamp and the segment that drifted.",
      tag: "Highlight · retry",
    },
    {
      n: "02",
      title: "The cut took too much.",
      body1: "Triggered when the material removed exceeds the step's allowed extent — for example, when a knife motion meant to skim the dorsal surface dips deep into the flesh below.",
      body2: "The over-cut area is shown in negative on the mesh — a visible boundary outlining where the cut crossed the line. There's no penalty maths and no score deduction; the boundary is the feedback. The instructor's report logs the over-cut region and which step produced it.",
      tag: "Boundary overlay",
    },
    {
      n: "03",
      title: "A bone was left behind.",
      body1: "Detected at the end of the session, not mid-flow — because that is when an instructor catching it on a real fish would notice. The simulator inventories every bone the procedure required against the bones you actually removed.",
      body2: "Omitted bones stay rendered on the mesh in your end-of-session report, grouped by the step they belonged to. The instructor sees the same view: which bones, which step, repeated across the cohort.",
      tag: "End-of-session report",
    },
  ];

  const scope = [
    ["Bangus only.",            "Anatomy, tool affordances, and the procedure are tuned to milkfish. None of it transfers to other species."],
    ["No physics simulation.",  "Cuts render through deterministic mesh-state transitions, not soft-body physics. A deliberate trade-off for hardware on campus."],
    ["Desktop only.",           "The simulator expects a mouse and keyboard for cut and drag gestures. A phone screen cannot drive it."],
    ["Rule-based feedback.",    "Errors are detected against pre-defined tolerances. The simulator does not infer your strategy or personalize to your skill level."],
    ["CvSU-Naic curriculum.",   "Step content, tolerances, and remediation links are tied to one campus's curriculum. Off-campus use requires content updates."],
    ["Quantitative analytics.", "Reports capture time, errors, and access counts. They do not capture decision-making."],
  ];

  return (
    <div ref={mainRef} className="paper">
      <Navbar />

      {/* ════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative max-w-[1280px] mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-16 lg:pb-20"
      >
        <div className="hero-eyebrow flex flex-wrap items-center gap-3 mb-8 text-[11px] uppercase tracking-[0.22em] ink-muted">
          <span className="display-accent font-medium">Procedure</span>
          <span className="w-8 h-px bg-current opacity-30" />
          <span>How it works</span>
          <span className="w-8 h-px bg-current opacity-30" />
          <span>Bangus</span>
        </div>

        {/* Hero headline — font-outfit upright for "Read it once,",
            font-outfit-italic + display-accent for the italic green "then practice." */}
        <h1 className="font-outfit ink leading-[0.98] text-[clamp(48px,7.4vw,96px)] mb-7 tracking-tight max-w-[1000px]">
          <span className="hero-h-word inline-block mr-[0.18em]">Read</span>
          <span className="hero-h-word inline-block mr-[0.18em]">it</span>
          <span className="hero-h-word inline-block">once,</span>
          <br />
          <span className="hero-h-word inline-block mr-[0.18em] font-outfit-italic display-accent">then</span>
          <span className="hero-h-word inline-block font-outfit-italic display-accent">practice.</span>
        </h1>

        <div className="hero-rule h-px bg-current ink opacity-25 mb-7 max-w-[420px]" />

        <p className="hero-sub max-w-[640px] text-[16.5px] leading-[1.8] ink-muted mb-9">
          The text companion to the simulator — the procedure you will rehearse,
          the anatomy you should recognize, the feedback the simulator gives at
          each step, and an honest accounting of what it does not do. Read this
          once, then go practice.
        </p>

        <div className="hero-back">
          <Link
            to="/"
            className="text-[12px] uppercase tracking-[0.18em] font-medium ink-muted link-accent border-b border-current pb-1"
          >
            ← Back to home
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          01 — THE PROCEDURE
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="01" label="The procedure" />

          <div className="grid lg:grid-cols-12 gap-10 mb-14 items-start">
            <div className="lg:col-span-5">
              {/* Section heading — font-outfit upright + font-outfit-italic
                  for the brand-green accent phrase "One Fish." */}
              <h2 className="gsap-reveal font-outfit ink text-[clamp(36px,4.6vw,60px)] leading-[1.02] tracking-tight">
                Six steps.<br />
                <span className="font-outfit-italic display-accent">One Fish.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-4">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted">
                The procedure follows the textbook milkfish method as taught by
                the Department of Fisheries &amp; Aquatic Sciences at CvSU
                Naic. One pre-step for hygiene is added at the front; the rest
                is the canonical sequence.
              </p>
            </div>
          </div>

          <ol className="divide-y hairline border-t hairline">
            {procedure.map((s) => (
              <li key={s.n} className="gsap-reveal py-7 grid lg:grid-cols-12 gap-x-10 gap-y-3">
                <div className="lg:col-span-2 text-[10px] uppercase tracking-[0.24em] ink-faint pt-2">
                  {s.n === "00" ? "Pre-step" : `Step ${s.n}`}
                </div>
                <div className="lg:col-span-10">
                  {/* Step titles — font-outfit at a smaller display scale */}
                  <h3 className="font-outfit ink text-[26px] leading-[1.12] mb-3 tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-[16px] leading-[1.8] ink-muted mb-5 max-w-2xl">
                    {s.body}
                  </p>
                  <div className="text-[10px] uppercase tracking-[0.2em] ink-faint">
                    Tools — {s.tools}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          {/* Citation footnote — font-outfit-italic for the inline italicised
              author reference, consistent with how accent italics work elsewhere */}
          <p className="gsap-reveal mt-10 text-[10px] uppercase tracking-[0.22em] ink-faint max-w-2xl">
            Procedure follows the textbook milkfish method
            (<span className="normal-case tracking-normal text-[12px] font-outfit-italic ink-muted">Espejo-Hermes, 1998</span>),
            as taught by FASD at Naic.
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          02 — ANATOMY
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="02" label="Anatomy" />

          <div className="grid lg:grid-cols-12 gap-10 mb-12 items-start">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(36px,4.6vw,60px)] leading-[1.02] tracking-tight">
                The parts that<br />
                <span className="font-outfit-italic display-accent">matter.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-4">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted">
                A short glossary of the anatomy the simulator surfaces. Most of
                these are landmarks the student needs to recognize visually
                before the cut — the rest are what gets removed and why.
              </p>
            </div>
          </div>

          <ul className="divide-y hairline border-t hairline">
            {anatomy.map(([term, def]) => (
              <li
                key={term}
                className="gsap-reveal flex flex-wrap items-baseline gap-x-8 gap-y-2 py-5"
              >
                {/* Anatomy terms use font-outfit — same display scale as h3 cards */}
                <span className="font-outfit ink text-[20px] tracking-tight flex-shrink-0 min-w-[220px]">
                  {term}
                </span>
                <span className="text-[15.5px] leading-[1.7] ink-muted flex-1 max-w-2xl">
                  {def}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          03 — FEEDBACK
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="03" label="Feedback" />

          <div className="grid lg:grid-cols-12 gap-10 mb-14">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(36px,4.6vw,60px)] leading-[1.02] tracking-tight">
                Three ways<br />
                <span className="font-outfit-italic display-accent">to be wrong.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-4">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted">
                The simulator catches mistakes in three classes. Each class has
                its own moment of detection, its own feedback in the viewport,
                and its own line in the instructor's report. The category — not
                a score — is what the curriculum cares about.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-x-10 gap-y-12">
            {errorClasses.map((c) => (
              <article key={c.n} className="gsap-reveal pt-6 border-t hairline">
                <div className="text-[10px] uppercase tracking-[0.24em] ink-faint mb-5">
                  {c.n}
                </div>
                <h3 className="font-outfit ink text-[26px] leading-[1.12] mb-4 tracking-tight">
                  {c.title}
                </h3>
                <p className="text-[15.5px] leading-[1.75] ink-muted mb-4 max-w-md">
                  {c.body1}
                </p>
                <p className="text-[15.5px] leading-[1.75] ink-muted mb-6 max-w-md">
                  {c.body2}
                </p>
                <div className="text-[10px] uppercase tracking-[0.2em] ink-faint">
                  {c.tag}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          04 — HONEST SCOPE
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="04" label="Honest scope" />

          <div className="grid lg:grid-cols-12 gap-10 mb-12 items-start">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(36px,4.6vw,60px)] leading-[1.02] tracking-tight">
                What it<br />
                <span className="font-outfit-italic display-accent">does not do.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-4">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted">
                Each item below is a deliberate trade-off, not an apology. The
                simulator was scoped narrowly so it could be reliable on the
                hardware available to students at Naic. If you arrive expecting
                a general fish-processing tool, the list will save you time.
              </p>
            </div>
          </div>

          <ul className="divide-y hairline border-t hairline">
            {scope.map(([title, body]) => (
              <li
                key={title}
                className="gsap-reveal py-5 grid lg:grid-cols-12 gap-x-10 gap-y-2 items-baseline"
              >
                <div className="lg:col-span-4">
                  {/* Scope item titles — font-outfit at list-item scale */}
                  <span className="font-outfit ink text-[20px] tracking-tight">
                    {title}
                  </span>
                </div>
                <div className="lg:col-span-8">
                  <p className="text-[15.5px] leading-[1.75] ink-muted max-w-xl">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          05 — BEGIN
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-24 text-center">
          <SectionLabel num="05" label="Begin" center />

          <h2 className="gsap-reveal font-outfit ink text-[clamp(40px,6vw,72px)] leading-[1.0] tracking-tight mb-6">
            Ready when<br />
            <span className="font-outfit-italic display-accent">you are.</span>
          </h2>

          <p className="gsap-reveal ink-muted text-[16.5px] leading-[1.7] max-w-md mx-auto mb-10">
            Your first session takes about two minutes from sign-up to first cut.
          </p>

          <div className="gsap-reveal flex flex-wrap justify-center items-center gap-x-8 gap-y-4">
            <Link to={ctaPath} className="primary-cta group">
              {ctaLabel}
              <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <Link
              to="/"
              className="text-[12px] uppercase tracking-[0.18em] font-medium ink-muted link-accent border-b border-current pb-1"
            >
              ← Back to home
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default HowItWorks;