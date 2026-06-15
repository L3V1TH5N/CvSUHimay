// file path: web/src/simulation/components/ui/DisclaimerModal.jsx

import './DisclaimerModal.css';
import { useEffect, useState } from "react";

const STORAGE_KEY = "himay_disclaimer_seen";

const POINTS = [
  {
    icon: "✦",
    title: "The fish looks simplified.",
    body: "The 3D bangus is a lightweight model built to run smoothly on any school computer. It won't look photorealistic — that's intentional.",
  },
  {
    icon: "✦",
    title: "The procedure is accurate.",
    body: "Every step, bone location, and tool interaction follows the actual FASD deboning curriculum. Focus on the process, not the visuals.",
  },
];

const DisclaimerModal = ({ onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <div
      className="disc-overlay"
      aria-modal="true"
      role="dialog"
      aria-labelledby="disclaimer-title"
    >
      <div className="disc-panel">

        <div className="disc-eyebrow">CvSUHimay · Fish Deboning Simulator</div>

        <h2 id="disclaimer-title" className="disc-heading">
          You're almost in.
        </h2>

        <p className="disc-subtitle">A quick note before your first session.</p>

        <div className="disc-points">
          {POINTS.map(({ icon, title, body }) => (
            <div key={title} className="disc-point">
              <span className="disc-point-icon">{icon}</span>
              <div>
                <div className="disc-point-title">{title}</div>
                <div className="disc-point-body">{body}</div>
              </div>
            </div>
          ))}
        </div>

        <button className="disc-cta" onClick={dismiss}>
          Got it — start practising
        </button>

      </div>
    </div>
  );
};

export default DisclaimerModal;
