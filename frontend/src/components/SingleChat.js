import "./styles.css";
import {
  Spinner,
  useToast,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import { ChatState } from "../Context/ChatProvider";
import { getUserPresence, getStatusColor, formatLastSeen } from "../config/userStatus";

var selectedChatCompare;

/* ─── Avatar helper ──────────────────────────── */
const AvatarInitial = ({ name, size = 38 }) => {
  const colors = ["#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706"];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${colors[idx]}, ${colors[(idx+1)%colors.length]})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: "700", fontSize: size * 0.38,
      fontFamily: "'Plus Jakarta Sans', sans-serif", flexShrink: 0,
    }}>
      {name?.charAt(0).toUpperCase()}
    </div>
  );
};

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [istyping, setIsTyping] = useState(false);
  const [typingUserName, setTypingUserName] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const toast = useToast();
  const inputRef = useRef();
  const typingTimerRef = useRef(null);
  const receiverTypingTimeoutRef = useRef(null);
  const previousChatIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const {
    selectedChat,
    setSelectedChat,
    user,
    notification,
    setNotification,
    socket,
    onlineUsers,
    setChats,
  } = ChatState();

  const fetchMessages = async () => {
    if (!selectedChat?._id) return;
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      setLoading(true);
      const { data } = await axios.get(`/api/message/${selectedChat._id}`, config);
      setMessages(data);
      setLoading(false);

      if (socket) {
        socket.emit("join chat", selectedChat._id);
        socket.emit("mark messages read", { chatId: selectedChat._id, userId: user._id });

        // Mark any received messages as delivered if not already marked
        const undeliveredIds = data
          .filter((m) => {
            const senderId = String(m.sender?._id || m.sender);
            const isMe = senderId === String(user._id);
            const delivered = m.deliveredTo && m.deliveredTo.some((u) => String(u._id || u) === String(user._id));
            return !isMe && !delivered;
          })
          .map((m) => m._id);

        if (undeliveredIds.length > 0) {
          socket.emit("mark messages delivered", {
            messageIds: undeliveredIds,
            userId: user._id,
            chatId: selectedChat._id,
          });
        }
      }

      // Mark messages as read via REST
      axios.put(`/api/message/read/${selectedChat._id}`, {}, config).catch(() => {});
      setChats((prev) =>
        prev?.map((c) => (String(c._id) === String(selectedChat._id) ? { ...c, unreadCount: 0 } : c))
      );
    } catch (error) {
      toast({ title: "Failed to load messages", status: "error", duration: 5000, isClosable: true, position: "bottom" });
    }
  };

  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage.trim()) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (socket && selectedChat?._id) {
        socket.emit("stop typing", { chatId: selectedChat._id, senderId: user._id });
      }
      setTyping(false);

      try {
        const config = {
          headers: { "Content-type": "application/json", Authorization: `Bearer ${user.token}` },
        };
        const contentToSend = newMessage.trim();
        setNewMessage("");
        const { data } = await axios.post("/api/message", { content: contentToSend, chatId: selectedChat._id }, config);
        socket?.emit("new message", data);
        setMessages((prev) => [...prev, data]);
        setChats((prev) => {
          if (!prev) return prev;
          const target = prev.find((c) => String(c._id) === String(selectedChat._id));
          if (!target) return prev;
          const updated = { ...target, latestMessage: data, unreadCount: 0 };
          return [updated, ...prev.filter((c) => String(c._id) !== String(selectedChat._id))];
        });
      } catch (error) {
        toast({ title: "Failed to send message", status: "error", duration: 5000, isClosable: true, position: "bottom" });
      }
    }
  };

  const sendMessageClick = async () => {
    if (!newMessage.trim()) return;
    await sendMessage({ key: "Enter" });
    inputRef.current?.focus();
  };

  const handleClearChat = async () => {
    if (!selectedChat) return;
    if (selectedChat.isGroupChat) {
      const isOwner = String(selectedChat.groupAdmin?._id || selectedChat.groupAdmin) === String(user._id);
      const isAdmin = selectedChat.groupAdmins && selectedChat.groupAdmins.some((a) => String(a._id || a) === String(user._id));
      if (!isOwner && !isAdmin) {
        toast({
          title: "Access Denied",
          description: "Only admins can clear group messages",
          status: "warning",
          duration: 3000,
          isClosable: true,
          position: "top",
        });
        setIsClearModalOpen(false);
        return;
      }
    }

    try {
      setClearLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`/api/message/clear/${selectedChat._id}`, config);
      setMessages([]);
      socket?.emit("clear chat", selectedChat._id);
      setFetchAgain(!fetchAgain);
      setClearLoading(false);
      setIsClearModalOpen(false);
      toast({
        title: "Chat Cleared",
        description: "All message history in this chat has been cleared",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Failed to clear chat",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      setClearLoading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    if (selectedChat.isGroupChat) {
      const isOwner = String(selectedChat.groupAdmin?._id || selectedChat.groupAdmin) === String(user._id);
      const isAdmin = selectedChat.groupAdmins && selectedChat.groupAdmins.some((a) => String(a._id || a) === String(user._id));
      if (!isOwner && !isAdmin) {
        toast({
          title: "Access Denied",
          description: "Only admins can delete this group",
          status: "warning",
          duration: 3000,
          isClosable: true,
          position: "top",
        });
        setIsDeleteModalOpen(false);
        return;
      }
    }

    try {
      setDeleteLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`/api/chat/${selectedChat._id}`, config);
      socket?.emit("delete chat", selectedChat._id);
      setSelectedChat(null);
      setFetchAgain(!fetchAgain);
      setDeleteLoading(false);
      setIsDeleteModalOpen(false);
      toast({
        title: "Chat Deleted",
        description: "Chat has been removed from your chat list",
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Failed to delete chat",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      setDeleteLoading(false);
    }
  };

  const handleDeleteSingleMessage = (messageId) => {
    setMessages((prev) => prev.filter((m) => m._id !== messageId));
    setFetchAgain(!fetchAgain);
  };

  useEffect(() => {
    if (!socket || !selectedChat?._id) return;
    const currentId = String(selectedChat._id);

    // Leave previous room if switching
    if (previousChatIdRef.current && previousChatIdRef.current !== currentId) {
      socket.emit("leave chat", previousChatIdRef.current);
    }

    // Reset receiver typing state when switching chats
    setIsTyping(false);
    setTypingUserName("");
    if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);

    // Join new room
    socket.emit("join chat", currentId);
    previousChatIdRef.current = currentId;

    return () => {
      if (socket && currentId) {
        socket.emit("leave chat", currentId);
      }
    };
  }, [socket, selectedChat]);

  useEffect(() => {
    fetchMessages();
    selectedChatCompare = selectedChat;
    setIsTyping(false);
    setTypingUserName("");
    // eslint-disable-next-line
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, istyping]);

  useEffect(() => {
    if (!socket || !user) return;
    const config = { headers: { Authorization: `Bearer ${user.token}` } };

    const typingHandler = (data) => {
      if (!data) return;
      const typingChatId = typeof data === "object" ? String(data.chatId || data.room) : String(data);
      const senderId = typeof data === "object" ? String(data.senderId || data.userId || "") : "";
      const senderName = typeof data === "object" ? (data.senderName || data.name || "") : "";

      // Ignore if typing from oneself
      if (senderId && String(senderId) === String(user._id)) return;

      // STRICT CHECK: only show typing if it matches the current active chat room
      if (selectedChatCompare && String(selectedChatCompare._id) === typingChatId) {
        setIsTyping(true);
        setTypingUserName(senderName);

        // Safety timeout on receiver side: auto-clear after 4 seconds
        if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);
        receiverTypingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setTypingUserName("");
        }, 4000);
      }
    };

    const stopTypingHandler = (data) => {
      if (!data) {
        setIsTyping(false);
        setTypingUserName("");
        return;
      }
      const typingChatId = typeof data === "object" ? String(data.chatId || data.room) : String(data);
      if (selectedChatCompare && String(selectedChatCompare._id) === typingChatId) {
        setIsTyping(false);
        setTypingUserName("");
        if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);
      }
    };

    const messageHandler = (newMessageRecieved) => {
      const activeChatId = selectedChatCompare ? String(selectedChatCompare._id) : null;
      const incomingChatId = String(newMessageRecieved.chat?._id || newMessageRecieved.chat);

      // Acknowledge receipt to server
      if (socket && user && newMessageRecieved._id) {
        socket.emit("mark messages delivered", {
          messageIds: [newMessageRecieved._id],
          userId: user._id,
          chatId: incomingChatId,
        });
      }

      if (!activeChatId || activeChatId !== incomingChatId) {
        if (!notification.some((n) => String(n._id) === String(newMessageRecieved._id))) {
          setNotification((prev) => [newMessageRecieved, ...prev]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(newMessageRecieved._id))) return prev;
          return [...prev, newMessageRecieved];
        });
        // Because chat is actively open, mark as read immediately
        axios.put(`/api/message/read/${activeChatId}`, {}, config).catch(() => {});
        socket?.emit("mark messages read", { chatId: activeChatId, userId: user._id });
        setChats((prev) => {
          if (!prev) return prev;
          const target = prev.find((c) => String(c._id) === activeChatId);
          if (!target) return prev;
          const updated = { ...target, latestMessage: newMessageRecieved, unreadCount: 0 };
          return [updated, ...prev.filter((c) => String(c._id) !== activeChatId)];
        });
      }
    };

    const deliveryHandler = (data) => {
      if (!data) return;
      const ids = data.messageIds
        ? data.messageIds.map(String)
        : data.messageId
        ? [String(data.messageId)]
        : [];
      const users = data.deliveredTo
        ? data.deliveredTo.map(String)
        : data.userId
        ? [String(data.userId)]
        : [];
      if (!ids.length) return;

      setMessages((prev) =>
        prev.map((msg) => {
          if (ids.includes(String(msg._id))) {
            return {
              ...msg,
              deliveredTo: Array.from(new Set([...(msg.deliveredTo || []).map((u) => String(u._id || u)), ...users])),
            };
          }
          return msg;
        })
      );
    };

    const readHandler = ({ chatId, readerId }) => {
      if (selectedChatCompare && String(selectedChatCompare._id) === String(chatId)) {
        setMessages((prev) =>
          prev.map((msg) => {
            const senderId = msg.sender?._id || msg.sender;
            if (String(senderId) === String(user._id)) {
              return {
                ...msg,
                readBy: Array.from(new Set([...(msg.readBy || []).map((u) => String(u._id || u)), String(readerId)])),
                deliveredTo: Array.from(new Set([...(msg.deliveredTo || []).map((u) => String(u._id || u)), String(readerId)])),
              };
            }
            return msg;
          })
        );
      }
    };

    const clearChatHandler = (clearedChatId) => {
      if (selectedChatCompare && String(selectedChatCompare._id) === String(clearedChatId)) {
        setMessages([]);
        setFetchAgain(!fetchAgain);
      }
    };

    const deleteMessageHandler = ({ messageId, chatId }) => {
      if (selectedChatCompare && String(selectedChatCompare._id) === String(chatId)) {
        setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId)));
        setFetchAgain(!fetchAgain);
      }
    };

    const deleteChatHandler = (deletedChatId) => {
      if (selectedChatCompare && String(selectedChatCompare._id) === String(deletedChatId)) {
        setSelectedChat(null);
        setFetchAgain(!fetchAgain);
      }
    };

    const groupUpdateHandler = (updatedChat) => {
      if (selectedChatCompare && String(selectedChatCompare._id) === String(updatedChat._id)) {
        setSelectedChat(updatedChat);
      }
      setFetchAgain(!fetchAgain);
    };

    socket.on("typing", typingHandler);
    socket.on("stop typing", stopTypingHandler);
    socket.on("message recieved", messageHandler);
    socket.on("message delivered update", deliveryHandler);
    socket.on("messages delivered update", deliveryHandler);
    socket.on("messages read update", readHandler);
    socket.on("chat cleared", clearChatHandler);
    socket.on("message deleted", deleteMessageHandler);
    socket.on("chat deleted", deleteChatHandler);
    socket.on("group updated", groupUpdateHandler);

    return () => {
      socket.off("typing", typingHandler);
      socket.off("stop typing", stopTypingHandler);
      socket.off("message recieved", messageHandler);
      socket.off("message delivered update", deliveryHandler);
      socket.off("messages delivered update", deliveryHandler);
      socket.off("messages read update", readHandler);
      socket.off("chat cleared", clearChatHandler);
      socket.off("message deleted", deleteMessageHandler);
      socket.off("chat deleted", deleteChatHandler);
      socket.off("group updated", groupUpdateHandler);
    };
  }, [socket, notification, fetchAgain, setFetchAgain, setNotification, user, setSelectedChat, setChats]);

  const typingHandler = (e) => {
    const val = e.target.value;
    setNewMessage(val);

    if (!socket || !selectedChat?._id) return;

    if (!val.trim()) {
      if (typing) {
        socket.emit("stop typing", { chatId: selectedChat._id, senderId: user._id });
        setTyping(false);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      return;
    }

    if (!typing) {
      setTyping(true);
      socket.emit("typing", {
        chatId: selectedChat._id,
        senderId: user._id,
        senderName: user.name || user.username || "User",
      });
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("stop typing", { chatId: selectedChat._id, senderId: user._id });
      setTyping(false);
    }, 2500);
  };

  const chatName = selectedChat
    ? (!selectedChat.isGroupChat ? getSender(user, selectedChat.users) : selectedChat.chatName)
    : "";

  const chatPartner = selectedChat && !selectedChat.isGroupChat ? getSenderFull(user, selectedChat.users) : null;
  const partnerPresence = chatPartner ? getUserPresence(chatPartner, onlineUsers) : null;
  const onlineMembersCount = selectedChat && selectedChat.isGroupChat
    ? selectedChat.users?.filter((u) => {
        if (u._id === user._id) return true;
        const p = getUserPresence(u, onlineUsers);
        return p.status === "online" || p.status === "away";
      }).length || 0
    : 0;

  return (
    <>
      {selectedChat ? (
        <>
          {/* ── Chat Header ── */}
          <header
            className="shrink-0 flex items-center justify-between px-4 animate-fade-in"
            style={{
              height: "64px",
              background: "#171f33",
              borderBottom: "1px solid rgba(70,69,85,0.4)",
              zIndex: 10,
            }}>
            <div className="flex items-center gap-3 min-w-0">
              {/* Back btn (mobile) */}
              <button
                onClick={() => setSelectedChat("")}
                className="md:hidden flex items-center justify-center rounded-lg transition-colors"
                style={{ color: "#918fa1", background: "none", border: "none", cursor: "pointer", padding: "6px" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>arrow_back</span>
              </button>

              {/* Avatar with dynamic presence dot */}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <AvatarInitial name={chatName} size={40} />
                {!selectedChat.isGroupChat && partnerPresence && (
                  <span
                    title={`Status: ${partnerPresence.status}`}
                    style={{
                      position: "absolute", bottom: 0, right: 0,
                      width: 10, height: 10, borderRadius: "50%",
                      background: getStatusColor(partnerPresence.status),
                      border: "2px solid #171f33",
                      boxShadow: partnerPresence.status === "online" ? "0 0 6px rgba(16,185,129,0.7)" : "none",
                    }}
                  />
                )}
              </div>

              {/* Name & status */}
              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-2 min-w-0">
                  <span style={{
                    fontSize: "15px", fontWeight: "700",
                    color: "#dae2fd", fontFamily: "'Plus Jakarta Sans', sans-serif",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {!selectedChat.isGroupChat ? (
                      <>{getSender(user, selectedChat.users)}</>
                    ) : (
                      selectedChat.chatName.toUpperCase()
                    )}
                  </span>
                  {!selectedChat.isGroupChat && (
                    <ProfileModal user={getSenderFull(user, selectedChat.users)} />
                  )}
                  {selectedChat.isGroupChat && (
                    <UpdateGroupChatModal
                      fetchMessages={fetchMessages}
                      fetchAgain={fetchAgain}
                      setFetchAgain={setFetchAgain}
                    />
                  )}
                </div>

                {/* Dynamic Status / Last Seen */}
                <span style={{ fontSize: "12px", fontWeight: "500", marginTop: "1px" }}>
                  {istyping ? (
                    <span style={{ color: "#c3c0ff", animation: "pulse 1.5s infinite" }}>
                      {selectedChat.isGroupChat
                        ? `${typingUserName || "Someone"} is typing...`
                        : `${typingUserName || chatName} is typing...`}
                    </span>
                  ) : selectedChat.isGroupChat ? (
                    <span style={{ color: "#918fa1" }}>
                      {selectedChat.users.length} members •{" "}
                      <span style={{ color: "#10b981", fontWeight: "600" }}>
                        {onlineMembersCount} online
                      </span>
                    </span>
                  ) : partnerPresence?.status === "online" ? (
                    <span style={{ color: "#10b981", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#10b981", display: "inline-block",
                        boxShadow: "0 0 6px rgba(16,185,129,0.7)"
                      }} />
                      Online
                    </span>
                  ) : partnerPresence?.status === "away" ? (
                    <span style={{ color: "#f59e0b", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#f59e0b", display: "inline-block"
                      }} />
                      Away
                    </span>
                  ) : (
                    <span style={{ color: "#918fa1" }}>
                      {partnerPresence?.lastSeen
                        ? `Last seen ${formatLastSeen(partnerPresence.lastSeen)}`
                        : "Offline"}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1">
              {/* Chat options dropdown menu */}
              <Menu isLazy>
                <MenuButton
                  as="button"
                  title="Chat Options"
                  className="flex items-center justify-center rounded-xl transition-colors"
                  style={{
                    width: 36, height: 36, color: "#918fa1",
                    background: "none", border: "none", cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}>
                  <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>more_vert</span>
                </MenuButton>
                <MenuList
                  bg="#171f33"
                  borderColor="rgba(255, 255, 255, 0.08)"
                  borderRadius="16px"
                  boxShadow="0 10px 30px rgba(0, 0, 0, 0.5)"
                  py={2}
                  px={1}
                >
                  <MenuItem
                    bg="transparent"
                    _hover={{ bg: "rgba(255, 255, 255, 0.06)" }}
                    color="#dae2fd"
                    fontSize="13.5px"
                    fontFamily="'Inter', sans-serif"
                    borderRadius="10px"
                    icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#f59e0b" }}>cleaning_services</span>}
                    onClick={() => setIsClearModalOpen(true)}
                  >
                    Clear Chat
                  </MenuItem>
                  <MenuItem
                    bg="transparent"
                    _hover={{ bg: "rgba(239, 68, 68, 0.1)" }}
                    color="#ef4444"
                    fontSize="13.5px"
                    fontFamily="'Inter', sans-serif"
                    borderRadius="10px"
                    icon={<span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#ef4444" }}>delete_forever</span>}
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete Chat
                  </MenuItem>
                </MenuList>
              </Menu>
            </div>
          </header>

          {/* ── Messages Area ── */}
          <div
            className="flex-1 overflow-hidden px-4 md:px-8 py-4 flex flex-col relative"
            style={{
              background: "#0b1326",
            }}>
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="flex flex-col items-center gap-4">
                  <Spinner size="xl" color="#4f46e5" thickness="3px" />
                  <span style={{ fontSize: "13px", color: "#464555" }}>Loading messages...</span>
                </div>
              </div>
            ) : (
              <div className="messages flex-1 flex flex-col overflow-y-auto">
                <ScrollableChat messages={messages} onDeleteMessage={handleDeleteSingleMessage} />
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── Typing Indicator ── */}
          {istyping && (
            <div className="px-4 md:px-8 py-2" style={{ background: "#0b1326" }}>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl"
                style={{ background: "#2d3449", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span style={{ fontSize: "12px", color: "#918fa1", marginLeft: "4px" }}>
                  {selectedChat.isGroupChat
                    ? `${typingUserName || "Someone"} is typing...`
                    : `${chatName} is typing...`}
                </span>
              </div>
            </div>
          )}

          {/* ── Input Bar ── */}
          <div
            className="shrink-0 flex items-center gap-2 px-4 py-3"
            style={{
              background: "#171f33",
              borderTop: "1px solid rgba(70,69,85,0.4)",
              minHeight: "68px",
            }}
            onKeyDown={sendMessage}>

            {/* Text Input */}
            <div
              className="flex-1 flex items-center gap-2 rounded-2xl px-4"
              style={{
                background: "#222a3d",
                border: `1px solid ${inputFocused ? "#4f46e5" : "rgba(70,69,85,0.6)"}`,
                boxShadow: inputFocused ? "0 0 0 3px rgba(79,70,229,0.15)" : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
                minHeight: "44px",
              }}>
              {/* Emoji */}
              <button title="Emoji"
                style={{ color: "#918fa1", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>mood</span>
              </button>

              <input
                ref={inputRef}
                className="flex-1 bg-transparent focus:outline-none"
                style={{
                  color: "#dae2fd",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "14px",
                  lineHeight: "1.5",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  padding: "10px 0",
                }}
                placeholder="Type a message..."
                value={newMessage}
                onChange={typingHandler}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
            </div>

            {/* Send button */}
            <button
              onClick={sendMessageClick}
              disabled={!newMessage.trim()}
              title="Send Message"
              style={{
                width: 44, height: 44,
                borderRadius: "50%",
                background: newMessage.trim()
                  ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                  : "#222a3d",
                border: "none",
                cursor: newMessage.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: newMessage.trim() ? "#fff" : "#6b7280",
                boxShadow: newMessage.trim() ? "0 4px 16px rgba(79,70,229,0.4)" : "none",
                transition: "all 0.2s",
                transform: "scale(1)",
                flexShrink: 0,
                opacity: newMessage.trim() ? 1 : 0.6,
              }}
              onMouseEnter={e => { if (newMessage.trim()) e.currentTarget.style.transform = "scale(1.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                send
              </span>
            </button>
          </div>
        </>
      ) : (
        /* ── Empty State ── */
        <div
          className="flex flex-col items-center justify-center h-full w-full animate-fade-in"
          style={{
            background: "#0b1326",
            backgroundImage: `radial-gradient(ellipse at 50% 50%, rgba(79,70,229,0.06) 0%, transparent 60%)`,
          }}>
          <div className="text-center max-w-sm px-8">
            {/* Animated icon */}
            <div
              className="inline-flex items-center justify-center rounded-3xl mb-8 mx-auto"
              style={{
                width: 100, height: 100,
                background: "linear-gradient(135deg, rgba(79,70,229,0.2), rgba(139,92,246,0.2))",
                border: "1px solid rgba(79,70,229,0.3)",
                boxShadow: "0 0 60px rgba(79,70,229,0.15)",
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#c3c0ff" }}>
                chat_bubble_outline
              </span>
            </div>

            <h2 style={{
              fontSize: "22px", fontWeight: "700",
              color: "#dae2fd", fontFamily: "'Plus Jakarta Sans', sans-serif",
              marginBottom: "10px", letterSpacing: "-0.01em",
            }}>
              Start a Conversation
            </h2>
            <p style={{ fontSize: "14px", color: "#464555", lineHeight: "1.6", marginBottom: "24px" }}>
              Select a contact from the left list to start a conversation, or create a new group.
            </p>

            {/* Decorative dots */}
            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "rgba(79,70,229,0.4)",
                  animation: `pulse 2s ${i * 0.4}s infinite`,
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Clear Chat Confirmation Modal ── */}
      <Modal isLazy onClose={() => setIsClearModalOpen(false)} isOpen={isClearModalOpen} isCentered size="md">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(5px)" />
        <ModalContent
          style={{
            background: "#171f33",
            border: "1px solid #464555",
            borderRadius: "1.25rem",
            color: "#dae2fd",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            overflow: "hidden",
            maxWidth: "440px",
          }}>
          <ModalHeader
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid rgba(70,69,85,0.4)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "rgba(245, 158, 11, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#f59e0b" }}>
                cleaning_services
              </span>
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#dae2fd", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Clear Chat?
              </h3>
              <p style={{ fontSize: "12px", color: "#918fa1", fontWeight: "400", margin: 0 }}>
                Clear all message history
              </p>
            </div>
          </ModalHeader>
          <ModalCloseButton color="#918fa1" top="14px" right="14px" />

          <ModalBody style={{ padding: "20px" }}>
            <p style={{ fontSize: "14px", color: "#c3c0ff", lineHeight: "1.6" }}>
              This will permanently clear all message history in this chat with{" "}
              <strong style={{ color: "#fff" }}>{chatName}</strong> for everyone. This action cannot be undone.
            </p>
          </ModalBody>

          <ModalFooter
            style={{
              padding: "14px 20px",
              borderTop: "1px solid rgba(70,69,85,0.4)",
              gap: "10px",
              background: "rgba(0,0,0,0.15)",
            }}>
            <Button
              variant="ghost"
              color="#918fa1"
              _hover={{ bg: "rgba(255,255,255,0.06)", color: "#dae2fd" }}
              borderRadius="10px"
              fontSize="14px"
              onClick={() => setIsClearModalOpen(false)}>
              Cancel
            </Button>
            <Button
              bg="#d97706"
              _hover={{ bg: "#b45309" }}
              color="#fff"
              borderRadius="10px"
              fontSize="14px"
              fontWeight="600"
              isLoading={clearLoading}
              onClick={handleClearChat}>
              Yes, Clear Chat
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Delete Chat Confirmation Modal ── */}
      <Modal isLazy onClose={() => setIsDeleteModalOpen(false)} isOpen={isDeleteModalOpen} isCentered size="md">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(5px)" />
        <ModalContent
          style={{
            background: "#171f33",
            border: "1px solid #464555",
            borderRadius: "1.25rem",
            color: "#dae2fd",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            overflow: "hidden",
            maxWidth: "440px",
          }}>
          <ModalHeader
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid rgba(70,69,85,0.4)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "rgba(239, 68, 68, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px", color: "#ef4444" }}>
                delete_forever
              </span>
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#dae2fd", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Delete Chat?
              </h3>
              <p style={{ fontSize: "12px", color: "#918fa1", fontWeight: "400", margin: 0 }}>
                Delete conversation and all messages
              </p>
            </div>
          </ModalHeader>
          <ModalCloseButton color="#918fa1" top="14px" right="14px" />

          <ModalBody style={{ padding: "20px" }}>
            <p style={{ fontSize: "14px", color: "#c3c0ff", lineHeight: "1.6" }}>
              Are you sure you want to delete the chat with{" "}
              <strong style={{ color: "#fff" }}>{chatName}</strong>?
              {selectedChat?.isGroupChat
                ? " The entire group conversation history will be permanently deleted for all members."
                : " The conversation and message history will be removed from your chat list."}
            </p>
          </ModalBody>

          <ModalFooter
            style={{
              padding: "14px 20px",
              borderTop: "1px solid rgba(70,69,85,0.4)",
              gap: "10px",
              background: "rgba(0,0,0,0.15)",
            }}>
            <Button
              variant="ghost"
              color="#918fa1"
              _hover={{ bg: "rgba(255,255,255,0.06)", color: "#dae2fd" }}
              borderRadius="10px"
              fontSize="14px"
              onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              bg="#ef4444"
              _hover={{ bg: "#dc2626" }}
              color="#fff"
              borderRadius="10px"
              fontSize="14px"
              fontWeight="600"
              isLoading={deleteLoading}
              onClick={handleDeleteChat}>
              Yes, Delete Chat
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default SingleChat;
