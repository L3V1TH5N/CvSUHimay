// File path: web/src/pages/dashboards/student/modules/Module5Content.jsx

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

// ─── Module 5 ────────────────────────────────────────────────────────────────
const Module5Content = () => (
  <div className="space-y-0">

    {/* Intro */}
    <Section id="quality-intro">
      <H2>1. Quality & Safety in Fish Processing</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Maintaining quality and safety throughout the fish handling process is critical for consumer
        health, product value, and business success. This module covers essential practices for
        proper fish handling, storage techniques, and solutions to common technical problems
        encountered in fish processing.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {[
          ["Low Temperature", "Keeps fish at near 0°C to slow bacterial growth"],
          ["Cleanliness", "Prevents contamination from equipment and surfaces"],
          ["Speed", "Minimize time between catch and preservation"],
          ["Careful Handling", "Avoid bruising and physical damage to flesh"],
        ].map(([label, desc]) => (
          <InfoCard key={label} label={label}>
            <p className="text-sm text-gray-600 dark:text-zinc-400">{desc}</p>
          </InfoCard>
        ))}
      </div>
    </Section>

    {/* Proper Handling */}
    <Section id="proper-handling">
      <H2>2. Proper Fish Handling</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        The quality of fish deteriorates rapidly after death. Proper handling immediately after
        harvest is the foundation of quality preservation and determines the ultimate shelf life
        and market value of the product.
      </p>

      <H3>Essential Handling Principles</H3>
      <div className="space-y-3 mb-5">
        {[
          ["Sort Immediately", "Fish must be sorted according to species and size without delay. This allows for appropriate processing methods for each species, uniform cooling, prevention of cross-contamination, and efficient market distribution."],
          ["Minimize Handling", "Fish must not be handled frequently. Each additional touch increases the risk of physical damage and bruising, removal of the protective slime layer, bacterial contamination, and temperature rise that accelerates spoilage."],
          ["Maintain Low Temperature", "Fish must be kept at low temperatures at all times. Temperature control is the single most important factor in preserving fish quality."],
          ["Work Quickly", "Speed is essential. The faster fish moves from catch to ice/refrigeration, the better the final quality. Every minute counts in preventing bacterial growth and enzymatic deterioration."],
        ].map(([title, desc]) => (
          <div key={title} className="flex gap-3 items-start">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#04510e] dark:bg-green-500 flex-shrink-0" />
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              <span className="font-semibold text-gray-900 dark:text-zinc-100">{title}: </span>
              {desc}
            </p>
          </div>
        ))}
      </div>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Critical Factors Summary</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          <strong className="text-gray-900 dark:text-zinc-100">Low temperature, cleanliness, speed,
          and care</strong> are the important factors in maintaining the quality of newly caught
          fish. Neglecting any one can result in rapid quality deterioration and potential food
          safety issues.
        </p>
      </Callout>
    </Section>

    {/* Species Handling */}
    <Section id="species-handling">
      <H2>3. Species-Specific Handling Recommendations</H2>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="Milkfish (Bangus)">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
            According to Dolendo et al. (1977):
          </p>
          <ul className="space-y-1.5">
            {[
              "Pre-chill to 4°C immediately after harvest",
              "This preserves quality during transport",
              "Especially important for long-distance transportation",
              "Maintains texture and prevents bruising",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Tilapia">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
            Critical findings by Saluan-Abduhasan (1990):
          </p>
          <ul className="space-y-1.5 mt-1">
            {[
              ["4-hour delay", "Shelf life → 20 days"],
              ["8-hour delay", "Shelf life → 16 days"],
              ["12-hour delay", "Shelf life → only 1 day"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
        <InfoCard label="Shrimp">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
            Research by Legaspi and Khiang (1972):
          </p>
          <ul className="space-y-1.5">
            {[
              "Cooking shrimp before ice storage is more advantageous",
              "Cooked shrimp maintains better quality than raw during storage",
              "Prevents melanosis (black spot) development",
              "Extends shelf life significantly",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Shellfish (Oysters & Mussels)">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
            Special requirements for filter-feeding mollusks:
          </p>
          <ul className="space-y-1.5 mt-1">
            {[
              ["Risk", "May contain harmful bacteria from water"],
              ["Depuration", "Required before sale (purification)"],
              ["System", "UV-sterilized recirculating seawater"],
              ["Duration", "36–48 hours at 26–31°C"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
      </div>
    </Section>

    {/* Storage Techniques */}
    <Section id="storage-techniques">
      <H2>4. Proper Storage Techniques</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Proper storage is essential for maintaining fish quality after initial handling. Different
        storage methods are appropriate for different time frames and product types.
      </p>

      <H3>Chilling and Ice Storage</H3>
      <InfoCard label="Optimal Chilling Conditions">
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
          Fish should be stored at temperatures as close to 0°C as possible without freezing.
        </p>
        <ul className="space-y-1.5">
          {[
            "Use clean, freshwater ice (not seawater ice)",
            "Crushed or flaked ice works better than block ice",
            "Use ice-to-fish ratio of approximately 1:1 by weight",
            "Ensure complete coverage — ice on top, bottom, and sides",
            "Drain meltwater regularly to prevent bacterial growth",
            "Replenish ice as it melts to maintain temperature",
          ].map((item) => <Bullet key={item}>{item}</Bullet>)}
        </ul>
      </InfoCard>

      <H3>Freezing Preservation</H3>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="Pre-Freezing Preparation">
          <ul className="space-y-1.5 mt-1">
            {[
              "Freeze within 2–3 days of death",
              "Store near 0°C during the pre-freezing period",
              "Fish frozen after rigor mortis produces better quality fillets",
              "Prevents gaping (splitting) in fillets",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Freezing Requirements">
          <ul className="space-y-1.5 mt-1">
            {[
              ["Temperature", "Maintain at −18°C or lower for long-term storage"],
              ["Speed", "Quick freezing prevents large ice crystal formation"],
              ["Packaging", "Use moisture-proof, vapor-proof materials"],
              ["Glazing", "Thin ice glaze protects whole fish from oxidation"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
      </div>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Quality Note on Frozen-Thawed Fish</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          Good quality fillets can be obtained from frozen-thawed fish that were frozen within
          2–3 days of death, kept near 0°C before freezing, properly packaged, and stored at
          consistent temperatures without thaw-refreeze cycles. Fillets from properly frozen fish
          will not suffer from gaping.
        </p>
      </Callout>

      <H3>Modern Container Solutions</H3>
      <div className="grid sm:grid-cols-2 gap-3">
        <InfoCard label="High-Density Polyethylene (HDPE)">
          <ul className="space-y-1.5 mt-1">
            {[
              "Durable and lightweight",
              "Easy to clean and sanitize",
              "Resistant to corrosion",
              "Good for municipal fisheries",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Insulated Containers">
          <ul className="space-y-1.5 mt-1">
            {[
              "Polyethylene with foam insulation",
              "Fiberglass with polyurethane",
              "Better temperature retention",
              "Reduces ice consumption",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
      </div>
    </Section>

    {/* Technical Problems */}
    <Section id="technical-problems">
      <H2>5. Technical Problems and Solutions</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Even with proper handling, certain technical problems can occur during fish processing and
        storage. Understanding these issues and their solutions is critical for maintaining product
        quality.
      </p>

      <H3>Color Changes in Fish</H3>

      <InfoCard label="Browning or Blackening of Tuna and Bonito Meat">
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
          Frozen tuna or bonito becomes dark brown or dark red during cold storage due to oxidation
          of hemoglobin in the blood and myoglobin in the meat.
        </p>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">Chemical Process:</p>
        <ul className="space-y-1.5 mb-3">
          {[
            "Hemoglobin → Oxyhemoglobin (brilliant red)",
            "Myoglobin → Oxymyoglobin (brilliant red)",
            "Oxyhemoglobin → Methemoglobin (dark brown/red) via oxidative enzymes",
            "Oxymyoglobin → Metmyoglobin (dark brown/red) via oxidative enzymes",
          ].map((item) => <Bullet key={item}>{item}</Bullet>)}
        </ul>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">Solutions:</p>
        <ul className="space-y-1.5">
          {[
            "Add sodium nitrate to prevent discoloration",
            "Use ascorbic acid (Vitamin C) as an antioxidant",
            "Apply immediately after catch for best results",
          ].map((item) => <Bullet key={item}>{item}</Bullet>)}
        </ul>
      </InfoCard>

      <div className="mt-3">
        <InfoCard label="Green Discoloration of Tuna Meat">
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
            Greening in tuna meat is due to the presence of trimethylamine oxide (TMAO) in the
            flesh, combined with myoglobin content, cysteine concentration, and cooking conditions.
            Rillo and Alabastro (1974) correlated the greening of steam-cooked tuna with
            trimethylamine, pH, and soluble protein content of the raw fish.
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">Prevention Methods:</p>
          <ul className="space-y-1.5">
            {[
              "Use only fresh raw material for freezing — highest priority",
              "Gut and bleed fish before freezing to remove blood containing hemoglobin",
              "Process fish immediately after catch",
              "Maintain proper chilling temperatures throughout handling",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
      </div>

      <H3>Texture Problems</H3>
      <InfoCard label="Gaping in Fillets">
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
          <strong className="text-gray-900 dark:text-zinc-100">Gaping</strong> is the tendency of
          fillets to split into fissures or gaps along the natural muscle segments (myotomes). It
          occurs when the connective tissue between muscle segments weakens.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">Primary Causes:</p>
            <ul className="space-y-1.5">
              {[
                "Filleting fish before rigor mortis has passed",
                "Freezing fish too soon after death",
                "Poor handling causing physical damage",
                "Inadequate chilling before processing",
              ].map((item) => <Bullet key={item}>{item}</Bullet>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">Prevention:</p>
            <ul className="space-y-1.5">
              {[
                "Wait until fish has just passed rigor mortis before filleting",
                "Freeze within 2–3 days of death while storing near 0°C",
                "Handle fish gently to avoid bruising",
                "Maintain consistent cold chain",
              ].map((item) => <Bullet key={item}>{item}</Bullet>)}
            </ul>
          </div>
        </div>
      </InfoCard>

      <H3>Odor Problems</H3>
      <InfoCard label="Off-Odors and Freshness Assessment">
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
          Odor is one of the most reliable indicators of fish freshness and quality.
        </p>
        <ul className="space-y-1.5 mt-1">
          {[
            ["Fresh Fish", "Sweet, mild, fresh ocean/water smell — no ammonia or sour notes. Indicates excellent quality."],
            ["Early Deterioration", "Neutral to slightly fishy smell. Still acceptable but past peak — use or process promptly."],
            ["Spoiled / Unacceptable", "Strong ammonia smell, sour or putrid odor. DO NOT USE — reject immediately."],
          ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </ul>
      </InfoCard>

      <H3>Post-Mortem Changes: Research Notes</H3>
      <InfoCard label="Scientific Studies on Fish Quality">
        <div className="space-y-3 mt-1">
          {[
            ["TMA and VRS (Orejana et al., 1971)", "Determined changes in trimethylamine and volatile reducing substances during storage of frigate mackerel at various temperatures. These compounds increase as fish deteriorates and serve as chemical indicators of spoilage."],
            ["Milkfish Quality (Santos & Acevedo, 1978)", "Studied post-mortem changes in hypoxanthine content and non-protein nitrogenous compounds in relation to sensory qualities."],
            ["Delayed Icing in Milkfish (Arciaga, 1996)", "Studied postmortem changes in milkfish with delayed icing, confirming that immediate chilling is critical for quality preservation."],
          ].map(([label, desc]) => (
            <div key={label} className="flex gap-3 items-start">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#04510e] dark:bg-green-500 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-zinc-300">
                <span className="font-semibold text-gray-900 dark:text-zinc-100">{label}: </span>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </InfoCard>
    </Section>

    {/* Quality Control Checklist */}
    <Section id="quality-control">
      <H2>6. Quality Control Checklist</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Use this checklist to ensure proper quality and safety practices are followed throughout
        fish processing.
      </p>

      <div className="space-y-3 mb-5">
        {[
          ["At Harvest / Receipt", [
            "Fish sorted by species and size immediately",
            "Temperature at or near 0°C",
            "Fresh ocean/water smell (no ammonia or sour odor)",
            "Eyes clear and bright (not sunken or cloudy)",
            "Gills bright red (not brown or gray)",
            "Flesh firm and elastic (springs back when pressed)",
          ]],
          ["During Processing", [
            "Clean, sanitized work surfaces and equipment",
            "Workers wearing clean protective clothing",
            "Minimize handling and work quickly",
            "Maintain cold chain (keep fish chilled)",
            "Sharp knives used for clean cuts",
            "Complete bone removal verified (for deboned products)",
          ]],
          ["Before Storage / Sale", [
            "Product properly packaged (moisture-proof for frozen)",
            "Correct storage temperature maintained",
            "Date labeled for traceability",
            "No signs of discoloration (brown, green)",
            "No gaping or texture problems",
            "Quality meets market standards",
          ]],
        ].map(([label, items]) => (
          <InfoCard key={label} label={label}>
            <ul className="space-y-1.5 mt-1">
              {items.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-zinc-300">
                  <input type="checkbox" className="w-3.5 h-3.5 accent-[#04510e] flex-shrink-0" readOnly />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </InfoCard>
        ))}
      </div>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">Key Takeaways for Quality & Safety</p>
        <ul className="space-y-2">
          {[
            "Four critical factors: Low temperature, cleanliness, speed, and careful handling determine final quality",
            "Immediate icing is essential — delays of even a few hours significantly reduce shelf life",
            "Pre-chilling bangus to 4°C preserves quality during transport",
            "Proper timing matters: fillet fish after rigor mortis to prevent gaping",
            "Color problems are preventable: use antioxidants for tuna/bonito, gut and bleed to prevent greening",
            "Quality assessment uses multiple indicators: odor, color, texture, and appearance all tell the quality story",
          ].map((item) => <Bullet key={item}>{item}</Bullet>)}
        </ul>
      </Callout>
    </Section>
  </div>
);

export default Module5Content;