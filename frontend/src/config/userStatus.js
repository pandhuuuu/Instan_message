/**
 * Formats last seen timestamp into human-readable English text
 */
export const formatLastSeen = (dateInput) => {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    const timeString = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `today at ${timeString}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeString = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isYesterday) {
    return `yesterday at ${timeString}`;
  }

  const dateString = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${dateString} at ${timeString}`;
};

/**
 * Retrieves user presence status and lastSeen from onlineUsers state or user object
 */
export const getUserPresence = (userObj, onlineUsers = {}) => {
  if (!userObj || !userObj._id) {
    return { status: "offline", lastSeen: null };
  }

  const idStr = String(userObj._id);
  const live = onlineUsers && onlineUsers[idStr];
  if (live) {
    return {
      status: live.status || "online",
      lastSeen: live.lastSeen || userObj.lastSeen || null,
    };
  }

  return {
    status: userObj.status || "offline",
    lastSeen: userObj.lastSeen || null,
  };
};

/**
 * Gets color code corresponding to presence status
 */
export const getStatusColor = (status) => {
  switch (status) {
    case "online":
      return "#10b981"; // Emerald Green
    case "away":
      return "#f59e0b"; // Amber / Gold
    case "offline":
    default:
      return "#6b7280"; // Muted Gray
  }
};

/**
 * Gets user-friendly presence label for display in UI
 */
export const getStatusLabel = (status, lastSeen) => {
  switch (status) {
    case "online":
      return "Online";
    case "away":
      return "Away";
    case "offline":
    default:
      return lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : "Offline";
  }
};
