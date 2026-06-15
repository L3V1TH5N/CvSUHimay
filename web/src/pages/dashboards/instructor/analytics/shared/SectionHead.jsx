const SectionHead = ({ label, info, onInfoClick }) => (
  <div className="ar-section-head">
    <span className="ar-section-label">{label}</span>
    {info && onInfoClick && (
      <button
        className="ar-section-info-btn"
        onClick={() => onInfoClick(info)}
        aria-label={`About ${label}`}
        title={`About ${label}`}
      >ℹ</button>
    )}
    <div className="ar-section-rule" />
  </div>
);

export default SectionHead;
