import React, { useState } from "react";
import { hasCustomAvatar, getAvatarInitial, getAvatarBgColor } from "../../config/avatarUtils";

/**
 * Universal Avatar component:
 * - If user has custom uploaded photo: renders <img> with automatic fallback on load error.
 * - If no photo / placeholder: automatically renders initial letter of username with sleek circular background.
 */
const UserAvatar = ({
  user,
  name,
  username,
  pic,
  size = 40,
  style = {},
  className = "",
  fontSize,
  fontWeight = "600",
  onClick,
  title,
}) => {
  const [imgError, setImgError] = useState(false);

  // Extract properties from user object or individual props
  const resolvedPic = pic !== undefined ? pic : (user?.pic || "");
  const resolvedUsername = username || user?.username || "";
  const resolvedName = name || user?.name || "";
  const userIdentifier = { username: resolvedUsername, name: resolvedName };

  const hasValidPic = hasCustomAvatar(resolvedPic);
  const initial = getAvatarInitial(userIdentifier);
  const bgColor = getAvatarBgColor(userIdentifier);

  const finalFontSize = fontSize || Math.round(size * 0.42);

  if (hasValidPic && !imgError) {
    return (
      <img
        src={resolvedPic}
        alt={resolvedUsername || resolvedName || "Avatar"}
        title={title || resolvedUsername || resolvedName}
        onClick={onClick}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "block",
          ...style,
        }}
      />
    );
  }

  return (
    <div
      title={title || resolvedUsername || resolvedName}
      onClick={onClick}
      className={`rounded-full flex items-center justify-center shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: "50%",
        background: bgColor,
        color: "#ffffff",
        fontWeight: fontWeight,
        fontSize: finalFontSize,
        fontFamily: "'Segoe UI', 'Helvetica Neue', 'Inter', -apple-system, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.15)",
        ...style,
      }}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;
