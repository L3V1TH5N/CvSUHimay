// File path: web/src/pages/dashboards/student/modules/Module1Content.jsx

// ─── Reusable primitives ──────────────────────────────────────────────────────

/** Section anchor wrapper — every section starts here */
const Section = ({ id, children }) => (
  <section id={id} className="mb-10 scroll-mt-24">
    {children}
  </section>
);

/** Thin green accent card (replaces the colored highlight blocks) */
const Callout = ({ children }) => (
  <div className="border-l-2 border-[#04510e] dark:border-green-500 pl-4 py-1 my-5 bg-[#04510e]/4 dark:bg-[#04510e]/10 rounded-r-lg">
    {children}
  </div>
);

/** Neutral info card — replaces the blue/purple/amber blocks */
const InfoCard = ({ label, children }) => (
  <div className="bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 rounded-xl p-4">
    {label && <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-1.5">{label}</p>}
    {children}
  </div>
);

/** Row inside an InfoCard / table-style list */
const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0">
    <span className="text-sm text-gray-500 dark:text-zinc-400">{label}</span>
    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 text-right">{value}</span>
  </div>
);

/** Bullet list item */
const Bullet = ({ children }) => (
  <li className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#04510e] dark:bg-green-500 flex-shrink-0" />
    <span>{children}</span>
  </li>
);

// ─── Section headings ────────────────────────────────────────────────────────
const H2 = ({ children }) => (
  <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100 mb-3 mt-0">{children}</h2>
);
const H3 = ({ children }) => (
  <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-2 mt-5">{children}</h3>
);

