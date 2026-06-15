// File path: web/src/pages/dashboards/student/modules/Module2Content.jsx

const Section = ({ id, children }) => <section id={id} className="mb-10 scroll-mt-24">{children}</section>;

const Callout = ({ children }) => (
  <div className="border-l-2 border-[#04510e] dark:border-green-500 pl-4 py-1 my-5 bg-[#04510e]/4 dark:bg-[#04510e]/10 rounded-r-lg">
    {children}
  </div>
);

const InfoCard = ({ label, children }) => (
  <div className="bg-[color:var(--color-surface-2)] border hairline rounded-xl p-4">
    {label && <p className="text-[11px] font-semibold uppercase tracking-widest ink-faint mb-1.5">{label}</p>}
    {children}
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b hairline last:border-0">
    <span className="text-sm ink-muted">{label}</span>
    <span className="text-sm font-medium ink text-right">{value}</span>
  </div>
);

const Bullet = ({ children }) => (
  <li className="flex items-start gap-2.5 text-sm ink-muted leading-relaxed">
    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#04510e] dark:bg-green-500 flex-shrink-0" />
    <span>{children}</span>
  </li>
);

const H2 = ({ children }) => <h2 className="font-outfit text-xl ink mb-3 mt-0">{children}</h2>;
const H3 = ({ children }) => <h3 className="font-outfit text-base ink mb-2 mt-5">{children}</h3>;

