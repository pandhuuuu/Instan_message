import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { ChatState } from "../../Context/ChatProvider";
import { getUserPresence, getStatusColor, formatLastSeen } from "../../config/userStatus";

const ProfileModal = ({ user, children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { onlineUsers, user: loggedUser, myStatus } = ChatState();

  const isMe = loggedUser?._id === user?._id;
  const presence = isMe
    ? { status: myStatus, lastSeen: null }
    : getUserPresence(user, onlineUsers);

  return (
    <>
      {children ? (
        <span onClick={onOpen} style={{ cursor: "pointer" }}>{children}</span>
      ) : (
        <button
          onClick={onOpen}
          title="View Profile"
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "inline-flex", alignItems: "center",
            color: "#918fa1", padding: "2px",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#c3c0ff"}
          onMouseLeave={e => e.currentTarget.style.color = "#918fa1"}>
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>info</span>
        </button>
      )}

      <Modal isLazy size="sm" onClose={onClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent style={{ background: "#171f33", border: "1px solid #464555", borderRadius: "1rem", color: "#dae2fd" }}>
          <ModalHeader
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "18px", fontWeight: "700",
              color: "#dae2fd",
              borderBottom: "1px solid rgba(70,69,85,0.5)",
              textAlign: "center",
            }}>
            {user.name}
          </ModalHeader>
          <ModalCloseButton style={{ color: "#918fa1" }} />

          <ModalBody style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", padding: "28px 24px" }}>
            {/* Avatar */}
            {user.pic ? (
              <img
                src={user.pic}
                alt={user.name}
                style={{
                  width: 100, height: 100, borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid #4f46e5",
                  boxShadow: "0 0 0 4px rgba(79,70,229,0.2)",
                }}
              />
            ) : (
              <div style={{
                width: 100, height: 100, borderRadius: "50%",
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: "800", fontSize: "40px",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                boxShadow: "0 0 0 4px rgba(79,70,229,0.2)",
              }}>
                {user.name?.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Presence status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${getStatusColor(presence.status)}40`,
              }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: getStatusColor(presence.status),
                boxShadow: presence.status === "online" ? "0 0 8px rgba(16,185,129,0.8)" : "none",
                display: "inline-block"
              }} />
              <span style={{ fontSize: "12px", color: getStatusColor(presence.status), fontWeight: "600" }}>
                {presence.status === "online" ? "Online now" : presence.status === "away" ? "Away" : "Offline"}
              </span>
            </div>

            {/* Last Seen info if offline */}
            {presence.status === "offline" && presence.lastSeen && (
              <div style={{ fontSize: "11.5px", color: "#918fa1", marginTop: "-12px" }}>
                Last seen: {formatLastSeen(presence.lastSeen)}
              </div>
            )}

            {/* Username */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "#222a3d", borderRadius: "0.75rem",
              padding: "12px 16px", width: "100%",
              border: "1px solid rgba(70,69,85,0.5)",
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#4f46e5" }}>alternate_email</span>
              <div>
                <div style={{ fontSize: "11px", color: "#918fa1", marginBottom: "2px" }}>Username</div>
                <div style={{ fontSize: "14px", color: "#c3c0ff", fontWeight: "600" }}>@{user.username || user.name}</div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter style={{ borderTop: "1px solid rgba(70,69,85,0.3)", justifyContent: "center" }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 24px", borderRadius: "0.75rem",
                background: "rgba(70,69,85,0.4)", border: "1px solid rgba(70,69,85,0.6)",
                color: "#dae2fd", fontSize: "13px", fontWeight: "600",
                cursor: "pointer", transition: "all 0.15s",
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(70,69,85,0.6)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(70,69,85,0.4)"}>
              Close
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ProfileModal;
