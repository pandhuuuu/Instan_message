import React from "react";

/**
 * Shared GroupAvatar component
 * Renders a consistent circular container with the Material Symbol 'groups' icon.
 */
const GroupAvatar = ({ size = 40, className = "", style = {} }) => (
  <div
    className={`rounded-full flex items-center justify-center shrink-0 select-none ${className}`}
    style={{
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      borderRadius: "50%",
      background: "#202c33",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#8696a0",
      border: "1px solid #2a3942",
      flexShrink: 0,
      ...style,
    }}
  >
    <span
      className="material-symbols-outlined"
      style={{ fontSize: Math.round(size * 0.54) }}
    >
      groups
    </span>
  </div>
);

export default GroupAvatar;
