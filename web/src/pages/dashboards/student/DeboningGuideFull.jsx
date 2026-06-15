import './learning/ModuleReader.css';
import './DeboningGuideFull.css';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import bangusVideo from '../../../assets/videos/Bangus Deboning (Final).mp4';

const GUIDE = {
  id: 'deboning-guide',
  title: 'Bangus Deboning Guide',
  subtitle: 'Full reference for the milkfish dorsal butterfly method',
  difficulty: 'Advanced',
  timeEstimate: '20–30 min (beginner) · 8–12 min (expert)',
  description:
    "Bangus (milkfish, Chanos chanos) is the Philippines' national fish and the primary training species for CvSUHimay. " +
    'This guide covers species background, bone zone anatomy, required tools, the step-by-step dorsal butterfly procedure, safety, and common product applications.',
  sections: [
    { id: 'overview', label: 'Overview' },
    { id: 'video', label: 'Video Reference' },
    { id: 'bone-zones', label: 'Bone Zones' },
    { id: 'materials', label: 'Materials & Equipment' },
    { id: 'procedure', label: 'Procedure' },
    { id: 'learning-objectives', label: 'Learning Objectives' },
    { id: 'safety', label: 'Safety' },
    { id: 'practical-use', label: 'Practical Use' },
  ],
};

