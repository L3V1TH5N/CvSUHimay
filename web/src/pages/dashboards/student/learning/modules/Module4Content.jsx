// File path: web/src/pages/dashboards/student/modules/Module4Content.jsx

// ─── Reusable primitives ──────────────────────────────────────────────────────
const Section = ({ id, children }) => (
  <section id={id} className="mb-10 scroll-mt-24">{children}</section>
);

const Callout = ({ children }) => (
  <div className="border-l-2 border-[#04510e] dark:border-green-500 pl-4 py-1 my-5 bg-[#04510e]/4 dark:bg-[#04510e]/10 rounded-r-lg">
    {children}
  </div>
);

const InfoCard = ({ label, children }) => (
  <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
    {label && <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-1.5">{label}</p>}
    {children}
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0">
    <span className="text-sm text-gray-500 dark:text-zinc-400">{label}</span>
    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 text-right">{value}</span>
  </div>
);

const Bullet = ({ children }) => (
  <li className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#04510e] dark:bg-green-500 flex-shrink-0" />
    <span>{children}</span>
  </li>
);

const H2 = ({ children }) => (
  <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-3 mt-0">{children}</h2>
);
const H3 = ({ children }) => (
  <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-2 mt-5">{children}</h3>
);

const Step = ({ num, title, children }) => (
  <div className="flex gap-4 items-start">
    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#04510e] dark:bg-green-600 flex items-center justify-center mt-0.5">
      <span className="text-xs font-bold text-white">{num}</span>
    </div>
    <div className="flex-1">
      <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-1">{title}</p>
      <div className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">{children}</div>
    </div>
  </div>
);

// ─── Module 4 ────────────────────────────────────────────────────────────────
const Module4Content = () => (
  <div className="space-y-0">

    {/* Intro */}
    <Section id="species-intro">
      <H2>1. Species-Specific Deboning Techniques</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Different fish species have unique bone structures that require specialized deboning
        approaches. This module focuses on the most common species in the Philippines: Milkfish
        (Bangus) and Tilapia, each presenting distinct challenges and techniques.
      </p>

      <InfoCard label="Learning Objectives">
        <ul className="space-y-1.5 mt-1">
          {[
            "Master the specialized technique of deboning milkfish (bangus)",
            "Understand the unique bone structure of different species",
            "Apply proper handling techniques for each fish type",
            "Achieve professional quality standards in deboned products",
          ].map((item) => <Bullet key={item}>{item}</Bullet>)}
        </ul>
      </InfoCard>
    </Section>

    {/* Bangus Intro */}
    <Section id="bangus-intro">
      <H2>2. Boneless Milkfish (Bangus)</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Milkfish is usually sold in the "wet" market and supermarket fresh and frozen in the round
        (whole) or semi-processed (split or deboned). Milkfish is a spiny or bony fish, and this
        is one of the reasons why people, especially children, object to eating this fish.
      </p>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Why Debone Bangus?</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-2">
          Deboning or removal of bones is done to improve its acceptability to a wider range of
          consumers. The complex bone structure of milkfish, particularly its notorious Y-shaped
          intermuscular spines, makes deboning a valuable skill that significantly increases the
          market value and appeal of the product.
        </p>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <strong className="text-gray-900 dark:text-zinc-100">Market Impact:</strong> Deboned
          bangus commands 2–3× higher prices and opens markets to children, elderly, and foreign
          consumers who avoid bony fish.
        </p>
      </Callout>
    </Section>

    {/* Bone Structure */}
    <Section id="bone-structure">
      <H2>3. Understanding Bangus Bone Structure</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Before beginning the deboning process, it is crucial to understand the location and types
        of bones in milkfish.
      </p>

      <InfoCard label="Types of Bones in Bangus">
        <ul className="space-y-1.5 mt-1">
          {[
            ["Backbone (Vertebral Column)", "The main central spine running from head to tail"],
            ["Rib Bones", "Curved bones attached to backbone, protecting the viscera"],
            ["Dorsal Fin Bones", "Supporting the top fin, running along the back"],
            ["Anal Fin Bones", "Supporting the bottom fin near the tail"],
          ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </ul>
      </InfoCard>

      <div className="mt-3 bg-gray-50 dark:bg-zinc-800/60 border border-red-200 dark:border-red-700/50 rounded-xl p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500 dark:text-red-400 mb-1.5">Y-Shaped Intermuscular Spines (Most Challenging)</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
          These are embedded between muscle layers along the lateral line. They are the most
          difficult to remove and the most dangerous if left in the meat — broken fragments pose
          a serious choking hazard. These bones are what make bangus deboning particularly
          challenging.
        </p>
      </div>
    </Section>

    {/* Equipment */}
    <Section id="bangus-equipment">
      <H2>4. Materials and Equipment Needed</H2>

      <div className="grid sm:grid-cols-2 gap-3">
        <InfoCard label="Fish & Containers">
          <ul className="space-y-1.5 mt-1">
            {[
              "Fresh milkfish (properly cleaned)",
              "Bowl or basin for washing",
              "Plastic bags for packaging",
              "Ice or freezer for storage",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Tools & Equipment">
          <ul className="space-y-1.5 mt-1">
            {[
              "Sharp filleting knife",
              "Cutting board (plastic or wood)",
              "Forceps or fish bone tweezers",
              "Clean towels or paper towels",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
      </div>
    </Section>

    {/* Deboning Steps */}
    <Section id="deboning-steps">
      <H2>5. Step-by-Step Deboning Procedure</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-5">
        Follow these steps carefully for successful bangus deboning. Each step builds upon the
        previous one, so precision and patience are essential.
      </p>

      <div className="space-y-5">
        <Step num="1" title="Prepare the Fish and Remove Anal Fin">
          <p className="mb-3">
            The fish may or may not be scaled (scaling is optional). Trim the fins using kitchen
            scissors or a sharp knife.
          </p>
          <p className="mb-3">
            <strong className="text-gray-900 dark:text-zinc-100">Remove the anal fin:</strong> Make
            a small cut around the base of the large anal fin, then pull the fin forward to remove
            the fin bones and other nuisance bones attached to it.
          </p>
          <Callout>
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              Removing the anal fin early eliminates a cluster of troublesome bones that would be
              harder to remove later.
            </p>
          </Callout>
        </Step>

        <Step num="2" title="Split the Fish Down the Dorsal Side">
          <p className="mb-3">
            Split the fish down the <strong className="text-gray-900 dark:text-zinc-100">dorsal
            side</strong> (back of the fish, not the belly). Make a clean cut along the top of the
            fish, following the backbone. Then turn the knife flat and extend the cut from the tail
            to the head by running the edge along the backbone.
          </p>
          <p className="mb-3">
            Let the fish lay open like a butterfly fillet (both sides still connected by the belly
            skin), then remove the gills and internal organs.
          </p>
          <Callout>
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              Splitting from the back (dorsal side) rather than the belly keeps the fish cavity
              intact and connected by the belly skin — essential for stuffed preparations like
              Rellenong Bangus.
            </p>
          </Callout>
        </Step>

        <Step num="3" title="Remove the Backbone">
          <p className="mb-3">
            Lay the fish flat on its skin with the flesh side facing up. Hold the knife horizontally
            (parallel to the cutting board) and carefully remove the backbone by cutting along it.
            Work slowly to avoid removing too much meat with the backbone.
          </p>
          <InfoCard label="Technique">
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Keep the knife blade flat against the bones and use smooth, controlled strokes. Let
              the resistance of the backbone guide your knife.
            </p>
          </InfoCard>
        </Step>

        <Step num="4" title="Remove the Rib Bones with Forceps">
          <p className="mb-3">
            Put the fish flat on a shallow tray with the flesh side facing up. Using forceps or
            bone tweezers, carefully pull out the rib bones. Work systematically from head to tail,
            pulling in the direction the bones naturally point.
          </p>
          <Callout>
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              This is the most time-consuming step. Take your time — rushing leads to broken bones
              left in the meat.
            </p>
          </Callout>
        </Step>

        <Step num="5" title="Remove Intermuscular Spines (Dorsal, Ventral, and Lateral Line)">
          <p className="mb-3">
            This step targets the most challenging bones — the intermuscular spines embedded
            between muscle layers.
          </p>
          <div className="space-y-3">
            <InfoCard label="Dorsal Side (Back)">
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Make a superficial cut slit along the dent of the dorsal muscle. Using forceps,
                pull out the intermuscular spines embedded between the muscles from head towards
                tail.
              </p>
            </InfoCard>
            <InfoCard label="Ventral Side (Belly)">
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Remove the spines on the ventral side in the same manner as the dorsal side. Make
                a superficial slit and carefully extract the intermuscular spines.
              </p>
            </InfoCard>
            <InfoCard label="Lateral Line — Y-Shaped Spines (Most Challenging)">
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Take out the filamentous Y-shaped spines along the lateral line (the dark line
                running along the side of the fish). These are deeply embedded and must be removed
                carefully to avoid breaking them.
              </p>
            </InfoCard>
          </div>
          <div className="mt-3 bg-gray-50 dark:bg-zinc-800/60 border border-red-200 dark:border-red-700/50 rounded-xl p-4">
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              <strong className="text-red-600 dark:text-red-400">Critical:</strong> The Y-shaped
              intermuscular spines along the lateral line MUST be removed completely as they pose
              choking hazards if left in the meat. Work slowly and methodically.
            </p>
          </div>
        </Step>

        <Step num="6" title="Wash and Package">
          <ul className="space-y-1.5 mt-2">
            {[
              "Thoroughly wash the deboned fish in clean, cold water to remove loose scales or bone fragments",
              "Pat dry with clean towels",
              "Pack in plastic bags, removing as much air as possible",
              "Freeze immediately if not using within 24 hours",
              "Label with date for quality control and traceability",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
          <Callout>
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              Before packaging, run your fingers along the entire fillet one last time to feel for
              any remaining bones.
            </p>
          </Callout>
        </Step>
      </div>
    </Section>

    {/* Quality Standards */}
    <Section id="quality-standards">
      <H2>6. Quality Standards for Deboned Bangus</H2>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="Quality Indicators">
          <ul className="space-y-1.5 mt-1">
            {[
              "No bones remaining (100% bone removal)",
              "Flesh intact with minimal tears",
              "Skin remains connected (butterfly style)",
              "Clean appearance with no blood",
              "Fresh smell with no off-odors",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Defects to Avoid">
          <ul className="space-y-1.5 mt-1">
            {[
              "Broken bone fragments left in meat",
              "Excessive flesh damage or holes",
              "Incomplete removal of ribs or spines",
              "Torn or separated skin",
              "Bruising or discoloration",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
      </div>

      <InfoCard label="Mastery Tips">
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
          Bangus deboning is a skill that requires patience and practice. The most challenging
          aspect is removing the Y-shaped intermuscular spines without breaking them.
        </p>
        <ul className="space-y-1.5">
          {[
            "Steady hand movements — avoid jerking or pulling too hard",
            "Proper forceps grip — hold bones firmly near their base",
            "Pull in the direction bones naturally point",
            "Feel for remaining bones by running fingers along the flesh",
            "Practice on larger fish first (easier to handle)",
          ].map((item) => <Bullet key={item}>{item}</Bullet>)}
        </ul>
      </InfoCard>

      <H3>Common Uses for Deboned Bangus</H3>
      <div className="grid sm:grid-cols-2 gap-3">
        <InfoCard label="Rellenong Bangus (Stuffed Milkfish)">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
            The most popular use for deboned bangus. The fish cavity is stuffed with a savory
            mixture of flaked bangus meat, sautéed vegetables, raisins, green peas, beaten eggs,
            and seasonings.
          </p>
        </InfoCard>
        <InfoCard label="Other Popular Preparations">
          <ul className="space-y-1.5 mt-1">
            {[
              ["Daing na Bangus", "Marinated in vinegar, garlic, and spices, then fried"],
              ["Bangus Sisig", "Grilled and chopped with onions and chili"],
              ["Pritong Bangus", "Simple fried bangus without bones"],
              ["Sinigang na Bangus", "In sour tamarind soup"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
      </div>
    </Section>

    {/* Tilapia */}
    <Section id="tilapia">
      <H2>7. Working with Tilapia</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Tilapia is another popular fish in the Philippines that requires different handling
        techniques compared to bangus. While it has fewer troublesome bones than milkfish, proper
        handling is crucial for maintaining quality.
      </p>

      <InfoCard label="Tilapia Characteristics">
        <ul className="space-y-1.5 mt-1">
          {[
            ["Species", "Oreochromis niloticus is the most common variety"],
            ["Bone structure", "Simpler — fewer intermuscular bones than bangus"],
            ["Preparation", "Can be filleted, fried whole, or grilled"],
            ["Spoilage", "Quick — requires immediate icing after harvest"],
          ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </ul>
      </InfoCard>

      <H3>Impact of Delayed Icing on Tilapia Shelf Life</H3>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
        Research has shown that the time between harvest and icing is critical for tilapia quality
        (Saluan-Abduhasan, 1990):
      </p>

      <InfoCard>
        {[
          ["Immediate icing", "Full shelf life — optimal quality"],
          ["4-hour delay", "Shelf life reduced to 20 days — moderate quality loss"],
          ["8-hour delay", "Shelf life reduced to 16 days — significant quality loss"],
          ["12-hour delay", "Shelf life reduced to only 1 day — severe degradation"],
        ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
      </InfoCard>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Key Takeaway</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Tilapia must be iced immediately after harvest. Even a 4-hour delay significantly reduces
          shelf life.
        </p>
      </Callout>

      <H3>Basic Tilapia Filleting Technique</H3>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Unlike bangus which is typically butterflied, tilapia is usually processed into standard
        fillets. The process is simpler due to fewer intermuscular bones.
      </p>

      <div className="space-y-4 mb-5">
        {[
          ["Scale and Clean", "Remove scales by scraping from tail to head. Gut the fish and rinse thoroughly in clean water."],
          ["Make the Initial Cut", "Cut behind the gills and pectoral fin at an angle toward the head. Cut down to the backbone but don't cut through it."],
          ["Cut Along the Backbone", "Turn the knife toward the tail and cut along the backbone, keeping the knife flat against the bones. Work from head to tail in smooth strokes."],
          ["Separate the Fillet", "Continue cutting until the fillet is completely separated. Flip the fish and repeat on the other side."],
          ["Remove Pin Bones", "Feel along the fillet for any remaining pin bones. Remove with tweezers or forceps."],
          ["Skin Removal (Optional)", "Place fillet skin-side down. Hold the tail end and slide the knife between skin and flesh, angling slightly down toward the skin. Use a sawing motion while holding the skin taut."],
        ].map(([title, desc], i) => (
          <Step key={title} num={i + 1} title={title}>{desc}</Step>
        ))}
      </div>

      <H3>Bangus vs. Tilapia: Processing Comparison</H3>
      <InfoCard>
        {[
          ["Bone Complexity", "Very high (Y-shaped spines)", "Low (simple structure)"],
          ["Processing Time", "30–45 minutes per fish", "5–10 minutes per fish"],
          ["Skill Level Required", "Expert", "Intermediate"],
          ["Common Style", "Butterfly (skin-connected)", "Single fillets"],
          ["Icing Urgency", "Important (within hours)", "Critical (immediate)"],
          ["Market Value (deboned)", "2–3× higher", "1.5–2× higher"],
        ].map(([aspect, bangus, tilapia]) => (
          <div key={aspect} className="flex flex-wrap items-start gap-2 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100 w-36 flex-shrink-0">{aspect}</span>
            <span className="text-sm text-gray-500 dark:text-zinc-400 flex-1">Bangus: {bangus}</span>
            <span className="text-sm text-gray-500 dark:text-zinc-400 flex-1">Tilapia: {tilapia}</span>
          </div>
        ))}
      </InfoCard>

      <H3>Key Takeaways</H3>
      <ul className="space-y-2">
        {[
          "Bangus deboning is a specialized skill requiring patience — focus on removing Y-shaped intermuscular spines",
          "Proper splitting technique (dorsal side) is essential for maintaining fish structure for stuffed preparations",
          "Tilapia requires immediate icing — even a 4-hour delay significantly reduces shelf life",
          "Different fish species require different processing approaches based on bone structure and spoilage patterns",
          "Quality standards must be maintained throughout the entire deboning process",
        ].map((item) => <Bullet key={item}>{item}</Bullet>)}
      </ul>
    </Section>
  </div>
);

export default Module4Content;