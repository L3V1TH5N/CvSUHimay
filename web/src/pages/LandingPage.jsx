// file path: web/src/pages/LandingPage.jsx

import { useContext, useRef } from "react";
import { Link } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { ArrowUpRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* ── SectionLabel — numbered section header ───────────────────────────── */
function SectionLabel({ num, label }) {
  return (
    <div className="flex items-center gap-3 mb-10 text-[11px] uppercase tracking-[0.2em] ink-faint">
      <span className="ink font-semibold text-[12px]">{num}</span>
      <span className="w-8 h-px bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TOOL SVGs — minimal line-art, stroke-only, aria-hidden (decorative).
   currentColor inherits from the parent's color property so opacity/
   color is controlled entirely by the wrapper div's inline style.
══════════════════════════════════════════════════════════════════════════ */

/* Cutting board — handle nub at top, board body, three wood-grain lines */
function SvgCuttingBoard() {
  return (
    <svg
      width="72" height="90" viewBox="0 0 72 90"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="26" y="4" width="20" height="15" rx="3" />
      <rect x="6" y="17" width="60" height="68" rx="5" />
      <line x1="18" y1="34" x2="54" y2="34" />
      <line x1="18" y1="50" x2="54" y2="50" />
      <line x1="18" y1="66" x2="54" y2="66" />
    </svg>
  );
}

/* Bowl — elliptical rim, curved walls, inner base arc for depth */
function SvgBowl() {
  return (
    <svg
      width="88" height="60" viewBox="0 0 88 60"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="44" cy="16" rx="40" ry="12" />
      <path d="M4 16 C4 46 84 46 84 16" />
      <path d="M20 43 C20 50 68 50 68 43" />
    </svg>
  );
}

/* Knife — tapered blade tip-up, bolster block, riveted handle */
function SvgKnife() {
  return (
    <svg
      width="28" height="110" viewBox="0 0 28 110"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 5 C19 5 22 18 23 44 L14 48 L5 44 C6 18 9 5 14 5Z" />
      <rect x="7" y="48" width="14" height="5" rx="1.5" />
      <rect x="8" y="53" width="12" height="52" rx="4" />
      <circle cx="14" cy="66" r="1.5" />
      <circle cx="14" cy="80" r="1.5" />
      <circle cx="14" cy="94" r="1.5" />
    </svg>
  );
}

/* Scissors — two handle rings, crossing blades, pivot dot at crossing */
function SvgScissors() {
  return (
    <svg
      width="62" height="90" viewBox="0 0 62 90"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="16" cy="74" rx="13" ry="12" />
      <ellipse cx="46" cy="74" rx="13" ry="12" />
      <path d="M16 62 L30 40 L26 8" />
      <path d="M46 62 L32 40 L36 8" />
      {/* Filled pivot dot — small visual anchor at the blade crossing */}
      <circle cx="31" cy="44" r="2.5" fill="currentColor" />
    </svg>
  );
}

/* Forceps — two converging arms, locking band, handle loops at base */
function SvgForceps() {
  return (
    <svg
      width="30" height="106" viewBox="0 0 30 106"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5 C12 22 7 48 4 100" />
      <path d="M15 5 C18 22 23 48 26 100" />
      <path d="M6 72 C10 70 20 70 24 72" />
      <path d="M4 100 C2 104 6 106 6 102" />
      <path d="M26 100 C28 104 24 106 24 102" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════════════════════ */

/*
  ALTERNATE HERO HEADLINES — pick one, comment the rest:
  ─────────────────────────────────────────────────────
  WITTY:
    "The fish doesn't grade on a curve. You should practice."
    "Practice on the one that can't swim away."
    "Zero bones missed. Zero fish harmed."

  DIRECT:
    "Every bone has a name. Learn them here."
    "Built for the bench. Used before it."
    "Forty minutes in the sim. Seconds in the lab."

  URGENT:
    "Lab day is coming. Cut it here first."
    "Your instructor only demos it once."

  CONFIRMED (currently used):
    "The bangus won't wait. Neither should your practice."
*/

const LandingPage = () => {
  const { user } = useContext(AppContext);

  // Route CTA to the correct dashboard based on role
  const dashboardPath =
    user?.role === "admin"
      ? "/admin/dashboard"
      : user?.role === "instructor"
      ? "/instructor/dashboard"
      : "/student/dashboard";

  const ctaPath  = user ? dashboardPath : "/get-started";
  const ctaLabel = user ? "Open dashboard" : "Start practising";

  const heroRef = useRef(null);
  const mainRef = useRef(null);

  /* ── Hero entrance + tool float ──────────────────────────────────────── */
  useGSAP(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: () => {
        // After entrance: infinite float on tools, staggered so each
        // tool is never at the same vertical position simultaneously.
        gsap.to(".hero-tool", {
          y: -11,
          duration: 3.5,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          stagger: { each: 0.7, from: "start" },
        });
      },
    });

    tl.from(".hero-trust",  { opacity: 0, y: 10, duration: 0.45 })
      .from(".hero-h-word",  { opacity: 0, y: 36, duration: 0.80, stagger: 0.08 }, "-=0.2")
      // scaleX from center because the rule is centered, not left-anchored
      .from(".hero-rule",    { scaleX: 0, transformOrigin: "center", duration: 0.75 }, "-=0.45")
      .from(".hero-sub",     { opacity: 0, y: 14, duration: 0.55 }, "-=0.4")
      .from(".hero-cta",     { opacity: 0, y: 12, duration: 0.45 }, "-=0.3")
      // Tools stagger in last — they're the decoration layer, not the focus
      .from(".hero-tool",    { opacity: 0, y: 18, duration: 0.60, stagger: 0.10 }, "-=0.15");
  }, { scope: heroRef });

  /* ── Scroll reveals for below-fold sections ──────────────────────────── */
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
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      });
    });

    // Re-run after fonts load — HelveticaNowDisplay shifts layout on load,
    // which can miscalculate ScrollTrigger positions if measured before the font swap.
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts?.ready) document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => window.removeEventListener("load", refresh);
  }, { scope: mainRef });

  return (
    <div ref={mainRef} className="paper">
      <Navbar />

      {/* ════════════════════════════════════════════════════════════════
          HERO
          ─────────────────────────────────────────────────────────────
          Centered layout — all text on a single axis.
          section is position:relative so tool SVGs can be placed
          absolute within the container without affecting scroll height.
          Tools only render at lg+ — at smaller widths there's no gutter.
      ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative w-full pt-20 lg:pt-28 pb-24 lg:pb-32"
      >
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
          style={{ opacity: 0.04 }}
        >
          <defs>
            <pattern id="lp-fish-scale" x="0" y="0" width="20" height="15" patternUnits="userSpaceOnUse">
              <path d="M 0 15 Q 10 5 20 15"       fill="none" stroke="currentColor" strokeWidth="1"/>
              <path d="M -10 7.5 Q 0 -2.5 10 7.5" fill="none" stroke="currentColor" strokeWidth="1"/>
              <path d="M 10 7.5 Q 20 -2.5 30 7.5" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-fish-scale)"/>
        </svg>

        {/* Constrained inner wrapper — tools + content stay within 1280px */}
        <div className="relative max-w-[1280px] mx-auto px-6 lg:px-10">

          {/* ── Tool decoration layer ────────────────────────────────────
              All tools start at opacity: 0; GSAP's .from() drives the
              entrance. Do NOT set Tailwind opacity-0 here — it conflicts
              with GSAP's inline style and the tools stay invisible.
              The color rgba value sets both hue and opacity in one place. */}

          {/* LEFT — cutting board: upper-left, counter-clockwise tilt */}
          <div
            className="hero-tool hidden lg:block absolute"
            style={{ left: "3%", top: "12%", transform: "rotate(-10deg)", color: "rgba(120,120,120,0.22)" }}
          >
            <SvgCuttingBoard />
          </div>

          {/* LEFT — bowl: lower-left, slight clockwise tilt */}
          <div
            className="hero-tool hidden lg:block absolute"
            style={{ left: "4%", bottom: "14%", transform: "rotate(6deg)", color: "rgba(120,120,120,0.22)" }}
          >
            <SvgBowl />
          </div>

          {/* RIGHT — knife: upper-right, clockwise tilt, tip upward */}
          <div
            className="hero-tool hidden lg:block absolute"
            style={{ right: "4%", top: "8%", transform: "rotate(14deg)", color: "rgba(120,120,120,0.22)" }}
          >
            <SvgKnife />
          </div>

          {/* RIGHT — scissors: mid-right, counter-clockwise tilt */}
          <div
            className="hero-tool hidden lg:block absolute"
            style={{ right: "1.5%", top: "44%", transform: "rotate(-7deg)", color: "rgba(120,120,120,0.22)" }}
          >
            <SvgScissors />
          </div>

          {/* RIGHT — forceps: lower-right, moderate clockwise tilt */}
          <div
            className="hero-tool hidden lg:block absolute"
            style={{ right: "9%", bottom: "8%", transform: "rotate(9deg)", color: "rgba(120,120,120,0.22)" }}
          >
            <SvgForceps />
          </div>

          {/* ── Centered content column ──────────────────────────────────
              z-10 keeps text above the absolutely-positioned tool layer.  */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-[780px] mx-auto">

            {/* Institution trust badge */}
            <div className="hero-trust flex items-center gap-3 mb-10">
              <img
                src="/img/cvsu_logo.png"
                alt="Cavite State University"
                className="w-6 h-6 object-contain opacity-80 flex-shrink-0"
              />
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] ink-faint">
                <span className="ink font-medium">Cavite State University</span>
                <span className="opacity-40">·</span>
                <span>Fisheries &amp; Aquatic Sciences</span>
              </div>
            </div>

            {/* Hero headline — font-outfit upright for lines 1 and 2.
                Line 2 uses font-outfit-italic + display-accent so the
                accent phrase is italic green, matching the HowItWorks pattern. */}
            <h1 className="font-outfit ink leading-[0.95] text-[clamp(52px,8.5vw,107px)] mb-8">
              <span className="hero-h-word inline-block">Master the</span>
              <br />
              <span className="hero-h-word inline-block font-outfit-italic display-accent">
                art of deboning.
              </span>
            </h1>

            {/* Divider — GSAP scales from center */}
            <div className="hero-rule h-px bg-current opacity-15 mb-9 w-full max-w-[340px]" style={{ color: "var(--color-fg)" }} />

            {/* Subtext */}
            <p className="hero-sub max-w-[500px] text-[16.5px] leading-[1.8] ink-muted mb-10">
              Rehearse every cut, every bone, every step — in a simulation
              designed for the CvSU Naic curriculum.
            </p>

            {/* CTAs */}
            <div className="hero-cta flex flex-wrap justify-center items-center gap-x-7 gap-y-4">
              {/* Primary — green fill, warm off-white text (defined in index.css .primary-cta) */}
              <Link to={ctaPath} className="primary-cta group">
                {ctaLabel}
                <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>

              {!user && (
                <Link
                  to="/signin"
                  className="text-[12px] uppercase tracking-[0.18em] font-medium ink-muted link-accent border-b border-current pb-1"
                >
                  Returning student — sign in
                </Link>
              )}
            </div>

          </div>
        </div>{/* end constrained inner wrapper */}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          01 — WHAT IS CVSU HIMAY?
          ─────────────────────────────────────────────────────────────
          "Forty minutes." headline stays as instructed.
          "The only deboning simulator built for CvSU." placed here as
          a closing institutional badge — it's a claim, not a headline.
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="01" label="What is CvSUHimay?" />

          <div className="grid lg:grid-cols-12 gap-10 items-start">

            {/* Left — display headline.
                Accent phrases use font-outfit-italic + display-accent,
                matching the italic green pattern used on HowItWorks. */}
            <div className="lg:col-span-7">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(34px,4.6vw,60px)] leading-[1.02] mb-7">
                <span className="font-outfit-italic display-accent">Forty minutes.</span>{" "}
                One instructor, one student. Everything,{" "}
                <span className="font-outfit-italic display-accent">one fish.</span>
              </h2>
              <div className="gsap-reveal h-px opacity-15 max-w-[240px]" style={{ backgroundColor: "var(--color-fg)" }} />
            </div>

            {/* Right — body + institutional claim badge */}
            <div className="lg:col-span-5 lg:pt-3">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted mb-5">
                Deboning bangus is taught hands-on at the Fisheries and Aquatic
                Sciences Department of CvSU – Naic Campus. A single instructor
                demonstration takes the better part of an hour. Lab slots are
                limited. Students who miss the demo don't get to see it again.
              </p>
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted mb-8">
                CvSUHimay doesn't replace the bench — it prepares you for it. A{" "}
                <span className="ink font-medium">Mealy-type Finite State Machine</span>{" "}
                drives every step of the simulation, enforcing the correct
                sequence and catching deviations the moment they happen. You
                arrive at lab day already knowing what to do with your hands.
              </p>

              {/* Institutional claim — placed here where the argument has just been made */}
              <div className="gsap-reveal inline-flex items-center gap-3 px-4 py-3 border hairline">
                {/* Small green dot — acts as a "verified" signal without being loud */}
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--color-accent)" }} />
                <span className="text-[11px] uppercase tracking-[0.18em] ink-muted">
                  The only deboning simulator built for CvSU.
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          02 — KEY FEATURES
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="02" label="Key features" />

          <div className="grid lg:grid-cols-12 gap-10 mb-14">
            <div className="lg:col-span-5">
              {/* Section heading — upright font-outfit with italic accent phrase */}
              <h2 className="gsap-reveal font-outfit ink text-[clamp(36px,4.6vw,60px)] leading-[1.0]">
                Everything you need<br />
                <span className="font-outfit-italic display-accent">to get the cut right.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-4">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted">
                Every feature maps directly to the FASD curriculum — the modules,
                quizzes, and simulation steps reflect what your instructor
                evaluates in the wet lab. Nothing is invented for the sake of it.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-x-10 gap-y-10">
            {[
              {
                n: "01",
                title: "3D Interactive Simulation",
                body: "Manipulate a virtual bangus using virtual knife, scissors, and forceps. Every gesture is checked against the step's spatial tolerance map — wrong paths are flagged frame by frame.",
                tag: "Core · Three.js",
              },
              {
                n: "02",
                title: "Learning Modules",
                body: "Text guides, instructor-recorded video demonstrations, and slide decks authored by CvSU Naic FASD — each resource is contextually linked to the exact FSM step it covers.",
                tag: "Content · FASD-authored",
              },
              {
                n: "03",
                title: "Quizzes & Assessments",
                body: "Knowledge checks appear at key procedure steps before you can proceed. Results are logged to your session record and surfaced on the instructor's review screen.",
                tag: "Assessment · Step-linked",
              },
              {
                n: "04",
                title: "Real-time FSM Feedback",
                body: "Wrong cut path, excess flesh removal, or a missed bone — the system classifies the error the moment it happens and tells you exactly what to correct before the next step unlocks.",
                tag: "Feedback · Mealy FSM",
              },
              {
                n: "05",
                title: "Session Analytics",
                body: "Time spent per step, total errors by class, accuracy rate, and improvement trends across repeated sessions — all in your personal dashboard and your instructor's review screen.",
                tag: "Analytics · Dashboard",
              },
              {
                n: "06",
                title: "Achievements & Badges",
                body: "Earn milestones as you improve — first clean run, zero missed bones, fastest session in the cohort. Your record carries across every session you complete.",
                tag: "Gamification · Milestones",
              },
            ].map((f) => (
              <article key={f.n} className="gsap-reveal pt-6 border-t hairline">
                <div className="text-[10px] uppercase tracking-[0.22em] ink-faint mb-5">
                  {f.n}
                </div>
                {/* Card titles — font-outfit at a smaller display scale;
                    no italic accent needed here since the whole title is a noun phrase */}
                <h3 className="font-outfit ink text-[26px] leading-[1.1] mb-4">
                  {f.title}
                </h3>
                <p className="text-[15.5px] leading-[1.75] ink-muted mb-6 max-w-md">
                  {f.body}
                </p>
                <div className="text-[10px] uppercase tracking-[0.18em] ink-faint">
                  {f.tag}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          03 — BEGIN (CTA)
          ─────────────────────────────────────────────────────────────
          "The lab starts here." — section eyebrow / subheading.
          "No fish were harmed in making you better at this." — footnote
          below the CTA buttons. Witty, disarming, memorable.
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-24 pb-28 text-center">

          {/* Section label */}
          <div className="flex items-center justify-center gap-3 mb-10
            text-[11px] uppercase tracking-[0.22em] ink-faint">
            <span className="ink font-semibold text-[12px]">03</span>
            <span className="w-8 h-px bg-current opacity-40" />
            <span>Begin</span>
          </div>

          {/* "The lab starts here." — used as the sub-eyebrow, not the headline.
              It's direct and confident; it earns the space above the giant "Begin." */}
          <p className="gsap-reveal text-[12px] uppercase tracking-[0.22em] display-accent font-medium mb-6">
            The lab starts here.
          </p>

          {/* Giant display headline — the period is a punctuation accent, not
              an italic word, so display-accent only (no font-outfit-italic). */}
          <h2 className="gsap-reveal font-outfit ink
            text-[clamp(56px,9vw,112px)] leading-[0.93] mb-6">
            Begin<span className="display-accent">.</span>
          </h2>

          <p className="gsap-reveal ink-muted text-[16.5px] leading-[1.75]
            max-w-[400px] mx-auto mb-10">
            Your first session takes about two minutes from sign-up to first cut.
          </p>

          {/* CTAs — primary green, secondary text link */}
          <div className="gsap-reveal flex flex-wrap justify-center items-center gap-x-8 gap-y-4 mb-8">
            <Link to={ctaPath} className="primary-cta group">
              {ctaLabel}
              <ArrowUpRight className="w-4 h-4 transition-transform duration-300
                group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <Link
              to="/how-it-works"
              className="text-[12px] uppercase tracking-[0.18em] font-medium
                ink-muted link-accent border-b border-current pb-1"
            >
              Read the procedure first
            </Link>
          </div>

          {/* Witty footnote — the tension-release that makes the CTA section
              memorable. Placed BELOW the buttons so it doesn't undercut
              the conversion intent, but lingers after the eye has already
              hit the CTA. */}
          <p className="gsap-reveal text-[12px] ink-faint leading-relaxed">
            No fish were harmed in making you better at this.
          </p>

          <div className="gsap-reveal mt-6 text-[11px] uppercase tracking-[0.22em] ink-faint">
            No install · Browser only
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default LandingPage;