// ─── Module 2 Content ───────────────────────────────────────────────────
const Module2Content = () => (
  <div className="space-y-0">

    <Section id="drawn-fish">
      <H2>1. Ways of Preparing Fish</H2>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        The methods of preparing "wet" whole or round fish (fish which has not been gutted or the
        viscera removed) either for chilling, freezing, or processing vary according to the specific
        requirements of the user. Each method serves different purposes and markets, from simple home
        preparation to complex commercial applications.
      </p>
      <Callout>
        <p className="text-sm font-medium ink mb-1">Why Different Preparations Matter</p>
        <p className="text-sm ink-muted leading-relaxed">
          Different fish preparations optimize the product for specific cooking methods, consumer
          preferences, storage requirements, and market demands. The right preparation method
          enhances both culinary quality and economic value.
        </p>
      </Callout>

      <H3>Drawn Fish (Gutted)</H3>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        Fish that has been eviscerated or the entrails removed. This is the most basic preparation
        method where only the internal organs are removed while keeping the fish otherwise intact.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <InfoCard label="Characteristics">
          <ul className="space-y-1.5 mt-1">
            {[["Head","Remains attached"],["Tail","Remains attached"],["Scales","May or may not be removed"],["Fins","Remain in place"],["Viscera","Only internal organs removed"]].map(([k,v])=><Row key={k} label={k} value={v}/>)}
          </ul>
        </InfoCard>
        <InfoCard label="Processing Steps">
          <ul className="space-y-1.5 mt-1">
            {[["1","Cut from vent to gill opening"],["2","Remove all internal organs"],["3","Scrape out remaining material"],["4","Rinse with clean, cold water"],["5","Pat dry before storage"]].map(([k,v])=><Row key={k} label={k} value={v}/>)}
          </ul>
        </InfoCard>
      </div>

      <H3>Best Uses for Drawn Fish</H3>
      <ul className="space-y-2">
        {["Traditional cooking methods (grilling, steaming)","Whole fish presentations in restaurants","Asian-style preparations where the head is prized","Fish soups and stocks (bones add flavor)","Storage and transport (maintains fish shape)"].map(item=><Bullet key={item}>{item}</Bullet>)}
      </ul>
    </Section>

    <Section id="dressed-fish">
      <H2>2. Dressed Fish</H2>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        Fish with scales, viscera, fins, head and tail removed. This preparation makes the fish
        ready to cook, and is particularly clean, easy to handle, and suitable for most cooking methods.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <InfoCard label="What's Removed">
          <ul className="space-y-1.5 mt-1">
            {[["Scales","Completely scraped off"],["Viscera","Internal organs"],["Fins","All fins trimmed"],["Head","Completely removed"],["Tail","Cut off"]].map(([k,v])=><Row key={k} label={k} value={v}/>)}
          </ul>
        </InfoCard>
        <InfoCard label="Market Applications">
          <ul className="space-y-2 mt-1">
            {["Supermarket fish counters","Home cooking (pan-frying, baking, grilling)","Restaurant prep kitchens","Catering services"].map(item=><Bullet key={item}>{item}</Bullet>)}
          </ul>
        </InfoCard>
      </div>
      <H3>Advantages of Dressed Fish</H3>
      <ul className="space-y-2">
        {["Maximum convenience for consumers","No waste parts to handle","Uniform appearance for retail display","Easier portion control and pricing","Reduces preparation time in kitchens"].map(item=><Bullet key={item}>{item}</Bullet>)}
      </ul>
    </Section>

    <Section id="steaks">
      <H2>3. Steaks</H2>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        Cross-section slices of a large, dressed fish, cut perpendicular to the backbone and typically <strong className="ink">2–3 cm thick</strong>. This preparation is ideal for large fish species.
      </p>
      <InfoCard label="Characteristics">
        <ul className="space-y-1.5 mt-1">
          {[["Center","Contains a section of backbone"],["Thickness","Uniform 2–3 cm standard"],["Shape","Round or oval depending on anatomy"],["Skin","Included around the perimeter"],["Sides","Both sides of flesh mirror each other"]].map(([k,v])=><Row key={k} label={k} value={v}/>)}
        </ul>
      </InfoCard>
      <H3>Best Fish for Steaks</H3>
      <ul className="space-y-2 mb-5">
        {["Tuna — excellent for grilling","Salmon — popular for all cooking methods","Swordfish — firm texture holds up well","Mahi-mahi — sweet flavor, great grilled","Halibut — lean and mild","Large grouper — firm and meaty"].map(item=><Bullet key={item}>{item}</Bullet>)}
      </ul>
      <H3>Cooking Methods</H3>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {[["Grilling","Perfect for steaks — hold shape well on the grill"],["Pan-Searing","High heat creates a nice crust"],["Broiling","Even thickness cooks uniformly"],["Baking","Gentle method for delicate steaks"]].map(([label,desc])=>(
          <InfoCard key={label} label={label}><p className="text-sm ink-muted">{desc}</p></InfoCard>
        ))}
      </div>
      <Callout>
        <p className="text-sm ink-muted">
          Steaks are popular because their uniform size ensures even cooking, the bone adds flavor during cooking, and they are easy to handle, turn, and portion.
        </p>
      </Callout>
    </Section>

    <Section id="fillets">
      <H2>4. Fillets</H2>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        The meaty sides of the fish removed from the backbone and ribs. Fillets are practically boneless and represent the most popular form of fish preparation in modern markets.
      </p>
      <H3>Types of Fillets</H3>
      <div className="space-y-3 mb-5">
        {[["Butterfly Fillet (Block or Double)","Formed by both sides of the fish, still joined by the uncut flesh and skin of the belly. Opens like a book. Perfect for stuffing or even cooking."],["Cross-cut Fillet","Fillets from flat fish (e.g., sole, flounder) taken from each side as a single piece. Flat fish have a different anatomy with four fillets possible."],["Quarter-cut Fillet","The flesh from each side taken off in two pieces. Used when larger fish are divided for better portion control, separating dorsal and ventral portions."],["Single Fillet","Just one side of the fish, completely separated. The most common fillet type for round fish like salmon, bass, and cod. Each fish yields two single fillets."]].map(([name,desc])=>(
          <div key={name} className="flex gap-3 items-start"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#04510e] dark:bg-green-500 flex-shrink-0" /><p className="text-sm ink-muted"><span className="font-semibold ink">{name}: </span>{desc}</p></div>
        ))}
      </div>
      <InfoCard label="Skin-On vs. Skinless">
        <ul className="space-y-1.5 mt-1">
          {[["Skin-On","Holds fillet together during cooking, adds flavor, creates crispy texture when seared"],["Skinless","More elegant presentation, easier to eat, preferred by many consumers"]].map(([k,v])=><Row key={k} label={k} value={v}/>)}
        </ul>
      </InfoCard>
    </Section>

    <Section id="sticks-portions">
      <H2>5. Sticks and Portions</H2>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        Small elongated chunks (rectangles) of uniform size cut from the meaty fillet portion. These are standardized pieces designed for consistency in commercial food service and processed fish products.
      </p>
      <InfoCard label="Specifications">
        <ul className="space-y-1.5 mt-1">
          {[["Shape","Uniform rectangular"],["Thickness","Consistent throughout"],["Size","e.g., 3 cm × 8 cm × 1 cm for sticks"],["Bones","Cut from boneless fillet sections"],["Skin","Usually skinless"]].map(([k,v])=><Row key={k} label={k} value={v}/>)}
        </ul>
      </InfoCard>
      <H3>Commercial Applications</H3>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {[["Fast Food","Fish sandwiches, fish & chips, quick-service restaurants"],["Fish Fingers / Sticks","Breaded and frozen retail products for home cooking"],["Fish Nuggets","Smaller portions, often in fun shapes for children"],["Institutional Catering","Schools, hospitals, airlines — precise portion control"]].map(([label,desc])=>(
          <InfoCard key={label} label={label}><p className="text-sm ink-muted">{desc}</p></InfoCard>
        ))}
      </div>
      <H3>Benefits of Standardization</H3>
      <ul className="space-y-2">
        {["Consistent cooking times across batches","Predictable food costs for commercial operations","Easy inventory management","Uniform product quality for consumers","Efficient breading and battering processes","Reduced waste in commercial operations"].map(item=><Bullet key={item}>{item}</Bullet>)}
      </ul>
    </Section>

    <Section id="quality-maintenance">
      <H2>6. Preparation Selection Guide</H2>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        The choice of preparation method should match both the fish species and the intended cooking method.
      </p>
      <InfoCard>
        {[["Drawn Fish","Whole fish presentations, traditional cooking","Beginner","~75%"],["Dressed Fish","Home cooking, retail markets","Intermediate","~65%"],["Steaks","Grilling, large firm fish","Intermediate","~60%"],["Fillets","Versatile, boneless preference","Advanced","35–45%"],["Sticks / Portions","Fast food, breaded products","Professional","30–40%"]].map(([prep,use,skill,yield_])=>(
          <div key={prep} className="flex flex-wrap items-start justify-between gap-2 py-2 border-b hairline last:border-0">
            <span className="text-sm font-semibold ink w-28 flex-shrink-0">{prep}</span>
            <span className="text-sm ink-muted flex-1 min-w-0">{use}</span>
            <span className="text-sm ink-muted w-24 text-right flex-shrink-0">{skill}</span>
            <span className="text-sm font-medium ink w-14 text-right flex-shrink-0">{yield_}</span>
          </div>
        ))}
      </InfoCard>
      <Callout>
        <p className="text-sm font-medium ink mb-1">Pro Tip: Choosing the Right Preparation</p>
        <ul className="space-y-1 mt-2">
          {["Large fish with firm flesh → Steaks work excellently","Medium fish for versatility → Fillets offer maximum options","Small whole fish → Drawn or dressed for traditional presentations","Commercial applications → Sticks and portions for consistency"].map(item=><Bullet key={item}>{item}</Bullet>)}
        </ul>
      </Callout>
      <H3>Quality Maintenance Guidelines</H3>
      <p className="text-sm ink-muted leading-relaxed mb-4">
        Regardless of the preparation method chosen, maintaining quality is essential throughout the process.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {[["Temperature Control",["Work with properly chilled fish (0–4°C)","Process in a cool environment","Return to cold storage immediately","Never leave at room temperature"]],["Hygiene Standards",["Use clean, sanitized equipment","Wash hands frequently","Separate raw and processed areas","Clean as you work"]],["Tool Maintenance",["Keep knives sharp for clean cuts","Use appropriate cutting boards","Sanitize between different fish","Replace worn tools promptly"]],["Speed & Efficiency",["Minimize handling time","Process quickly but carefully","Reduce exposure to warm air","Work in an organized manner"]]].map(([label,items])=>(
          <InfoCard key={label} label={label}><ul className="space-y-1.5 mt-1">{items.map(item=><Bullet key={item}>{item}</Bullet>)}</ul></InfoCard>
        ))}
      </div>
    </Section>
  </div>
);

export default Module2Content;