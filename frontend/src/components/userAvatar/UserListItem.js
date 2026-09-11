import { getStatusColor, getStatusLabel } from "../../config/userStatus";
import UserAvatar from "./UserAvatar";

const UserListItem = ({ user, handleFunction, presence }) => {
  const currentPresence = presence || {
    status: user.status || "offline",
    lastSeen: user.lastSeen || null,
  };

  return (
    <div
      onClick={handleFunction}
      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 animate-fade-in"
      style={{ borderBottom: "1px solid rgba(70,69,85,0.25)" }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(79,70,229,0.08)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

      {/* Avatar with Presence dot */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <UserAvatar user={user} size={40} />
        <span
          title={`Status: ${currentPresence.status}`}
          style={{
            position: "absolute", bottom: -1, right: -1,
            width: 10, height: 10, borderRadius: "50%",
            background: getStatusColor(currentPresence.status),
            border: "2px solid #171f33",
            boxShadow: currentPresence.status === "online" ? "0 0 5px rgba(16,185,129,0.5)" : "none",
          }}
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span style={{
            fontSize: "14px", fontWeight: "600", color: "#dae2fd",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {user.name}
          </span>
          <span style={{
            fontSize: "11px",
            color: getStatusColor(currentPresence.status),
            fontWeight: "500",
            whiteSpace: "nowrap",
          }}>
            {currentPresence.status === "online" ? "Online" : currentPresence.status === "away" ? "Away" : "Offline"}
          </span>
        </div>
        <div style={{
          fontSize: "12px", color: "#918fa1",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {getStatusLabel(currentPresence.status, currentPresence.lastSeen)}
        </div>
      </div>

      {/* Start chat icon */}
      <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#4f46e5", flexShrink: 0 }}>
        chat_bubble_outline
      </span>
    </div>
  );
};

export default UserListItem;
