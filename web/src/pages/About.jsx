// file path: web/src/pages/About.jsx

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Info } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

function SectionLabel({ num, label, center = false }) {
  return (
    <div className={`flex items-center gap-3 mb-10 text-[11px] uppercase tracking-[0.22em] ink-faint ${center ? "justify-center" : ""}`}>
      <span className="ink font-semibold text-[12px]">{num}</span>
      <span className="w-8 h-px bg-current opacity-40" />
      <span>{label}</span>
    </div>
  );
}

const developers = [
  { name: "JhonLorence A. Hilario",     role: "3D Modeler",             photo: "Elers.png" },
  { name: "Gavriell C. Pangan",          role: "3D Simulation Developer", photo: "Gav.png"   },
  { name: "Franklin Gian G. Sarmiento",  role: "Full Stack Developer",    photo: "Gian.png"  },
];

const advisers = [
  { name: "Dr. Michelle C. Tanega, DIT", role: "Thesis Adviser", photo: "mich.jpg"  },
  { name: "Mr. Gillian Kyle D. Catahan", role: "Thesis Critic",  photo: "kyle.jpg"  },
];

const IMAGE_MODALS = {
  whole: {
    src:     "/img/fish/bangus.png",
    alt:     "Whole bangus (milkfish)",
    eyebrow: "Chanos chanos",
    title:   "Bangus (Milkfish)",
    facts: [
      { label: "Bone count",   value: "~196–209 total bones" },
      { label: "Muscle type",  value: "Pelagic · mid-spectrum dark muscle" },
      { label: "Edible yield", value: "~60% of whole weight" },
      { label: "Difficulty",   value: "Advanced — four distinct bone zones" },
    ],
    body:
      "Bangus is notoriously bony, which is why many consumers — especially children — avoid " +
      "it whole. Deboning removes approximately 196–209 bones distributed across four anatomical " +
      "zones, significantly widening market acceptability and enabling higher-value processed products " +
      "like rellenong bangus and daing na bangus.",
  },
  butterflied: {
    src:     "/img/fish/butterflied1.png",
    alt:     "Butterflied bangus",
    eyebrow: "Dorsal Butterfly Method",
    title:   "Butterflied Bangus",
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

const About = () => {
  const heroRef = useRef(null);
  const mainRef = useRef(null);

  useGSAP(() => {
    const reduced = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.55 })
      .from(".hero-h-word",  { opacity: 0, y: 36, duration: 0.85, stagger: 0.06 }, "-=0.2")
      .from(".hero-rule",    { scaleX: 0, transformOrigin: "0 50%", duration: 0.8 }, "-=0.5")
      .from(".hero-sub",     { opacity: 0, y: 14, duration: 0.55 }, "-=0.45")
      .from(".hero-back",    { opacity: 0, y: 12, duration: 0.5 }, "-=0.35");
  }, { scope: heroRef });

  useGSAP(() => {
    const root = mainRef.current;
    if (!root) return;
    const reduced = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = gsap.utils.toArray(root.querySelectorAll(".gsap-reveal"));
    if (reduced) { gsap.set(els, { opacity: 1, y: 0 }); return; }
    gsap.set(els, { opacity: 0, y: 24 });
    els.forEach(el => {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 0.75, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", toggleActions: "play none none none" },
      });
    });
  }, { scope: mainRef });

  useEffect(() => {
    let alive = true;
    const refresh = () => { if (alive) ScrollTrigger.refresh(); };
    if (document.fonts?.ready) document.fonts.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => { alive = false; window.removeEventListener("load", refresh); };
  }, []);

  return (
    <div ref={mainRef} className="paper">
      <Navbar />

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative max-w-[1280px] mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-16 lg:pb-20"
      >
        <div className="hero-eyebrow flex flex-wrap items-center gap-3 mb-8 text-[11px] uppercase tracking-[0.22em] ink-muted">
          <span className="display-accent font-medium">About</span>
          <span className="w-8 h-px bg-current opacity-30" />
          <span>CvSUHimay</span>
          <span className="w-8 h-px bg-current opacity-30" />
          <span>CvSU Naic</span>
        </div>

        <h1 className="font-outfit ink leading-[0.98] text-[clamp(48px,7.4vw,96px)] mb-7 tracking-tight max-w-[900px]">
          <span className="hero-h-word inline-block mr-[0.18em]">Built for</span>
          <span className="hero-h-word inline-block mr-[0.18em]">the bench.</span>
          <br />
          <span className="hero-h-word inline-block font-outfit-italic display-accent">Explained here.</span>
        </h1>

        <div className="hero-rule h-px bg-current ink opacity-25 mb-7 max-w-[420px]" />

        <p className="hero-sub max-w-[600px] text-[16.5px] leading-[1.8] ink-muted mb-9">
          Everything about what CvSUHimay is, why it exists, and the people who built it.
        </p>

        <div className="hero-back">
          <Link to="/" className="text-[12px] uppercase tracking-[0.18em] font-medium ink-muted link-accent border-b border-current pb-1">
            ← Back to home
          </Link>
        </div>
      </section>

      {/* ── 01 WHAT IS CVSUHIMAY ──────────────────────────────────────────── */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="01" label="What is CvSUHimay?" />
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(34px,4.6vw,60px)] leading-[1.02]">
                <span className="font-outfit-italic display-accent">One simulator.</span><br />
                Six steps. All the bones.
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-3">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted mb-5">
                CvSUHimay is a browser-based, 3D interactive simulator that guides Fisheries students
                through the complete bangus deboning procedure. Built specifically for the Fisheries
                and Aquatic Sciences Department at Cavite State University – Naic Campus.
              </p>
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted mb-8">
                It does not replace hands-on lab work — it prepares students for it. A{" "}
                <span className="ink font-medium">Mealy-type Finite State Machine</span>{" "}
                drives every step of the simulation, enforcing the correct sequence and catching
                deviations the moment they happen.
              </p>
              <div className="gsap-reveal inline-flex items-center gap-3 px-4 py-3 border hairline">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--color-accent)" }} />
                <span className="text-[11px] uppercase tracking-[0.18em] ink-muted">
                  The only deboning simulator built for CvSU.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 WHY IT EXISTS ──────────────────────────────────────────────── */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="02" label="Why it exists" />
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(34px,4.6vw,60px)] leading-[1.02]">
                <span className="font-outfit-italic display-accent">Forty minutes.</span><br />
                One instructor. One student.
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-3">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted mb-5">
                Deboning bangus is taught hands-on at FASD. A single instructor demonstration takes
                the better part of an hour. Lab slots are limited. Students who miss the demo don't
                get to see it again.
              </p>
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted mb-7">
                CvSUHimay was built to solve exactly this — a reproducible, on-demand procedural
                rehearsal available any time before lab day. It captures every session as an
                append-only event stream, so instructors can review where each student struggled
                after the fact.
              </p>
              <div className="gsap-reveal flex flex-wrap gap-3">
                {["Fisheries Students", "Instructors", "FASD Department"].map(label => (
                  <span key={label} className="inline-flex items-center gap-2 px-3 py-1.5 border hairline text-[10px] uppercase tracking-[0.18em] ink-muted">
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--color-accent)" }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 EDUCATIONAL OBJECTIVES ─────────────────────────────────────── */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="03" label="Educational objectives" />
          <div className="grid lg:grid-cols-12 gap-10 mb-14 items-start">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(34px,4.6vw,60px)] leading-[1.02]">
                What it is<br />
                <span className="font-outfit-italic display-accent">designed to do.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-3">
              <p className="gsap-reveal text-[16.5px] leading-[1.8] ink-muted">
                Developed as a thesis project at CvSU Naic to address a specific gap in practical
                fish processing training. These are its four core objectives.
              </p>
            </div>
          </div>
          <ol className="divide-y hairline border-t hairline">
            {[
              [
                "Provide a self-paced simulation of the complete bangus deboning procedure.",
                "Students can rehearse the full procedure as many times as needed — no instructor present, no live specimen required.",
              ],
              [
                "Deliver real-time FSM-driven feedback at each procedural step.",
                "Every gesture is validated against the step's spatial tolerance map. Wrong cuts, excess removal, and missed bones are detected and classified the moment they occur.",
              ],
              [
                "Generate per-session analytics for instructor review.",
                "Time per step, error counts by class, accuracy rate, and bone extraction completeness — all surfaced on the instructor's analytics dashboard after each session.",
              ],
              [
                "Complement — not replace — the hands-on training at CvSU Naic.",
                "The simulator is a rehearsal tool. Students who practice here arrive at lab day knowing the procedure.",
              ],
            ].map(([title, body], i) => (
              <li key={i} className="gsap-reveal py-7 grid lg:grid-cols-12 gap-x-10 gap-y-3">
                <div className="lg:col-span-1 text-[10px] uppercase tracking-[0.24em] ink-faint pt-2">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="lg:col-span-11">
                  <h3 className="font-outfit ink text-[22px] leading-[1.12] mb-3 tracking-tight">{title}</h3>
                  <p className="text-[15.5px] leading-[1.8] ink-muted max-w-2xl">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 04 DISCLAIMER ─────────────────────────────────────────────────── */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-20 lg:pb-24">
          <SectionLabel num="04" label="About the 3D model" />
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(34px,4.6vw,60px)] leading-[1.02]">
                Optimized for<br />
                <span className="font-outfit-italic display-accent">learning.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7 lg:pt-3">
              <div className="gsap-reveal border hairline p-6 lg:p-8">
                <div className="text-[10px] uppercase tracking-[0.22em] ink-faint mb-5">
                  Simulation Disclaimer
                </div>
                <p className="text-[15.5px] leading-[1.85] ink-muted">
                  The 3D bangus model used in this simulation has been geometrically simplified and
                  optimized for real-time browser performance on standard student hardware. Visual
                  details — including surface texture, fin shape, and skeletal proportions — are
                  approximations intended to support procedural learning, not to replicate the
                  photorealistic appearance of a live milkfish.
                </p>
                <p className="text-[15.5px] leading-[1.85] ink-muted mt-4">
                  All anatomical landmarks relevant to the deboning procedure (dorsal surface,
                  lateral line, rib cage region, visceral cavity) are accurately represented in
                  their relative positions. The educational value of the simulation lies in
                  procedural sequence, spatial reasoning, and error feedback — not in visual
                  fidelity.
                </p>
              </div>
            </div>
          </div>

          {/* Reference photos */}
          <div className="gsap-reveal mt-14 border hairline">
            {/* Header bar */}
            <div className="flex items-center gap-2.5 px-6 py-4 border-b hairline">
              <Info size={13} className="ink-faint flex-shrink-0" />
              <span className="text-[10px] uppercase tracking-[0.2em] ink-faint">
                Disclaimer about the 3D Simulator
              </span>
              <span className="ml-auto text-[10px] ink-faint opacity-60 hidden sm:block">
                Reference photos of the actual fish
              </span>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x hairline">

              {[IMAGE_MODALS.whole, IMAGE_MODALS.butterflied].map((data) => (
                <div key={data.title} className="p-6 lg:p-8">
                  {/* Image */}
                  <div className="border hairline bg-black/[0.03] overflow-hidden mb-5">
                    <img
                      src={data.src}
                      alt={data.alt}
                      className="w-full h-52 object-contain"
                    />
                  </div>
                  {/* Eyebrow + title */}
                  <div className="text-[9px] uppercase tracking-[0.2em] ink-faint mb-2">{data.eyebrow}</div>
                  <div className="font-outfit ink text-[15px] leading-[1.2] mb-4 font-medium">{data.title}</div>
                  {/* Facts grid */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {data.facts.map(({ label, value }) => (
                      <div key={label} className="border hairline p-2.5">
                        <div className="text-[9px] uppercase tracking-[0.18em] ink-faint mb-1">{label}</div>
                        <div className="text-[12px] ink font-medium leading-snug">{value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Description */}
                  <p className="text-[13.5px] leading-[1.75] ink-muted">{data.body}</p>
                </div>
              ))}

            </div>
          </div>

        </div>
      </section>

      {/* ── 05 THE TEAM ───────────────────────────────────────────────────── */}
      <section className="border-t hairline">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 lg:pt-24 pb-24 lg:pb-32">
          <SectionLabel num="05" label="The team" />

          <div className="grid lg:grid-cols-12 gap-10 mb-16 items-end">
            <div className="lg:col-span-5">
              <h2 className="gsap-reveal font-outfit ink text-[clamp(34px,4.6vw,60px)] leading-[1.02]">
                The people<br />
                <span className="font-outfit-italic display-accent">behind it.</span>
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <p className="gsap-reveal text-[15.5px] leading-[1.8] ink-muted">
                Developed as a thesis requirement for the Bachelor of Science in Computer Science
                program at Cavite State University – Naic Campus, December 2025.
              </p>
            </div>
          </div>

          {/* Developer cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-14">
            {developers.map(({ name, role, photo }) => (
              <div key={name} className="gsap-reveal pt-6 border-t hairline text-center">
                <img
                  src={`/img/dev/${photo}`}
                  alt={name}
                  className="w-24 h-24 rounded-full mx-auto mb-5 object-cover"
                />
                <h3 className="font-outfit ink text-[18px] leading-[1.2] mb-1.5">{name}</h3>
                <div className="text-[10px] uppercase tracking-[0.2em] ink-faint mb-1">{role}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] ink-faint opacity-60">
                  BS Computer Science · CvSU Naic · 2025
                </div>
              </div>
              
            ))}
          </div>

          {/* Academic supervision */}
          <div className="border-t hairline pt-10">
            <div className="text-[10px] uppercase tracking-[0.22em] ink-faint mb-8">
              Academic Supervision
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {advisers.map(({ name, role, photo }) => (
                <div key={name} className="gsap-reveal flex items-center gap-5 py-4 border-t hairline">
                  <img
                    src={`/img/dev/${photo}`}
                    alt={name}
                    className="w-14 h-14 rounded-full flex-shrink-0 object-cover"
                  />
                  <div>
                    <div className="font-outfit ink text-[17px] leading-[1.2] mb-0.5">{name}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] ink-faint">{role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />

    </div>
  );
};

export default About;