const SECTION_CONTENT = {
  overview: (
    <div className="gf-prose">
      <p>
        Bangus (<em>Chanos chanos</em>), commonly known as milkfish, is the Philippines' national fish and one of the
        most commercially important species in Southeast Asian aquaculture. It is a pelagic, schooling fish
        recognized by its streamlined silver body, forked tail, and absence of teeth.
      </p>
      <p>
        Milkfish is a <strong>spiny fish</strong> — it contains an unusually high number of intermuscular bones and
        Y-shaped spines that run through the flesh. This is the primary reason why many consumers, especially
        children, avoid eating it whole. Deboning removes these bones, significantly improving the fish's
        acceptability to a wider market and enabling higher-value processed products.
      </p>
      <p>
        The <strong>dorsal butterfly method</strong> is the standard Philippine commercial approach to milkfish
        deboning. The fish is split along the dorsal (back) side rather than the belly, which keeps the belly
        skin intact and produces a clean, flat butterfly fillet. This guide covers the full procedure based on
        Guevara <em>et al.</em> (1973) as cited in Espejo-Hermes (1998).
      </p>
    </div>
  ),

  video: (
    <>
      <p className="gf-intro">
        Watch a full run-through of the dorsal butterfly method before attempting the simulator.
        Pay close attention to knife angle during the dorsal split and forceps grip position during bone extraction.
      </p>
      <div className="gf-video-wrap">
        <video controls preload="metadata" src={bangusVideo} />
        <p className="gf-video-caption">
          Full bangus deboning demonstration — dorsal butterfly method.
          Source: CvSU-Naic Fisheries and Aquatic Sciences Department.
        </p>
      </div>
    </>
  ),

  'bone-zones': (
    <>
      <p className="gf-intro">
        Milkfish contains four distinct bone zones. Each requires a different extraction technique and tool
        approach. Mastering all four is the core skill of this course.
      </p>
      <div className="gf-zone-grid">
        {[
          { index: '01', name: 'Dorsal Intermuscular', desc: 'Fine spines embedded in the dorsal muscle, running from head to tail along the upper back. Extracted by making a superficial slit along the dorsal muscle dent and pulling with forceps.' },
          { index: '02', name: 'Rib Bones', desc: 'Curved bones lining the inner wall of the body cavity. Exposed after the backbone is removed and pulled out individually using forceps from a shallow tray position.' },
          { index: '03', name: 'Ventral Intermuscular', desc: 'Spines embedded in the belly-side muscle, below the lateral line. Removed the same way as dorsal spines — superficial slit then forceps pull, head to tail.' },
          { index: '04', name: 'Lateral Y-Spines', desc: "Filamentous, Y-shaped spines running along the lateral line (the visible dark stripe on the fish's side). These are the hardest to remove — they are fine, numerous, and deeply embedded." },
        ].map(({ index, name, desc }) => (
          <div key={index} className="gf-zone-card">
            <span className="gf-zone-index">{index}</span>
            <span className="gf-zone-name">{name}</span>
            <span className="gf-zone-desc">{desc}</span>
          </div>
        ))}
      </div>
    </>
  ),

  materials: (
    <>
      <p className="gf-intro">
        Prepare all tools and surfaces before starting. Keeping the fish cold throughout processing is
        critical for food safety and flesh integrity.
      </p>
      <div className="gf-materials">
        {[
          { name: 'Deboning knife',      desc: 'Sharp, thin, and flexible — essential for the dorsal split. A dull knife tears flesh and makes clean cuts impossible.' },
          { name: 'Forceps / tweezers', desc: 'Used to grip and pull individual bones and spines. Grip close to the base of each bone to avoid snapping it mid-extraction.' },
          { name: 'Cutting board',       desc: 'Stable, non-slip surface large enough to lay the fish fully open. Keep it cold and clean.' },
          { name: 'Shallow tray',        desc: 'Used when pulling rib bones and intermuscular spines — the flat, open surface gives you better visibility and control.' },
          { name: 'Basin / bowl',        desc: 'For washing the fish before and after deboning. Use cold, clean water throughout.' },
          { name: 'Plastic bag',         desc: 'For packaging the finished boneless fish before freezing.' },
          { name: 'Freezer / cold storage', desc: 'Store the deboned fish immediately after packaging to maintain quality and safety.' },
        ].map(({ name, desc }) => (
          <div key={name} className="gf-material-item">
            <span className="gf-material-name">{name}</span>
            <span className="gf-material-desc">{desc}</span>
          </div>
        ))}
      </div>
    </>
  ),

  procedure: (
    <>
      <p className="gf-intro">
        Follow these steps in order. Based on Guevara <em>et al.</em> (1973) as cited in Espejo-Hermes (1998).
        Do not skip or reorder steps — the sequence is designed to minimize bone breakage and flesh damage.
      </p>
      <ol className="gf-steps">
        {[
          { title: 'Trim fins and remove the anal fin.', body: 'The fish may or may not be scaled. Trim all fins. For the anal fin, make a small cut around the base of the fin, then pull it forward — this extracts the fin bones and associated nuisance bones cleanly in one motion.' },
          { title: 'Wash the fish.', body: 'Rinse thoroughly with cold, clean water. Keep the fish cold throughout the entire process to maintain flesh firmness and prevent bacterial growth.' },
          { title: 'Dorsal split — open like a butterfly.', body: 'Place the fish belly-down. Split along the dorsal (back) side from tail to head. Turn the knife flat and run the blade edge along the backbone, extending the cut from tail all the way to the head. Open the fish flat — it should lie open like a butterfly fillet.' },
          { title: 'Remove gills and internal organs.', body: 'With the fish open, pull out the gills and all viscera (alimentary canal and associated organs). Rinse the body cavity thoroughly with cold water.' },
          { title: 'Remove the rib bone and dorsal intermuscular spines.', body: 'Place the open fish flat on a shallow tray. Use forceps to pull out each rib bone individually. Then make a superficial slit along the dent of the dorsal muscle and pull out the intermuscular spines embedded between the muscle layers, working from head to tail.' },
          { title: 'Remove ventral spines and lateral Y-spines.', body: 'Remove the ventral intermuscular spines using the same slit-and-pull technique. Then extract the filamentous Y-shaped spines running along the lateral line. These are the finest and most numerous — work slowly and check by feel after each pass.' },
          { title: 'Final wash, inspect, and freeze.', body: 'Wash the deboned fish with cold water. Run your fingertips over both sides of the flesh to feel for any remaining bone fragments. Once satisfied, pack in a plastic bag and freeze immediately.' },
        ].map(({ title, body }, i) => (
          <li key={i} className="gf-step">
            <span className="gf-step-num">{i + 1}</span>
            <div className="gf-step-content">
              <div className="gf-step-title">{title}</div>
              <div className="gf-step-body">{body}</div>
            </div>
          </li>
        ))}
      </ol>
    </>
  ),

  'learning-objectives': (
    <ul className="gf-list">
      {[
        'Identify the four anatomical bone zones in milkfish and their characteristic spine types.',
        'Name the tools required and explain the purpose of each in the deboning process.',
        'Execute the dorsal butterfly split without cutting through the belly skin.',
        'Extract rib bones, dorsal intermuscular spines, ventral spines, and lateral Y-spines with forceps.',
        'Perform a systematic tactile quality check before packaging to detect missed bone fragments.',
      ].map((text, i) => (
        <li key={i} className="gf-list-item">
          <span className="gf-list-marker">{i + 1}</span>
          <span className="gf-list-text">{text}</span>
        </li>
      ))}
    </ul>
  ),

  safety: (
    <ul className="gf-list">
      {[
        'Always use a sharp knife — a dull blade requires more force and increases the risk of slipping.',
        'Cut away from your hands and body at all times; keep fingers curled away from the blade path.',
        'Grip forceps close to the bone base before pulling — gripping at the tip risks snapping the spine and leaving a fragment in the flesh.',
        'Work on a stable, non-slip cutting board. If the board slides, place a damp cloth underneath it.',
        'Keep the fish and all surfaces cold throughout processing. Warm flesh is softer and tears more easily; it also spoils faster.',
        'Do not rush spine extraction. A broken spine embedded in the flesh is a food safety hazard and much harder to locate and remove.',
      ].map((text, i) => (
        <li key={i} className="gf-list-item">
          <span className="gf-list-marker gf-list-marker--warn">!</span>
          <span className="gf-list-text">{text}</span>
        </li>
      ))}
    </ul>
  ),

  'practical-use': (
    <>
      <p className="gf-intro">
        Deboned bangus is the base for several high-value Filipino fish products. Mastery of the procedure
        directly enables production of these market forms:
      </p>
      <div className="gf-use-list">
        {[
          { name: 'Boneless bangus',        desc: 'Sold fresh or frozen in markets; the direct output of this procedure. Wider consumer reach due to absence of bones.' },
          { name: 'Rellenong bangus',        desc: 'Stuffed milkfish — the deboned fish is stuffed with a seasoned meat mixture and then fried or baked.' },
          { name: 'Daing na bangus',         desc: 'Marinated deboned bangus, dried and typically pan-fried. A staple breakfast dish in the Philippines.' },
          { name: 'Smoked bangus (tinapa)', desc: 'Deboned bangus cured through smoking. The absence of bones makes it easier to eat and more marketable.' },
          { name: 'Bangus belly',            desc: 'The fattiest and most prized cut, taken from the belly portion of the deboned butterfly fillet. Sold fresh or frozen.' },
        ].map(({ name, desc }) => (
          <div key={name} className="gf-use-item">
            <span className="gf-use-name">{name}</span>
            <span className="gf-use-desc">{desc}</span>
          </div>
        ))}
      </div>
    </>
  ),
};

