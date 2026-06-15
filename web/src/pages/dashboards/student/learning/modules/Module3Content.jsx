// File path: web/src/pages/dashboards/student/modules/Module3Content.jsx

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

// Step card with a numbered accent
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

// ─── Module 3 ────────────────────────────────────────────────────────────────
const Module3Content = () => (
  <div className="space-y-0">

    {/* Intro */}
    <Section id="filleting-intro">
      <H2>1. Filleting of Fish</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Fast food restaurants, hotels, and food catering houses require fish fillets for the
        preparation of convenience foods such as battered and breaded fish, fish fingers, burgers,
        and other popular dishes. The preparation of fillets requires great care and strict
        conditions of hygiene to ensure food safety and quality.
      </p>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-1">Critical Safety Warning</p>
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
          The fillet, once cut from the body of the fish, will be very susceptible to bacterial
          action on its large exposed surface area. Unlike whole fish where skin provides
          protection, fillets have maximum surface exposure to potential contamination. Strict
          hygiene is absolutely essential throughout the entire filleting process.
        </p>
      </Callout>
    </Section>

    {/* Fish Selection */}
    <Section id="fish-selection">
      <H2>2. Selecting Fish for Filleting</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        The quality of your raw material directly determines the quality of your fillets. Proper
        fish selection is the foundation of successful filleting.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="Post-Rigor Fish (Recommended)">
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
            Fish which have been chilled and have just passed the rigor (stiffening) condition are
            the most suitable raw material for filleting.
          </p>
          <ul className="space-y-1.5">
            {[
              "Muscles have relaxed, making knife work easier",
              "Flesh is firm but pliable",
              "Reduced risk of tearing or gaping",
              "Better yield and cleaner cuts",
              "Fillets maintain shape during processing",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Frozen-Thawed Fish (Alternative)">
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
            Good quality fillets can also be obtained from frozen-thawed fish, provided specific
            criteria are met.
          </p>
          <ul className="space-y-1.5">
            {[
              ["Frozen within", "2–3 days of death"],
              ["Pre-freeze temp", "Near 0°C"],
              ["Thawing", "Slow thaw in refrigerator"],
              ["Refreezing", "Not permitted after thawing"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
      </div>

      <InfoCard label="Understanding Gaping">
        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-3">
          <strong className="text-gray-900 dark:text-zinc-100">Gaping</strong> is a quality defect
          where fillets develop fissures or splits between muscle segments. It occurs when:
        </p>
        <ul className="space-y-1.5">
          {[
            "Fish are filleted while still in rigor mortis",
            "Fish are handled roughly before or during processing",
            "Fish quality has deteriorated before processing",
            "Improper freezing or thawing procedures were used",
          ].map((item) => <Bullet key={item}>{item}</Bullet>)}
        </ul>
      </InfoCard>
    </Section>

    {/* Equipment */}
    <Section id="filleting-equipment">
      <H2>3. Essential Filleting Equipment</H2>

      <div className="grid sm:grid-cols-2 gap-3">
        <InfoCard label="Filleting Knife">
          <ul className="space-y-1.5 mt-1">
            {[
              ["Blade length", "6–9 inches"],
              ["Flexibility", "Bends but doesn't fold"],
              ["Edge", "Thin and sharp for precision"],
              ["Handle", "Comfortable, non-slip"],
              ["Material", "High-carbon stainless steel preferred"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </ul>
        </InfoCard>
        <InfoCard label="Supporting Tools">
          <ul className="space-y-1.5 mt-1">
            {[
              "Sturdy cutting board (non-slip)",
              "Fish tweezers or needle-nose pliers",
              "Sharpening steel or stone",
              "Clean towels or paper towels",
              "Containers for fillets and waste",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
      </div>
    </Section>

    {/* Filleting Steps */}
    <Section id="filleting-steps">
      <H2>4. Step-by-Step Filleting Procedure</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-5">
        Follow these steps carefully for successful filleting. Each step builds on the previous
        one, so precision at every stage is important.
      </p>

      <div className="space-y-5">
        <Step num="1" title="Initial Cut Behind the Gill Plate">
          <ul className="space-y-1.5 mt-2">
            {[
              "Position the fish with the dorsal (back) side away from you",
              "Locate the gill plate (bony covering behind the head)",
              "Make a cut behind the gill plate at a slight angle toward the head",
              "Cut down to the backbone, but do not cut through the backbone",
              "Keep the knife perpendicular to the cutting board",
              "Use a single smooth motion rather than sawing",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
          <Callout>
            <p className="text-sm text-gray-700 dark:text-zinc-300">
              Feel the resistance of the backbone with your knife — this helps maintain the correct
              depth without cutting into the spine.
            </p>
          </Callout>
        </Step>

        <Step num="2" title="Cut Along the Backbone">
          <p className="mb-2">
            This is the most critical cut. Turn the knife blade flat against the backbone,
            nearly parallel to the cutting board, and use smooth continuous strokes from head
            to tail, following the natural bone contours.
          </p>
          <InfoCard label="What You Should Feel">
            <ul className="space-y-1.5 mt-1">
              {[
                "Slight resistance as blade follows bone contours",
                "Smooth gliding motion through the flesh",
                "Backbone edges guiding your knife",
                "Clean separation of meat from bone",
              ].map((item) => <Bullet key={item}>{item}</Bullet>)}
            </ul>
          </InfoCard>
        </Step>

        <Step num="3" title="Separate the Fillet from the Rib Cage">
          <p className="mb-3">
            The rib section requires special attention as these bones curve into the flesh.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <InfoCard label="Option A — Cut Over the Ribs">
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Continue your cut over the top of the rib cage, leaving the ribs attached to
                the fillet for removal later. Best for beginners or maximum yield.
              </p>
            </InfoCard>
            <InfoCard label="Option B — Cut Under the Ribs">
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Angle the knife to follow under the ribs, separating them in one motion.
                Produces a cleaner fillet immediately. Best for experienced processors.
              </p>
            </InfoCard>
          </div>
        </Step>

        <Step num="4" title="Release the Fillet at the Tail">
          <ul className="space-y-1.5 mt-2">
            {[
              "Continue your cut all the way to the tail",
              "Cut through the skin at the tail end to release the fillet",
              "Lift the fillet away carefully",
              "Place on a clean surface or container",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </Step>

        <Step num="5" title="Repeat on the Other Side">
          <ul className="space-y-1.5 mt-2">
            {[
              "Flip the fish over to expose the other side",
              "Repeat Steps 1–4 exactly as before",
              "Maintain the same technique for consistency",
              "Aim for symmetrical fillets from both sides",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </Step>

        <Step num="6" title="Remove Pin Bones">
          <p className="mb-3">
            Pin bones are small, needle-like bones that run along the centerline of the fillet.
            They must be removed for a quality product.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <InfoCard label="Detection">
              <ul className="space-y-1.5 mt-1">
                {[
                  "Run fingers along the fillet centerline",
                  "Feel for small, firm protrusions",
                  "Pin bones are usually in a line down the thicker part",
                  "They're easier to feel than see",
                ].map((item) => <Bullet key={item}>{item}</Bullet>)}
              </ul>
            </InfoCard>
            <InfoCard label="Removal Technique">
              <ul className="space-y-1.5 mt-1">
                {[
                  "Use fish tweezers or needle-nose pliers",
                  "Grasp each bone firmly at its base",
                  "Pull at a slight angle in the direction the bone grows",
                  "Use steady, firm pressure — don't yank",
                  "Do a final finger pass to verify",
                ].map((item) => <Bullet key={item}>{item}</Bullet>)}
              </ul>
            </InfoCard>
          </div>
        </Step>
      </div>
    </Section>

    {/* Skinning */}
    <Section id="skinning">
      <H2>5. Skinning Fillets</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        If skinless fillets are desired, follow this procedure after completing the filleting
        process. Skinning requires a different technique than filleting.
      </p>

      <div className="space-y-4 mb-5">
        {[
          ["Position the Fillet", "Place the fillet skin-side down on a clean cutting board. The tail end should be closest to you."],
          ["Make the Initial Cut", "At the tail end, make a small cut between the skin and flesh — just deep enough to separate them (about 1–2 cm). Don't cut through the skin."],
          ["Grip the Skin Firmly", "Hold the tail end of the skin with your non-knife hand. A bit of coarse salt on your fingers helps maintain grip on the slippery skin."],
          ["Position Your Knife", "Hold the knife at a 45-degree angle against the skin, blade facing away from you, almost parallel to the cutting board."],
          ["Execute the Skinning Motion", "Pull the skin toward you with steady tension while using a gentle sawing motion. Keep the blade pressed firmly against the skin (not the flesh)."],
          ["Work from Tail to Head", "Continue this motion until the entire skin is separated. Steady, consistent movement produces the cleanest result."],
          ["Final Inspection", "Check for any remaining skin pieces or scales and remove them."],
        ].map(([title, desc], i) => (
          <Step key={title} num={i + 1} title={title}>{desc}</Step>
        ))}
      </div>

      <InfoCard label="Key Success Factors">
        <ul className="space-y-1.5 mt-1">
          {[
            ["Blade angle", "Too steep cuts into flesh; too shallow won't cut the membrane"],
            ["Consistent pressure", "Blade must stay pressed against the skin throughout"],
            ["Sharp knife", "A dull blade tears rather than cleanly separates"],
            ["Steady pull", "Jerky movements result in uneven skinning"],
          ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </ul>
      </InfoCard>
    </Section>

    {/* Handling Requirements */}
    <Section id="handling-requirements">
      <H2>6. Essential Handling Requirements</H2>
      <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">
        Fish must be sorted according to species and size without delay and kept at low
        temperatures. The fish must not be handled frequently. These are the fundamental
        requirements for maintaining quality.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {[
          ["Low Temperature", "Keep fish at near 0°C throughout processing. Temperature control is the single most important factor in preventing bacterial growth.", ["Use chilled cutting boards", "Work in a cool environment", "Process in small batches", "Return to cold storage immediately"]],
          ["Cleanliness", "Maintain strict hygiene to prevent cross-contamination. Fish are highly susceptible to bacterial contamination.", ["Sanitize all equipment before use", "Wash hands frequently", "Use clean cutting surfaces", "Separate raw and processed fish"]],
          ["Speed", "Process quickly to minimize quality loss. Every minute at improper temperature accelerates deterioration.", ["Work efficiently but carefully", "Have all tools ready before starting", "Minimize time outside cold storage", "Process in an organized manner"]],
          ["Care", "Handle fish gently to prevent damage. Physical damage creates entry points for bacteria and reduces shelf life.", ["Avoid dropping or throwing fish", "Support weight when moving", "Don't stack heavy loads", "Minimize handling overall"]],
        ].map(([label, desc, items]) => (
          <InfoCard key={label} label={label}>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">{desc}</p>
            <ul className="space-y-1.5">
              {items.map((item) => <Bullet key={item}>{item}</Bullet>)}
            </ul>
          </InfoCard>
        ))}
      </div>

      <Callout>
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          <strong className="text-gray-900 dark:text-zinc-100">Remember:</strong> Low temperature,
          cleanliness, speed, and care are the <strong className="text-gray-900 dark:text-zinc-100">four pillars of quality fish processing</strong>. Neglecting
          any one of these factors will compromise the entire operation.
        </p>
      </Callout>
    </Section>

    {/* Common Problems */}
    <Section id="common-problems">
      <H2>7. Common Filleting Problems and Solutions</H2>

      <div className="space-y-3">
        {[
          ["Ragged, Torn Flesh", "Dull knife blade cannot make clean cuts through fish tissue.", "Always sharpen your knife before filleting. Test sharpness on a piece of paper — it should slice cleanly. Touch up with a steel between fish."],
          ["Meat Left on Bones", "Blade angle is too high, causing knife to cut above the bones rather than following their contour.", "Keep knife flat against bones. Feel the bones with the blade tip and follow them closely. Use resistance of the bones to guide your knife."],
          ["Excessive Waste / Low Yield", "Poor knife control, wrong cutting angles, or cutting too far from bones.", "Practice smooth, controlled movements. Follow bone contours closely. Use the entire length of your blade in long, sweeping strokes."],
          ["Uneven Fillet Thickness", "Inconsistent blade pressure or angle during cutting.", "Maintain steady pressure and consistent angle throughout the entire cut. Use smooth, continuous strokes rather than stopping and starting."],
          ["Difficulty Removing Skin", "Incorrect blade angle, insufficient tension on skin, or dull knife.", "Ensure knife is at proper 45° angle. Pull skin with firm, steady tension. Use salt on fingers for better grip. Sharpen knife if it's pulling rather than cutting."],
        ].map(([problem, cause, solution]) => (
          <InfoCard key={problem} label={problem}>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">
              <strong className="text-gray-900 dark:text-zinc-100">Cause:</strong> {cause}
            </p>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              <strong className="text-gray-900 dark:text-zinc-100">Solution:</strong> {solution}
            </p>
          </InfoCard>
        ))}
      </div>
    </Section>

    {/* Professional Tips & Yield */}
    <Section id="professional-tips">
      <H2>8. Professional Tips & Yield Expectations</H2>

      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <InfoCard label="Equipment">
          <ul className="space-y-1.5 mt-1">
            {[
              "Use a flexible filleting knife of 6–9 inches",
              "Blade should bend slightly but not fold",
              "Keep a sharpening steel nearby for touch-ups",
              "Use a stable, non-slip cutting board",
              "Have containers ready for fillets and waste",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
        <InfoCard label="Technique">
          <ul className="space-y-1.5 mt-1">
            {[
              "Watch the blade, not the fish, while cutting",
              "Let the knife do the work — don't force it",
              "Use smooth, continuous strokes",
              "Rinse knife between fish to prevent cross-contamination",
              "Take breaks to maintain focus and accuracy",
            ].map((item) => <Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
      </div>

      <H3>Filleting Yield by Fish Type</H3>
      <InfoCard>
        {[
          ["Round Fish (Salmon, Bass)", "35–45%", "Standard yield for typical round fish"],
          ["Flat Fish (Sole, Flounder)", "40–50%", "Higher yield; 4 fillets possible"],
          ["Bony Fish (Milkfish, Herring)", "30–40%", "Lower yield due to complex bone structure"],
          ["Large Tuna", "45–55%", "Excellent yield from large, meaty fish"],
        ].map(([type, yield_, note]) => (
          <div key={type} className="flex flex-wrap items-start justify-between gap-2 py-2 border-b border-gray-100 dark:border-zinc-800 last:border-0">
            <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 flex-1 min-w-0">{type}</span>
            <span className="text-sm font-bold text-[#04510e] dark:text-green-400 w-16 text-right flex-shrink-0">{yield_}</span>
            <span className="text-sm text-gray-500 dark:text-zinc-400 w-full sm:w-56 sm:text-right">{note}</span>
          </div>
        ))}
      </InfoCard>

      <H3>Factors Affecting Yield</H3>
      <ul className="space-y-2 mb-5">
        {[
          ["Skill level", "Experienced processors achieve higher yields"],
          ["Fish size", "Larger fish generally have better yield percentages"],
          ["Fish condition", "Fresh, firm fish are easier to fillet efficiently"],
          ["Species anatomy", "Simple bone structure = higher yield"],
          ["Knife sharpness", "Sharp knives allow closer cuts to bones"],
          ["Processing method", "Skin-on vs. skinless affects final yield"],
        ].map(([label, desc]) => (
          <Bullet key={label}>
            <span className="font-semibold text-gray-900 dark:text-zinc-100">{label}:</span>{" "}
            {desc}
          </Bullet>
        ))}
      </ul>

      <Callout>
        <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">Practice Makes Perfect</p>
        <div className="space-y-1.5 text-sm text-gray-600 dark:text-zinc-400">
          <p><strong className="text-gray-900 dark:text-zinc-100">Beginner (1–10 fish):</strong> Focus on understanding anatomy and basic movements.</p>
          <p><strong className="text-gray-900 dark:text-zinc-100">Intermediate (10–50 fish):</strong> Work on consistency and reducing waste. Start developing rhythm.</p>
          <p><strong className="text-gray-900 dark:text-zinc-100">Advanced (50+ fish):</strong> Refine technique for speed while maintaining quality.</p>
        </div>
      </Callout>

      <InfoCard label="Waste Reduction Tips">
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">
          Save bones, heads, and belly flaps — don't discard them. These parts have value:
        </p>
        <ul className="space-y-1.5">
          {[
            ["Fish stock", "Bones and heads make excellent stock for soups and sauces"],
            ["Pet food", "Frames can be used for pet food"],
            ["Fertilizer", "Fish waste makes nitrogen-rich fertilizer"],
            ["Bait", "Belly flaps and scraps can be used for fishing bait"],
          ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
        </ul>
      </InfoCard>
    </Section>
  </div>
);

export default Module3Content;