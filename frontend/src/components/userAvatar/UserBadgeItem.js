const UserBadgeItem = ({ user, handleFunction, admin }) => {
  return (
    <span
      onClick={handleFunction}
      className="inline-flex items-center gap-1.5 cursor-pointer transition-all duration-150"
      style={{
        margin: "3px",
        padding: "4px 10px 4px 8px",
        borderRadius: "9999px",
        background: "rgba(79,70,229,0.2)",
        border: "1px solid rgba(79,70,229,0.4)",
        color: "#c3c0ff",
        fontSize: "12px",
        fontWeight: "600",
        fontFamily: "'Inter', sans-serif",
        userSelect: "none",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "rgba(239,68,68,0.15)";
        e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
        e.currentTarget.style.color = "#fca5a5";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "rgba(79,70,229,0.2)";
        e.currentTarget.style.borderColor = "rgba(79,70,229,0.4)";
        e.currentTarget.style.color = "#c3c0ff";
      }}>
      {/* Mini avatar dot */}
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: "8px", fontWeight: "700", color: "#fff",
        flexShrink: 0,
      }}>
        {user.name?.charAt(0).toUpperCase()}
      </span>
      {user.name}
      {admin?._id === user._id && (
        <span style={{ fontSize: "10px", color: "#10b981", fontWeight: "600", marginLeft: "2px" }}>(Admin)</span>
      )}
      <span style={{ fontSize: "14px", lineHeight: 1 }}>×</span>
    </span>
  );
};

export default UserBadgeItem;
