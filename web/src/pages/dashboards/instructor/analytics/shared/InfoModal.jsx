import { useEffect } from "react";
import { X } from "lucide-react";

const InfoModal = ({ info, onClose }) => {
  useEffect(() => {
    if (!info) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [info, onClose]);

  if (!info) return null;

  return (
    <div className="ar-modal-overlay" onClick={onClose}>
      <div className="ar-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ar-modal-header">
          <span className="ar-modal-title">{info.title}</span>
          <button className="ar-modal-close" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="ar-modal-body">
          <div className="ar-modal-section">
            <span className="ar-modal-section-label">About</span>
            <p className="ar-modal-text">{info.description}</p>
          </div>
          <div className="ar-modal-section">
            <span className="ar-modal-section-label">Purpose</span>
            <p className="ar-modal-text">{info.purpose}</p>
          </div>
          <div className="ar-modal-section">
            <span className="ar-modal-section-label">How to read this</span>
            <p className="ar-modal-text">{info.guide}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
