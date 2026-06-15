// web/src/components/ScaleMotif.jsx
import React from 'react';

const ScaleMotif = ({ size = 56, opacity = 1 }) => {
  const id = React.useId();
  return (
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', color: 'var(--color-fg)', opacity: 0.035, zIndex: 0 }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width={size} height={size * 0.62} patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="0.7">
            <path d={`M${-size / 2} ${size * 0.62} a${size / 2} ${size / 2} 0 0 1 ${size} 0`} />
            <path d={`M0 ${size * 0.62} a${size / 2} ${size / 2} 0 0 1 ${size} 0`} />
            <path d={`M${size / 2} ${size * 0.62} a${size / 2} ${size / 2} 0 0 1 ${size} 0`} />
            <path d={`M${-size / 4} ${size * 0.31} a${size / 2} ${size / 2} 0 0 1 ${size} 0`} />
            <path d={`M${size * 0.75} ${size * 0.31} a${size / 2} ${size / 2} 0 0 1 ${size} 0`} />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
};

export default ScaleMotif;