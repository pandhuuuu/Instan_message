/**
 * Avatar Utilities for Instant Messaging
 * Provides reliable fallback to username initial when custom profile photo is not provided.
 */

// Palette of modern, accessible WhatsApp-inspired hues
const AVATAR_BG_COLORS = [
  "#005c4b", // WhatsApp Deep Teal
  "#128c7e", // WhatsApp Classic Teal
  "#00a884", // WhatsApp Mint Accent
  "#075e54", // WhatsApp Dark Green
  "#0284c7", // Sky Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Purple
  "#d97706", // Amber
  "#0d9488", // Teal 600
  "#059669", // Emerald 600
  "#2563eb", // Blue 600
  "#dc2626", // Rose 600
];

/**
 * Checks if a user has a valid custom uploaded profile picture
 * Filters out empty values and legacy default placeholder links
 */
export const hasCustomAvatar = (pic) => {
  if (!pic || typeof pic !== "string") return false;
  const trimmed = pic.trim();
  if (!trimmed) return false;
  if (
    trimmed.includes("anonymous-avatar-icon") ||
    trimmed.includes("icon-library.com") ||
    trimmed.includes("default-avatar")
  ) {
    return false;
  }
  return true;
};

/**
 * Returns the uppercase initial of the username (prioritized) or name
 * As per specification: "seperti abjad awal dari username"
 */
export const getAvatarInitial = (userOrName, fallback = "?") => {
  if (!userOrName) return fallback;

  if (typeof userOrName === "string") {
    const clean = userOrName.trim();
    return clean ? clean.charAt(0).toUpperCase() : fallback;
  }

  // Prioritize username first, then name
  const username = userOrName.username && typeof userOrName.username === "string" ? userOrName.username.trim() : "";
  if (username) {
    return username.charAt(0).toUpperCase();
  }

  const name = userOrName.name && typeof userOrName.name === "string" ? userOrName.name.trim() : "";
  if (name) {
    return name.charAt(0).toUpperCase();
  }

  return fallback;
};

/**
 * Derives a consistent, visually pleasing background color for the avatar initial
 */
export const getAvatarBgColor = (userOrName) => {
  if (!userOrName) return AVATAR_BG_COLORS[0];

  let str = "";
  if (typeof userOrName === "string") {
    str = userOrName.trim().toLowerCase();
  } else {
    str = (userOrName.username || userOrName.name || "").trim().toLowerCase();
  }

  if (!str) return AVATAR_BG_COLORS[0];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % AVATAR_BG_COLORS.length;
  return AVATAR_BG_COLORS[index];
};
