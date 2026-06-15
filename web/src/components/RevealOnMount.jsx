import { useEffect, useRef } from "react";

export default function RevealOnMount({ children, className = "", style = {}, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    // Add the reveal animation only on mount, then remove it so later
    // class changes (like shake) won't retrigger the entrance animation.
    el.classList.add("anim-fade-up");

    const onAnimEnd = (e) => {
      try {
        const name = (e.animationName || "").toString().toLowerCase();
        if (name.includes("fade") || name.includes("fadeup") || name.includes("featurein")) {
          el.classList.remove("anim-fade-up");
          el.style.removeProperty("animation-delay");
        }
      } catch (err) {
        // ignore
      }
    };

    el.addEventListener("animationend", onAnimEnd);
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.classList.remove("anim-fade-up");
        ref.current.style.removeProperty("animation-delay");
      }
    }, 900);

    return () => {
      clearTimeout(t);
      el.removeEventListener("animationend", onAnimEnd);
    };
  }, []);

  return (
    <div ref={ref} className={className} style={style} {...rest}>
      {children}
    </div>
  );
}
