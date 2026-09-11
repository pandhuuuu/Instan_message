import React from "react";
import ScrollableFeed from "react-scrollable-feed";
import axios from "axios";
import {
  isLastMessage,
  isSameSender,
  isSameUser,
} from "../config/ChatLogics";
import { ChatState } from "../Context/ChatProvider";

/* ─── Date Pill Helpers ─────────────────────────────────── */
const isSameDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatDatePill = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  const now = new Date();

  if (isSameDay(d, now)) {
    return "TODAY";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, yesterday)) {
    return "YESTERDAY";
  }

  return d
    .toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
    .toUpperCase();
};

/* ─── Group sender colors ──────────────────────────────── */
const SENDER_COLORS = [
  "#53bdeb",
  "#00a884",
  "#f59e0b",
  "#ec4899",
  "#a78bfa",
  "#34d399",
  "#fb923c",
  "#38bdf8",
];
const getSenderColor = (name) => {
  if (!name) return SENDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
};

const ScrollableChat = ({ messages, onDeleteMessage, searchQuery = "" }) => {
  const { user, selectedChat, socket } = ChatState();

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
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

  // Helper to highlight matching search text
  const renderMessageContent = (content) => {
    if (!searchQuery || !searchQuery.trim()) return content;
    const query = searchQuery.trim();
    const parts = content.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span
          key={index}
          style={{
            background: "rgba(0, 168, 132, 0.4)",
            color: "#ffffff",
            padding: "0 2px",
            borderRadius: "3px",
            fontWeight: "600",
          }}
        >
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <ScrollableFeed>
      {messages &&
        messages.map((m, i) => {
          const showDatePill = i === 0 || !isSameDay(messages[i - 1]?.createdAt, m.createdAt);

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
              <React.Fragment key={m._id}>
                {showDatePill && (
                  <div className="flex justify-center my-3 sticky top-2 z-10">
                    <span
                      style={{
                        background: "#182229",
                        color: "#8696a0",
                        fontSize: "11px",
                        fontWeight: "600",
                        letterSpacing: "0.5px",
                        padding: "5px 12px",
                        borderRadius: "8px",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        fontFamily: "'Segoe UI', 'Inter', sans-serif",
                        userSelect: "none",
                      }}
                    >
                      {formatDatePill(m.createdAt)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-center w-full my-2 px-3">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg"
                    style={{
                      background: "#182229",
                      border: "1px solid rgba(255, 255, 255, 0.04)",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
                      maxWidth: "85%",
                    }}
                  >
                    <span
                      className="material-symbols-outlined shrink-0"
                      style={{ fontSize: "14px", color: "#00a884" }}
                    >
                      {iconName}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "#8696a0",
                        fontFamily: "'Segoe UI', 'Inter', sans-serif",
                        textAlign: "center",
                        wordBreak: "break-word",
                      }}
                    >
                      {m.content}
                    </span>
                    <span
                      style={{
                        fontSize: "10.5px",
                        color: "#6b7280",
                        marginLeft: "4px",
                        fontFamily: "'Segoe UI', 'Inter', sans-serif",
                      }}
                    >
                      {formatTime(m.createdAt)}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          }

          const isMyMessage = m.sender?._id === user._id;
          const isGroup = selectedChat?.isGroupChat;
          const isOwner =
            isGroup &&
            String(selectedChat.groupAdmin?._id || selectedChat.groupAdmin) === String(user._id);
          const isAdmin =
            isGroup && selectedChat.groupAdmins?.some((a) => String(a._id || a) === String(user._id));
          const canDelete = isMyMessage || isOwner || isAdmin;
          const showAvatar = isSameSender(messages, m, i, user._id) || isLastMessage(messages, i, user._id);
          const isFirstInSequence = !isSameUser(messages, m, i, user._id);
          const marginTop = isFirstInSequence ? "8px" : "2px";

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
            <React.Fragment key={m._id}>
              {/* Sticky Date Pill */}
              {showDatePill && (
                <div className="flex justify-center my-3 sticky top-2 z-10">
                  <span
                    style={{
                      background: "#182229",
                      color: "#8696a0",
                      fontSize: "11px",
                      fontWeight: "600",
                      letterSpacing: "0.5px",
                      padding: "5px 12px",
                      borderRadius: "8px",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      fontFamily: "'Segoe UI', 'Inter', sans-serif",
                      userSelect: "none",
                    }}
                  >
                    {formatDatePill(m.createdAt)}
                  </span>
                </div>
              )}

              <div
                className="flex items-end w-full group relative px-2 md:px-6"
                style={{
                  marginTop,
                  justifyContent: isMyMessage ? "flex-end" : "flex-start",
                }}
              >
                {/* Delete Button for My Message (Hover) */}
                {isMyMessage && canDelete && (
                  <button
                    onClick={handleDeleteMsg}
                    title="Delete message for everyone"
                    className="opacity-0 group-hover:opacity-100 transition-opacity mr-1.5 mb-1"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#8696a0",
                      padding: "4px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ef4444";
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#8696a0";
                      e.currentTarget.style.background = "none";
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      delete
                    </span>
                  </button>
                )}

                {/* Sender Avatar for Group Chats */}
                {!isMyMessage && (
                  <div style={{ width: 28, marginRight: 6, flexShrink: 0, marginBottom: 2 }}>
                    {showAvatar ? (
                      <div title={m.sender.name}>
                        {m.sender.pic ? (
                          <img
                            src={m.sender.pic}
                            alt={m.sender.name}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: "50%",
                              background: getSenderColor(m.sender.name),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: "12px",
                              fontFamily: "'Segoe UI', 'Inter', sans-serif",
                            }}
                          >
                            {m.sender.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* WhatsApp Web Message Bubble */}
                <div
                  style={{
                    maxWidth: "65%",
                    minWidth: "75px",
                    padding: "6px 9px 6px 10px",
                    borderRadius: isMyMessage
                      ? isFirstInSequence
                        ? "8px 0px 8px 8px"
                        : "8px"
                      : isFirstInSequence
                      ? "0px 8px 8px 8px"
                      : "8px",
                    background: isMyMessage ? "#005c4b" : "#202c33",
                    color: "#e9edef",
                    boxShadow: "0 1px 1px rgba(0, 0, 0, 0.2)",
                    position: "relative",
                    wordBreak: "break-word",
                  }}
                >
                  {/* Sender name in group chats */}
                  {!isMyMessage && isFirstInSequence && isGroup && (
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: "600",
                        color: getSenderColor(m.sender?.name),
                        marginBottom: "2px",
                        fontFamily: "'Segoe UI', 'Inter', sans-serif",
                        lineHeight: 1.2,
                      }}
                    >
                      {m.sender?.name}
                    </div>
                  )}

                  {/* Message text */}
                  <div
                    style={{
                      fontSize: "14.2px",
                      lineHeight: "1.4",
                      fontFamily: "'Segoe UI', 'Inter', sans-serif",
                      paddingRight: isMyMessage ? "48px" : "36px",
                    }}
                  >
                    {renderMessageContent(m.content)}
                  </div>

                  {/* Timestamp & Status Ticks (Docked Bottom Right) */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "3px",
                      right: "7px",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      userSelect: "none",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        color: isMyMessage ? "rgba(255, 255, 255, 0.6)" : "#8696a0",
                        fontFamily: "'Segoe UI', 'Inter', sans-serif",
                      }}
                    >
                      {formatTime(m.createdAt)}
                    </span>

                    {isMyMessage && (() => {
                      const status = getMessageStatus(m);
                      if (status === "read") {
                        return (
                          <span
                            title="Read"
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "15px",
                              color: "#53bdeb",
                              display: "inline-flex",
                              lineHeight: 1,
                            }}
                          >
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
                              color: "rgba(255, 255, 255, 0.6)",
                              display: "inline-flex",
                              lineHeight: 1,
                            }}
                          >
                            done_all
                          </span>
                        );
                      } else {
                        return (
                          <span
                            title="Sent"
                            className="material-symbols-outlined"
                            style={{
                              fontSize: "15px",
                              color: "rgba(255, 255, 255, 0.6)",
                              display: "inline-flex",
                              lineHeight: 1,
                            }}
                          >
                            check
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>

                {/* Delete Button for Incoming Message (Admin/Owner only) */}
                {!isMyMessage && canDelete && (
                  <button
                    onClick={handleDeleteMsg}
                    title="Delete message (Admin)"
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 mb-1"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#8696a0",
                      padding: "4px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ef4444";
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#8696a0";
                      e.currentTarget.style.background = "none";
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                      delete
                    </span>
                  </button>
                )}
              </div>
            </React.Fragment>
          );
        })}
    </ScrollableFeed>
  );
};

export default React.memo(ScrollableChat);