const DeboningGuideFull = () => {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const headerRef = useRef(null);
  const lastScrollY = useRef(0);

  const [activeSection, setActiveSection] = useState(GUIDE.sections[0].id);
  const [tocSheetOpen, setTocSheetOpen] = useState(false);

  useEffect(() => { const prior = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prior; }; }, []);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => {
      const { scrollTop } = el;
      const delta = scrollTop - lastScrollY.current;
      lastScrollY.current = scrollTop;
      if (headerRef.current) {
        if (scrollTop > 10 && delta > 0) headerRef.current.classList.add('reader-header--hidden');
        else headerRef.current.classList.remove('reader-header--hidden');
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!contentRef.current || !scrollRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.getAttribute('data-section-id');
        if (!id) return;
        if (entry.isIntersecting) setActiveSection(id);
      });
    }, { root: scrollRef.current, rootMargin: '0px 0px -40% 0px', threshold: 0 });

    const els = contentRef.current.querySelectorAll('[data-section-id]');
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    if (!contentRef.current || !scrollRef.current) return;
    const el = contentRef.current.querySelector(`[data-section-id="${id}"]`);
    if (!el) return;
    const containerTop = scrollRef.current.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    const offset = elTop - containerTop + scrollRef.current.scrollTop - 80;
    scrollRef.current.scrollTo({ top: offset, behavior: 'smooth' });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 bg-[color:var(--color-bg)] flex flex-col">

      <header ref={headerRef} className="reader-header">
        <button onClick={() => navigate(-1)} className="reader-back">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--color-hairline)' }} />

        <span className="reader-header-title">{GUIDE.title}</span>

        <div style={{ width: 1, height: 16, background: 'var(--color-hairline)' }} />

        <div className="reader-header-controls">
          <button onClick={() => setTocSheetOpen(true)} className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ background: 'var(--color-surface-2)', color: 'var(--color-fg-muted)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
            Contents
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="reader-main">
        <div className="reader-layout">

          <aside className="reader-sidebar">
            <div className="reader-sidebar-head">
              <span className="reader-sidebar-label">Contents</span>
            </div>
            {GUIDE.sections.map((s, i) => {
              const isActive = activeSection === s.id;
              return (
                <button key={s.id} className={`reader-sidebar-row${isActive ? ' reader-sidebar-row--active' : ''}`} onClick={() => scrollToSection(s.id)}>
                  <span className="reader-sidebar-indicator">
                    <span className="reader-sidebar-num">{i + 1}</span>
                  </span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </aside>

          <div className="reader-column">
            <div className="reader-mod-header">
              <div className="reader-mod-eyebrow">GUIDE · BANGUS</div>
              <h1 className="reader-mod-title">{GUIDE.title}</h1>
              <div className="reader-mod-tags">
                <span className="reader-mod-tag">{GUIDE.difficulty}</span>
                <span className="reader-mod-tag"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 10 }} />{GUIDE.timeEstimate}</span></span>
              </div>
              <p className="reader-mod-desc">{GUIDE.subtitle}</p>
            </div>

            <div ref={contentRef} className="reader-article select-text">
              {GUIDE.sections.map((s) => (
                <section key={s.id} id={s.id} data-section-id={s.id}>
                  <h2 className="gf-section-h2">{s.label}</h2>
                  {SECTION_CONTENT[s.id]}
                </section>
              ))}
            </div>

            <div className="reader-bottom">
              <div className="reader-nav-grid">
                <button onClick={() => navigate('/student/modules')} className="reader-nav-prev">
                  <div className="reader-nav-label"><ArrowLeft size={12} /> Back</div>
                  <p className="reader-nav-title">Back to Modules</p>
                </button>

                <button onClick={() => navigate('/student/simulator')} className="reader-nav-next">
                  <div className="reader-nav-label">Start Practice <ArrowRight size={12} /></div>
                  <p className="reader-nav-title">Open Simulator</p>
                </button>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Mobile TOC bottom sheet */}
      {tocSheetOpen && (
        <>
          <div className="fixed inset-0 z-[70] lg:hidden" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setTocSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[80] lg:hidden flex flex-col" style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-hairline)', borderRadius: '16px 16px 0 0', maxHeight: '70vh', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-hairline)', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-fg-subtle)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: 6 }}>Contents</span>
              <button onClick={() => setTocSheetOpen(false)} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-fg-muted)', lineHeight: 0, borderRadius: 8 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: 12 }}>
              {GUIDE.sections.map((s, i) => (
                <button key={s.id} onClick={() => { scrollToSection(s.id); setTocSheetOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: activeSection === s.id ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent', color: activeSection === s.id ? 'var(--color-accent)' : 'var(--color-fg-muted)', fontWeight: activeSection === s.id ? 600 : 400, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', lineHeight: 1.4 }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 20, height: 20, borderRadius: '50%', border: `1px solid ${activeSection === s.id ? 'var(--color-accent)' : 'var(--color-hairline)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: activeSection === s.id ? 'var(--color-accent)' : 'var(--color-fg-subtle)' }}>{i + 1}</span></span>
                  <span style={{ lineHeight: 1.4 }}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

    </div>,
    document.body
  );
};

export default DeboningGuideFull;
