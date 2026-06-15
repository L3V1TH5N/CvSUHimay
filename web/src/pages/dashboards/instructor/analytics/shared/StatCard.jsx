import { Info } from "lucide-react";

// Clickable stat cell. When `info` is provided the cell is interactive and
// calls onInfoClick(info) on click/Enter. Without info it renders as a plain div.
const StatCard = ({ value, label, sub, accent, info, onInfoClick }) => (
  <div
    className="ar-stat-cell"
    onClick={() => info && onInfoClick?.(info)}
    role={info ? "button" : undefined}
    tabIndex={info ? 0 : undefined}
    onKeyDown={(e) => e.key === "Enter" && info && onInfoClick?.(info)}
  >
    {info && (
      <div className="ar-stat-info-icon">
        <Info size={11} />
      </div>
    )}
    <span className={`ar-stat-value${accent ? " ar-stat-value--accent" : ""}`}>
      {value}
    </span>
    <span className="ar-stat-label">{label}</span>
    {sub && <span className="ar-stat-sub">{sub}</span>}
  </div>
);

export default StatCard;
