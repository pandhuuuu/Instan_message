import React from "react";
import ScrollableFeed from "react-scrollable-feed";
import axios from "axios";
import {
  isLastMessage,
  isSameSender,
  isSameUser,
} from "../config/ChatLogics";
import { ChatState } from "../Context/ChatProvider";

const ScrollableChat = ({ messages, onDeleteMessage }) => {
  const { user, selectedChat, socket } = ChatState();

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getMessageStatus = (message) => {
    const isGroup = selectedChat?.isGroupChat;
    const readBy = message.readBy || [];
    const deliveredTo = message.deliveredTo || [];
    const myId = user?._id ? String(user._id) : "";

    if (isGroup) {
      const readersOtherThanMe = readBy.filter((u) => String(u._id || u) !== myId);
      if (readersOtherThanMe.length > 0) return "read";
      const deliveredOtherThanMe = deliveredTo.filter((u) => String(u._id || u) !== myId);
      if (deliveredOtherThanMe.length > 0) return "delivered";
      return "sent";
    } else {
      const recipient = selectedChat?.users?.find((u) => String(u._id || u) !== myId);
      const recipientId = recipient ? String(recipient._id || recipient) : "";

      if (recipientId && readBy.some((u) => String(u._id || u) === recipientId)) {
        return "read";
      }
      if (recipientId && deliveredTo.some((u) => String(u._id || u) === recipientId)) {
        return "delivered";
      }
      return "sent";
    }
  };

  return (
    <ScrollableFeed>
      {messages &&
        messages.map((m, i) => {
          if (m.isSystemMessage) {
            let iconName = "info";
            if (m.systemMessageType === "add") iconName = "person_add";
            else if (m.systemMessageType === "remove") iconName = "person_remove";
            else if (m.systemMessageType === "leave") iconName = "logout";
            else if (m.systemMessageType === "rename") iconName = "edit";
            else if (m.systemMessageType === "promote") iconName = "shield_person";
            else if (m.systemMessageType === "demote") iconName = "remove_moderator";
            else if (m.systemMessageType === "create") iconName = "group_add";

            return (
              <div
                key={m._id}
                className="flex items-center justify-center w-full my-3"
                style={{ padding: "0 12px" }}>
                <div
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full"
                  style={{
                    background: "rgba(23, 31, 51, 0.85)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                    backdropFilter: "blur(6px)",
                    maxWidth: "88%",
                  }}>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px", color: "#818cf8", flexShrink: 0 }}>
                    {iconName}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#c3c0ff",
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: "500",
                      textAlign: "center",
                      wordBreak: "break-word",
                      lineHeight: "1.4",
                    }}>
                    {m.content}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#6b7280",
                      fontFamily: "'Inter', sans-serif",
                      marginLeft: "4px",
                      flexShrink: 0,
                    }}>
                    {formatTime(m.createdAt)}
                  </span>
                </div>
              </div>
            );
          }

          const isMyMessage = m.sender?._id === user._id;
          const isGroup = selectedChat?.isGroupChat;
          const isOwner = isGroup && String(selectedChat.groupAdmin?._id || selectedChat.groupAdmin) === String(user._id);
          const isAdmin = isGroup && selectedChat.groupAdmins?.some((a) => String(a._id || a) === String(user._id));
          const canDelete = isMyMessage || isOwner || isAdmin;
          const showAvatar = isSameSender(messages, m, i, user._id) || isLastMessage(messages, i, user._id);
          const isFirstInSequence = !isSameUser(messages, m, i, user._id);
          const marginTop = isFirstInSequence ? "12px" : "2px";

          const handleDeleteMsg = async (e) => {
            e.stopPropagation();
            if (window.confirm("Delete this message for everyone?")) {
              try {
                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                await axios.delete(`/api/message/${m._id}`, config);
                socket?.emit("delete message", { messageId: m._id, chatId: selectedChat._id });
                if (onDeleteMessage) {
                  onDeleteMessage(m._id);
                }
              } catch (err) {
                console.error("Failed to delete message:", err);
              }
            }
          };

          return (
            <div
              key={m._id}
              className="flex items-end w-full group relative"
              style={{
                marginTop,
                justifyContent: isMyMessage ? "flex-end" : "flex-start",
                paddingLeft: isMyMessage ? "20%" : "0",
                paddingRight: isMyMessage ? "0" : "20%",
              }}>

              {/* ── Delete Button for My Message ── */}
              {isMyMessage && canDelete && (
                <button
                  onClick={handleDeleteMsg}
                  title="Delete message"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#918fa1",
                    padding: "4px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "6px",
                    marginBottom: "4px",
                    alignSelf: "flex-end",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ef4444";
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#918fa1";
                    e.currentTarget.style.background = "none";
                  }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    delete
                  </span>
                </button>
              )}

              {/* ── Sender Avatar ── */}
              {!isMyMessage && (
                <div style={{ width: 28, marginRight: 6, flexShrink: 0, marginBottom: 2 }}>
                  {showAvatar ? (
                    <div title={m.sender.name}>
                      {m.sender.pic ? (
                        <img
                          src={m.sender.pic}
                          alt={m.sender.name}
                          style={{
                            width: 28, height: 28, borderRadius: "50%",
                            objectFit: "cover", cursor: "pointer",
                            border: "2px solid rgba(70,69,85,0.5)",
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#fff", fontWeight: "700", fontSize: "11px",
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          cursor: "pointer",
                        }}>
                          {m.sender.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* ── Message Bubble ── */}
              <div style={{
                maxWidth: "100%",
                padding: isMyMessage
                  ? "8px 12px 6px 14px"
                  : "8px 14px 6px 12px",
                borderRadius: isMyMessage
                  ? "1.25rem 1.25rem 0.25rem 1.25rem"
                  : "1.25rem 1.25rem 1.25rem 0.25rem",
                background: isMyMessage
                  ? "linear-gradient(135deg, #4f46e5, #5b52f0)"
                  : "#2d3449",
                color: isMyMessage ? "#fff" : "#dae2fd",
                boxShadow: isMyMessage
                  ? "0 3px 10px rgba(79,70,229,0.25)"
                  : "0 2px 6px rgba(0,0,0,0.15)",
                border: isMyMessage
                  ? "none"
                  : "1px solid rgba(255,255,255,0.06)",
                position: "relative",
              }}>

                {/* Sender name in group chats */}
                {!isMyMessage && isFirstInSequence && (
                  <div style={{
                    fontSize: "11.5px", fontWeight: "600",
                    color: "#c3c0ff", marginBottom: "3px",
                    fontFamily: "'Inter', sans-serif",
                  }}>
                    {m.sender.name}
                  </div>
                )}

                {/* Message text */}
                <div style={{ fontSize: "14px", lineHeight: "1.5", wordBreak: "break-word" }}>
                  {m.content}
                </div>

                {/* Timestamp & Message Status */}
                <div style={{
                  fontSize: "10.5px",
                  color: isMyMessage ? "rgba(255,255,255,0.7)" : "#918fa1",
                  textAlign: "right",
                  marginTop: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "2px",
                  fontVariantNumeric: "tabular-nums",
                  fontFamily: "'Inter', sans-serif",
                }}>
                  <span>{formatTime(m.createdAt)}</span>
                  {isMyMessage && (() => {
                    const status = getMessageStatus(m);
                    if (status === "read") {
                      return (
                        <span
                          title="Read"
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "15px",
                            color: "#38bdf8",
                            textShadow: "0 0 6px rgba(56, 189, 248, 0.6)",
                            marginLeft: "3px",
                            verticalAlign: "middle",
                            display: "inline-flex",
                            lineHeight: 1,
                            cursor: "default",
                          }}>
                          done_all
                        </span>
                      );
                    } else if (status === "delivered") {
                      return (
                        <span
                          title="Delivered"
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "15px",
                            color: "rgba(255, 255, 255, 0.7)",
                            marginLeft: "3px",
                            verticalAlign: "middle",
                            display: "inline-flex",
                            lineHeight: 1,
                            cursor: "default",
                          }}>
                          done_all
                        </span>
                      );
                    } else {
                      return (
                        <span
                          title="Sent"
                          className="material-symbols-outlined"
                          style={{
                            fontSize: "14px",
                            color: "rgba(255, 255, 255, 0.55)",
                            marginLeft: "3px",
                            verticalAlign: "middle",
                            display: "inline-flex",
                            lineHeight: 1,
                            cursor: "default",
                          }}>
                          check
                        </span>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* ── Delete Button for Incoming Message (Admin/Owner only) ── */}
              {!isMyMessage && canDelete && (
                <button
                  onClick={handleDeleteMsg}
                  title="Delete message (Admin)"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#918fa1",
                    padding: "4px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "6px",
                    marginBottom: "4px",
                    alignSelf: "flex-end",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ef4444";
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#918fa1";
                    e.currentTarget.style.background = "none";
                  }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                    delete
                  </span>
                </button>
              )}
            </div>
          );
        })}
    </ScrollableFeed>
  );
};

export default React.memo(ScrollableChat);