// ─── Module 1 ────────────────────────────────────────────────────────────────
const Module1Content = () => (
  <div className="space-y-0">

    {/* 1. Nutritive Value */}
    <Section id="nutritive-value">
      <H2>1. Nutritive Value of Fish</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Fish provide a very good balance of nutrients and compare favorably with meat, eggs, and
        chicken in both quantity and quality of protein. They are regarded as a health food because
        their fish oils consist of fatty acids different from those in other animal fats and
        vegetable oils.
      </p>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Why Fish is a Superfood</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
          Fish oils contain unique omega-3 polyunsaturated fatty acids (PUFA) not found in
          significant quantities in other foods. These essential fatty acids have been linked to low
          incidence of coronary heart disease in populations that consume fish regularly.
        </p>
      </Callout>
    </Section>

    {/* 2. Health Benefits */}
    <Section id="health-benefits">
      <H2>2. Health Benefits of Fish Consumption</H2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="Low Calorie & Low Fat">
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
            Most fish species have a low-calorie, low-fat profile compared with red meat, pork, and
            cheese — naturally "light" and helps maintain body weight.
          </p>
        </InfoCard>
        <InfoCard label="Disease Prevention">
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
            Lower fat content reduces chances of developing ailments associated with being
            overweight, including hypertension, diabetes, and certain cancers.
          </p>
        </InfoCard>
      </div>

      <H3>Essential Vitamins and Minerals</H3>
      <ul className="space-y-2">
        {[
          ["Vitamin A", "Essential for vision and immune function"],
          ["B Complex Vitamins", "Important for energy metabolism and nervous system health"],
          ["Iodine", "Critical for thyroid function and metabolic regulation"],
          ["Fluoride", "Supports dental and bone health"],
          ["Selenium", "Powerful antioxidant that protects cells from damage"],
          ["Zinc", "Essential for immune function and wound healing"],
          ["Iron (shellfish)", "Oysters and mussels contain iron levels even higher than red meats"],
        ].map(([label, desc]) => (
          <Bullet key={label}><strong className="font-semibold text-gray-900 dark:text-zinc-100">{label}:</strong> {desc}</Bullet>
        ))}
      </ul>
    </Section>

    {/* 3. Structure of Fish */}
    <Section id="fish-structure">
      <H2>3. Structure of Fish and Fish Muscles</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Fish are cold-blooded vertebrate animals living in water, breathing by means of gills and
        having limbs represented by fins or rudiments of fins. Understanding fish anatomy is crucial
        for proper deboning and processing techniques.
      </p>

      <H3>Classification of Fish</H3>
      <div className="space-y-2 mb-5">
        {[
          ["Cephalaspidomorphi", "Jawless fish like lampreys and slime eels — primitive fish without true jaws"],
          ["Chondrichthyes",     "Cartilaginous fish like sharks and rays — skeleton made of cartilage instead of bone"],
          ["Osteichthyes",       "Bony fish including lungfish and all other common fish — have true bone skeletons"],
        ].map(([name, desc]) => (
          <div key={name} className="flex gap-3 items-start">
            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#04510e] dark:bg-green-500 flex-shrink-0" />
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              <span className="font-semibold text-gray-900 dark:text-zinc-100">{name} — </span>
              {desc}
            </p>
          </div>
        ))}
      </div>

      <H3>Main Parts of a Typical Bony Fish</H3>
      <InfoCard>
        {[
          ["Skeleton",         "Skull, backbone (vertebral column), rib cage, and fin supports that provide structure"],
          ["Muscle Tissues",   "With small amounts of connective tissues and fat, supported by the skeleton"],
          ["Skin and Fins",    "Often scaly in finfish, providing protection and aiding in movement"],
          ["Viscera",          "Internal organs including alimentary canal, associated organs, and urogenital system"],
        ].map(([label, desc]) => (
          <Row key={label} label={<span className="font-medium text-gray-900 dark:text-zinc-100">{label}</span>} value={<span className="text-gray-500 dark:text-zinc-400 font-normal">{desc}</span>} />
        ))}
      </InfoCard>
    </Section>

    {/* 4. Fish Muscle Structure */}
    <Section id="muscle-structure">
      <H2>4. Fish Muscle Structure</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Fish muscle is organized into blocks called <strong className="text-gray-900 dark:text-zinc-100">myotomes</strong>, separated by sheets of connective tissue
        called <strong className="text-gray-900 dark:text-zinc-100">myocommata</strong>. This unique structure is fundamentally different from terrestrial
        animals and directly affects deboning and filleting techniques.
      </p>

      <Callout>
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          The myotome arrangement explains why fish muscle separates into clean "flakes" when
          properly cooked — the connective tissue softens at lower temperatures than in red meat.
        </p>
      </Callout>
    </Section>

    {/* 5. White vs Dark Muscle */}
    <Section id="white-vs-dark">
      <H2>5. White vs Dark Muscle</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-5">
        Fish contain two distinct types of muscle tissue that differ in color, function, and
        composition. Most fish are roughly <strong className="text-gray-900 dark:text-zinc-100">90% white muscle</strong> and{" "}
        <strong className="text-gray-900 dark:text-zinc-100">10% dark muscle</strong>.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="White (Fast) Muscle — 90%">
          <ul className="space-y-1.5 mt-1">
            {[
              ["Color",       "White or pink, low myoglobin"],
              ["Use",         "Escaping predators or catching prey"],
              ["Energy",      "Anaerobic metabolism (short bursts)"],
              ["Composition", "Lower lipid and vitamin content"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
        <InfoCard label="Dark (Red) Muscle — 10%">
          <ul className="space-y-1.5 mt-1">
            {[
              ["Color",       "Red due to myoglobin pigment"],
              ["Function",    "Cruising muscle for continuous motion"],
              ["Location",    "Along the midlateral line"],
              ["Energy",      "Aerobic metabolism (sustained activity)"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
      </div>

      <H3>Muscle Composition by Fish Activity Level</H3>
      <div className="space-y-2">
        {[
          ["Pelagic Fish (Continuous Swimmers)", "Species like herring and mackerel that swim continuously contain up to 48% dark muscle. They need sustained energy for constant movement."],
          ["Demersal Fish (Bottom Feeders)",     "Bottom-dwelling fish that move only occasionally have small amounts of dark meat — they don't need sustained endurance."],
          ["\"White\" Fish Classification",      "Fish classified as \"white\" have negligible amounts of red muscle, typically less than 5% of total muscle mass."],
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
    </Section>

    {/* 6. Myocommata */}
    <Section id="myocommata">
      <H2>6. Myocommata: Connective Tissue</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Myocommata are sheets of connective tissue made up mostly of the protein{" "}
        <strong className="text-gray-900 dark:text-zinc-100">collagen</strong>. This tissue plays a crucial role in how fish behaves
        during cooking.
      </p>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Cooking Science: Why Fish Flakes</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
          Collagen easily breaks up in hot water, which causes myotome blocks to separate between
          the sheets of myocommata during cooking — this is why properly cooked fish separates into
          clean flakes.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 text-sm">
          {[
            { label: "Fish collagen shrinks at", value: "45 °C" },
            { label: "Beef collagen shrinks at",  value: "64 °C" },
          ].map(({ label, value }) => (
            <div key={label} className="flex-1 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 flex items-center justify-between gap-2 border border-gray-100 dark:border-zinc-800">
              <span className="text-gray-500 dark:text-zinc-400">{label}</span>
              <span className="font-bold text-[#04510e] dark:text-green-400">{value}</span>
            </div>
          ))}
        </div>
      </Callout>

      <H3>Collagen Content by Fish Type</H3>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="Bony Fish (Teleosts)">
          <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 my-1">~3% Collagen</p>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Lower collagen makes bony fish more tender and easier to process. Examples: salmon,
            tilapia, bangus.
          </p>
        </InfoCard>
        <InfoCard label="Cartilaginous Fish (Elasmobranchs)">
          <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100 my-1">~16% Collagen</p>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Higher collagen results in firmer texture. Examples: sharks, rays, skates.
          </p>
        </InfoCard>
      </div>

      <H3>Location of Collagen in Fish</H3>
      <ul className="space-y-2 mb-5">
        {[
          ["Myocommata",  "Sheets between muscle layers — most abundant location"],
          ["Perimysium",  "Surrounds and envelops the muscle bundle"],
          ["Endomysium",  "Wraps around individual muscle cells or fibers"],
        ].map(([label, desc]) => (
          <Bullet key={label}>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">{label}:</span>{" "}
            <span className="text-gray-500 dark:text-zinc-400">{desc}</span>
          </Bullet>
        ))}
      </ul>

      <InfoCard label="Comparative Note">
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
          In mammals, connective tissue protein constitutes approximately{" "}
          <strong className="text-gray-900 dark:text-zinc-100">17% of total protein</strong>. This is why mammalian meat requires longer
          cooking times and different preparation methods compared to fish.
        </p>
      </InfoCard>
    </Section>
  </div>
);

export default Module1Content;