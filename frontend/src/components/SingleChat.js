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
  useDisclosure,
} from "@chakra-ui/react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import ProfileModal from "./miscellaneous/ProfileModal";
import ScrollableChat from "./ScrollableChat";
import UpdateGroupChatModal from "./miscellaneous/UpdateGroupChatModal";
import UserAvatar from "./userAvatar/UserAvatar";
import { ChatState } from "../Context/ChatProvider";
import { getUserPresence, getStatusColor, formatLastSeen } from "../config/userStatus";

var selectedChatCompare;

/* ─── Avatar Initial Helper ──────────────────────────── */
const AvatarInitial = ({ name, size = 40 }) => {
  const colors = ["#005c4b", "#128c7e", "#075e54", "#1f7a65", "#00a884", "#2e7d32"];
  const charCode = name ? name.charCodeAt(0) : 0;
  const bg = colors[charCode % colors.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontWeight: "600",
        fontSize: Math.round(size * 0.42),
        fontFamily: "'Segoe UI', 'Helvetica Neue', 'Inter', sans-serif",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {name?.charAt(0).toUpperCase() || "?"}
    </div>
  );
};

/* ─── Group Avatar Helper ────────────────────────────── */
const GroupAvatar = ({ size = 40 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: "#202c33",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#8696a0",
      border: "1px solid #2a3942",
      flexShrink: 0,
    }}
  >
    <span className="material-symbols-outlined" style={{ fontSize: Math.round(size * 0.54) }}>
      groups
    </span>
  </div>
);

const QUICK_EMOJIS = ["😊", "😂", "❤️", "👍", "🔥", "🙏", "🎉", "🚀", "😍", "✨", "🙌", "💯", "👋", "🥳", "😎", "🤝"];

const SingleChat = ({ fetchAgain, setFetchAgain }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [typing, setTyping] = useState(false);
  const [istyping, setIsTyping] = useState(false);
  const [typingUserName, setTypingUserName] = useState("");
  const [inputFocused, setInputFocused] = useState(false);

  // Search within chat state
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const [searchChatQuery, setSearchChatQuery] = useState("");

  // Emoji picker quick drawer
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const toast = useToast();
  const inputRef = useRef();
  const typingTimerRef = useRef(null);
  const receiverTypingTimeoutRef = useRef(null);
  const previousChatIdRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const {
    isOpen: isGroupModalOpen,
    onOpen: onOpenGroupModal,
    onClose: onCloseGroupModal,
  } = useDisclosure();
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
      setMessages(Array.isArray(data) ? data : []);
      setLoading(false);

      if (socket) {
        socket.emit("join chat", selectedChat._id);
        socket.emit("mark messages read", { chatId: selectedChat._id, userId: user._id });

        // Mark received messages as delivered if not yet marked
        const undeliveredIds = data
          .filter((m) => {
            const senderId = String(m.sender?._id || m.sender);
            const isMe = senderId === String(user._id);
            const delivered =
              m.deliveredTo && m.deliveredTo.some((u) => String(u._id || u) === String(user._id));
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
        Array.isArray(prev)
          ? prev.map((c) =>
              String(c._id) === String(selectedChat._id) ? { ...c, unreadCount: 0 } : c
            )
          : []
      );
    } catch (error) {
      toast({
        title: "Failed to load messages",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
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
        setShowEmojiPicker(false);
        const { data } = await axios.post(
          "/api/message",
          { content: contentToSend, chatId: selectedChat._id },
          config
        );
        socket?.emit("new message", data);
        setMessages((prev) => [...prev, data]);
        setChats((prev) => {
          if (!Array.isArray(prev)) return prev;
          const target = prev.find((c) => String(c._id) === String(selectedChat._id));
          if (!target) return prev;
          const updated = { ...target, latestMessage: data, unreadCount: 0 };
          return [updated, ...prev.filter((c) => String(c._id) !== String(selectedChat._id))];
        });
      } catch (error) {
        toast({
          title: "Failed to send message",
          status: "error",
          duration: 4000,
          isClosable: true,
          position: "bottom",
        });
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

    try {
      setClearLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`/api/message/clear/${selectedChat._id}`, config);
      setMessages([]);
      socket?.emit("clear chat", { chatId: selectedChat._id, userId: user._id });
      setFetchAgain(!fetchAgain);
      setClearLoading(false);
      setIsClearModalOpen(false);
      toast({
        title: "Chat Cleared",
        description: "Message history in this chat has been cleared for your account",
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

    try {
      setDeleteLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      await axios.delete(`/api/chat/${selectedChat._id}`, config);
      socket?.emit("delete chat", { chatId: selectedChat._id, userId: user._id });
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

  const handleInsertEmoji = (emoji) => {
    setNewMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  // Switch chat rooms cleanly on socket
  useEffect(() => {
    if (!socket || !selectedChat?._id) return;
    const currentId = String(selectedChat._id);

    if (previousChatIdRef.current && previousChatIdRef.current !== currentId) {
      socket.emit("leave chat", previousChatIdRef.current);
    }

    setIsTyping(false);
    setTypingUserName("");
    if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);

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
    setIsSearchingInChat(false);
    setSearchChatQuery("");
    setShowEmojiPicker(false);
    // eslint-disable-next-line
  }, [selectedChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, istyping]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !user) return;
    const config = { headers: { Authorization: `Bearer ${user.token}` } };

    const typingHandler = (data) => {
      if (!data) return;
      const typingChatId =
        typeof data === "object" ? String(data.chatId || data.room) : String(data);
      const senderId = typeof data === "object" ? String(data.senderId || data.userId || "") : "";
      const senderName = typeof data === "object" ? data.senderName || data.name || "" : "";

      if (senderId && String(senderId) === String(user._id)) return;

      if (selectedChatCompare && String(selectedChatCompare._id) === typingChatId) {
        setIsTyping(true);
        setTypingUserName(senderName);

        if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);
        receiverTypingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setTypingUserName("");
        }, 3500);
      }
    };

    const stopTypingHandler = (data) => {
      if (!data) {
        setIsTyping(false);
        setTypingUserName("");
        return;
      }
      const typingChatId =
        typeof data === "object" ? String(data.chatId || data.room) : String(data);
      if (selectedChatCompare && String(selectedChatCompare._id) === typingChatId) {
        setIsTyping(false);
        setTypingUserName("");
        if (receiverTypingTimeoutRef.current) clearTimeout(receiverTypingTimeoutRef.current);
      }
    };

    const messageHandler = (newMessageRecieved) => {
      const activeChatId = selectedChatCompare ? String(selectedChatCompare._id) : null;
      const incomingChatId = String(newMessageRecieved.chat?._id || newMessageRecieved.chat);

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
        axios.put(`/api/message/read/${activeChatId}`, {}, config).catch(() => {});
        socket?.emit("mark messages read", { chatId: activeChatId, userId: user._id });
        setChats((prev) => {
          if (!Array.isArray(prev)) return prev;
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

      if (!ids.length || !users.length) return;

      setMessages((prevMessages) =>
        prevMessages.map((m) => {
          if (ids.includes(String(m._id))) {
            const currentDelivered = Array.isArray(m.deliveredTo)
              ? m.deliveredTo.map((u) => String(u._id || u))
              : [];
            const merged = Array.from(new Set([...currentDelivered, ...users]));
            return { ...m, deliveredTo: merged };
          }
          return m;
        })
      );
    };

    const readHandler = (data) => {
      if (!data || !data.chatId) return;
      const activeChatId = selectedChatCompare ? String(selectedChatCompare._id) : null;
      if (activeChatId && activeChatId === String(data.chatId)) {
        const readerId = String(data.readerId || "");
        setMessages((prevMessages) =>
          prevMessages.map((m) => {
            if (m.sender?._id === user._id) {
              const currentRead = Array.isArray(m.readBy)
                ? m.readBy.map((u) => String(u._id || u))
                : [];
              if (readerId && !currentRead.includes(readerId)) {
                return { ...m, readBy: [...currentRead, readerId] };
              }
            }
            return m;
          })
        );
      }
    };

    const clearChatHandler = (clearedChatId) => {
      const activeChatId = selectedChatCompare ? String(selectedChatCompare._id) : null;
      if (activeChatId && activeChatId === String(clearedChatId)) {
        setMessages([]);
        setFetchAgain(!fetchAgain);
      }
    };

    const deleteMessageHandler = ({ messageId, chatId }) => {
      const activeChatId = selectedChatCompare ? String(selectedChatCompare._id) : null;
      if (activeChatId && activeChatId === String(chatId)) {
        setMessages((prev) => prev.filter((m) => String(m._id) !== String(messageId)));
        setFetchAgain(!fetchAgain);
      }
    };

    const deleteChatHandler = (deletedChatId) => {
      const activeChatId = selectedChatCompare ? String(selectedChatCompare._id) : null;
      if (activeChatId && activeChatId === String(deletedChatId)) {
        setSelectedChat(null);
        setFetchAgain(!fetchAgain);
      }
    };

    const groupUpdateHandler = (updatedGroup) => {
      const activeChatId = selectedChatCompare ? String(selectedChatCompare._id) : null;
      if (activeChatId && activeChatId === String(updatedGroup._id)) {
        setSelectedChat(updatedGroup);
        fetchMessages();
        setFetchAgain(!fetchAgain);
      }
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
    ? !selectedChat.isGroupChat
      ? getSender(user, selectedChat.users)
      : selectedChat.chatName
    : "";

  const chatPartner =
    selectedChat && !selectedChat.isGroupChat ? getSenderFull(user, selectedChat.users) : null;
  const partnerPresence = chatPartner ? getUserPresence(chatPartner, onlineUsers) : null;
  const onlineMembersCount =
    selectedChat && selectedChat.isGroupChat
      ? selectedChat.users?.filter((u) => {
          if (u._id === user._id) return true;
          const p = getUserPresence(u, onlineUsers);
          return p.status === "online" || p.status === "away";
        }).length || 0
      : 0;

  // Filter messages if searching in chat
  const displayedMessages = searchChatQuery.trim()
    ? messages.filter((m) =>
        (m.content || "").toLowerCase().includes(searchChatQuery.toLowerCase().trim())
      )
    : messages;

  return (
    <>
      {selectedChat ? (
        <>
          {/* ── Chat Header (WhatsApp Web Standard: 60px height, #202c33) ── */}
          <header
            className="shrink-0 flex items-center justify-between px-3 md:px-4"
            style={{
              height: "60px",
              background: "#202c33",
              borderBottom: "1px solid #222d34",
              zIndex: 20,
            }}
          >
            {isSearchingInChat ? (
              /* Inline Search Bar in Header */
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => {
                    setIsSearchingInChat(false);
                    setSearchChatQuery("");
                  }}
                  className="flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] cursor-pointer"
                  style={{ background: "none", border: "none" }}
                  title="Close search"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                    arrow_back
                  </span>
                </button>
                <div
                  className="flex-1 flex items-center gap-2 px-3 rounded-lg"
                  style={{ background: "#111b21", height: "36px" }}
                >
                  <span
                    className="material-symbols-outlined shrink-0"
                    style={{ fontSize: "18px", color: "#8696a0" }}
                  >
                    search
                  </span>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search in chat..."
                    value={searchChatQuery}
                    onChange={(e) => setSearchChatQuery(e.target.value)}
                    className="flex-1 bg-transparent focus:outline-none text-sm text-[#e9edef]"
                    style={{ fontFamily: "'Segoe UI', 'Inter', sans-serif" }}
                  />
                  {searchChatQuery && (
                    <button
                      onClick={() => setSearchChatQuery("")}
                      style={{ background: "none", border: "none", color: "#8696a0", cursor: "pointer" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                        close
                      </span>
                    </button>
                  )}
                </div>
                {searchChatQuery && (
                  <span className="text-xs text-[#8696a0] shrink-0 font-medium">
                    {displayedMessages.length} found
                  </span>
                )}
              </div>
            ) : (
              /* Regular Header Content */
              <>
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button on mobile */}
                  <button
                    onClick={() => setSelectedChat("")}
                    className="md:hidden flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef]"
                    style={{ background: "none", border: "none", cursor: "pointer", width: 32, height: 32 }}
                    title="Back to chats"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                      arrow_back
                    </span>
                  </button>

                  {/* Left: Chat info with clickable header */}
                  {selectedChat.isGroupChat ? (
                    <div
                      onClick={onOpenGroupModal}
                      className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                      title="Click to view Group info"
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                        <GroupAvatar size={40} />
                      </div>

                      {/* Name & Sub-text Presence Status */}
                      <div className="min-w-0 flex flex-col justify-center text-left">
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: "600",
                            color: "#e9edef",
                            fontFamily: "'Segoe UI', 'Inter', sans-serif",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.25,
                          }}
                        >
                          {chatName}
                        </span>

                        <span
                          style={{
                            fontSize: "12.5px",
                            fontFamily: "'Segoe UI', 'Inter', sans-serif",
                            marginTop: "1px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {istyping ? (
                            <span style={{ color: "#00a884", fontWeight: "500" }}>
                              {typingUserName ? `${typingUserName} is typing...` : "typing..."}
                            </span>
                          ) : (
                            <span style={{ color: "#8696a0" }}>
                              {selectedChat.users.length} members
                              {onlineMembersCount > 0 && (
                                <>, <span style={{ color: "#00a884" }}>{onlineMembersCount} online</span></>
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <ProfileModal user={chatPartner}>
                      <div className="flex items-center gap-3 cursor-pointer min-w-0 flex-1">
                        {/* Avatar with online presence dot */}
                        <div className="relative shrink-0" style={{ width: 40, height: 40 }}>
                          <UserAvatar user={chatPartner} name={chatName} size={40} />
                          {partnerPresence && (
                            <span
                              title={`Status: ${partnerPresence.status}`}
                              style={{
                                position: "absolute",
                                bottom: 0,
                                right: 0,
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: getStatusColor(partnerPresence.status),
                                border: "2px solid #202c33",
                                boxShadow:
                                  partnerPresence.status === "online"
                                    ? "0 0 5px rgba(0, 168, 132, 0.8)"
                                    : "none",
                              }}
                            />
                          )}
                        </div>

                        {/* Name & Sub-text Presence Status */}
                        <div className="min-w-0 flex flex-col justify-center text-left">
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#e9edef",
                              fontFamily: "'Segoe UI', 'Inter', sans-serif",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              lineHeight: 1.25,
                            }}
                          >
                            {chatName}
                          </span>

                          <span
                            style={{
                              fontSize: "12.5px",
                              fontFamily: "'Segoe UI', 'Inter', sans-serif",
                              marginTop: "1px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {istyping ? (
                              <span style={{ color: "#00a884", fontWeight: "500" }}>typing...</span>
                            ) : partnerPresence?.status === "online" ? (
                              <span style={{ color: "#00a884", fontWeight: "500" }}>online</span>
                            ) : partnerPresence?.status === "away" ? (
                              <span style={{ color: "#f59e0b", fontWeight: "500" }}>away</span>
                            ) : (
                              <span style={{ color: "#8696a0" }}>
                                {partnerPresence?.lastSeen
                                  ? `last seen ${formatLastSeen(partnerPresence.lastSeen)}`
                                  : "offline"}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </ProfileModal>
                  )}
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-1">
                  {/* Search in chat button */}
                  <button
                    onClick={() => setIsSearchingInChat(true)}
                    className="flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] transition-colors"
                    style={{ width: 40, height: 40, background: "none", border: "none", cursor: "pointer" }}
                    title="Search in conversation"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                      search
                    </span>
                  </button>

                  {/* Menu titik tiga (⋮) */}
                  <Menu isLazy>
                    <MenuButton
                      as="button"
                      title="Menu"
                      className="flex items-center justify-center rounded-full text-[#8696a0] hover:text-[#e9edef] transition-colors"
                      style={{ width: 40, height: 40, background: "none", border: "none", cursor: "pointer" }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                        more_vert
                      </span>
                    </MenuButton>
                    <MenuList
                      bg="#202c33"
                      borderColor="#222d34"
                      color="#e9edef"
                      borderRadius="8px"
                      boxShadow="0 8px 24px rgba(0, 0, 0, 0.5)"
                      py={2}
                      px={1}
                      zIndex="popover"
                    >
                      {selectedChat.isGroupChat && (
                        <MenuItem
                          bg="transparent"
                          _hover={{ bg: "#111b21", color: "#00a884" }}
                          borderRadius="6px"
                          fontSize="14px"
                          fontFamily="'Segoe UI', 'Inter', sans-serif"
                          onClick={onOpenGroupModal}
                        >
                          Group info
                        </MenuItem>
                      )}

                      <MenuItem
                        bg="transparent"
                        _hover={{ bg: "#111b21", color: "#00a884" }}
                        borderRadius="6px"
                        fontSize="14px"
                        fontFamily="'Segoe UI', 'Inter', sans-serif"
                        onClick={() => setIsClearModalOpen(true)}
                      >
                        Clear chat
                      </MenuItem>

                      <MenuItem
                        bg="transparent"
                        _hover={{ bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}
                        color="#ef4444"
                        borderRadius="6px"
                        fontSize="14px"
                        fontFamily="'Segoe UI', 'Inter', sans-serif"
                        onClick={() => setIsDeleteModalOpen(true)}
                      >
                        Delete chat
                      </MenuItem>

                      <MenuItem
                        bg="transparent"
                        _hover={{ bg: "#111b21", color: "#8696a0" }}
                        color="#8696a0"
                        borderRadius="6px"
                        fontSize="14px"
                        fontFamily="'Segoe UI', 'Inter', sans-serif"
                        onClick={() => setSelectedChat(null)}
                      >
                        Close chat
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </div>
              </>
            )}
          </header>

          {/* ── Chat Canvas / Messages Area (Sleek Geometric Pattern Wallpaper) ── */}
          <div
            className="flex-1 overflow-hidden flex flex-col relative"
            style={{
              backgroundColor: "#0b141a",
              backgroundImage: `
                radial-gradient(circle at 50% 50%, rgba(0, 168, 132, 0.025) 0%, transparent 80%),
                radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                radial-gradient(rgba(0, 168, 132, 0.02) 1px, transparent 1px)
              `,
              backgroundSize: "100% 100%, 28px 28px, 56px 56px",
              backgroundPosition: "0 0, 0 0, 14px 14px",
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center flex-1">
                <div className="flex flex-col items-center gap-3">
                  <Spinner size="lg" color="#00a884" thickness="3px" />
                  <span style={{ fontSize: "13px", color: "#8696a0" }}>Loading messages...</span>
                </div>
              </div>
            ) : (
              <div className="messages flex-1 flex flex-col overflow-y-auto py-2">
                <ScrollableChat
                  messages={displayedMessages}
                  onDeleteMessage={handleDeleteSingleMessage}
                  searchQuery={searchChatQuery}
                />
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ── Quick Emoji Drawer ── */}
          {showEmojiPicker && (
            <div
              className="shrink-0 px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-t border-[#222d34]"
              style={{ background: "#202c33" }}
            >
              {QUICK_EMOJIS.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => handleInsertEmoji(emoji)}
                  className="px-2 py-1 rounded text-xl hover:bg-[#111b21] transition-transform active:scale-90"
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* ── Bottom Input Bar (Docked Footer: #202c33, Pill-shaped input, Text & Emoji only) ── */}
          <div
            className="shrink-0 flex items-center gap-2 px-3 md:px-4 py-2.5"
            style={{
              background: "#202c33",
              borderTop: "1px solid #222d34",
              minHeight: "62px",
            }}
            onKeyDown={sendMessage}
          >
            {/* Emoji Button */}
            <button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              title="Emoji"
              className="flex items-center justify-center rounded-full transition-colors shrink-0"
              style={{
                width: 40,
                height: 40,
                color: showEmojiPicker ? "#00a884" : "#8696a0",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (!showEmojiPicker) e.currentTarget.style.color = "#e9edef";
              }}
              onMouseLeave={(e) => {
                if (!showEmojiPicker) e.currentTarget.style.color = "#8696a0";
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                mood
              </span>
            </button>

            {/* Pill-shaped Text Input */}
            <div
              className="flex-1 flex items-center px-4 rounded-lg transition-all"
              style={{
                background: "#2a3942",
                minHeight: "42px",
                border: "1px solid transparent",
              }}
            >
              <input
                ref={inputRef}
                className="w-full bg-transparent focus:outline-none"
                style={{
                  color: "#e9edef",
                  fontFamily: "'Segoe UI', 'Inter', sans-serif",
                  fontSize: "15px",
                  lineHeight: "1.5",
                  border: "none",
                  outline: "none",
                  padding: "8px 0",
                }}
                placeholder="Type a message"
                value={newMessage}
                onChange={typingHandler}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
            </div>

            {/* Send Button */}
            <button
              onClick={sendMessageClick}
              disabled={!newMessage.trim()}
              title={newMessage.trim() ? "Send message (Enter)" : "Type a message to send"}
              className="flex items-center justify-center rounded-full shrink-0 transition-all active:scale-95"
              style={{
                width: 42,
                height: 42,
                background: newMessage.trim() ? "#00a884" : "transparent",
                color: newMessage.trim() ? "#111b21" : "#8696a0",
                opacity: newMessage.trim() ? 1 : 0.4,
                border: "none",
                cursor: newMessage.trim() ? "pointer" : "default",
                boxShadow: newMessage.trim() ? "0 2px 4px rgba(0, 0, 0, 0.3)" : "none",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                send
              </span>
            </button>
          </div>
        </>
      ) : (
        /* ── WhatsApp Web Standard Empty State ── */
        <div
          className="flex flex-col items-center justify-between h-full w-full py-12 px-6 select-none relative"
          style={{
            background: "#222e35",
            borderBottom: "6px solid #00a884",
          }}
        >
          <div className="flex-1 flex flex-col items-center justify-center max-w-md text-center">
            {/* Desktop / Chat Icon */}
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{
                background: "#111b21",
                border: "2px solid #2a3942",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "44px", color: "#00a884" }}>
                lock
              </span>
            </div>

            <h2
              style={{
                fontSize: "26px",
                fontWeight: "400",
                color: "#e9edef",
                fontFamily: "'Segoe UI', 'Inter', sans-serif",
                marginBottom: "8px",
              }}
            >
              Talk-A-Tive Web
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#8696a0",
                lineHeight: "1.6",
                fontFamily: "'Segoe UI', 'Inter', sans-serif",
              }}
            >
              Send and receive messages without keeping your phone online.
              <br />
              Use Talk-A-Tive across all your linked tabs and devices.
            </p>
          </div>

          {/* Bottom Security Note */}
          <div className="flex items-center gap-1.5 text-xs text-[#8696a0]">
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
              lock
            </span>
            <span>End-to-end encrypted real-time messaging</span>
          </div>
        </div>
      )}

      {/* ── Clear Chat Confirmation Modal (WhatsApp Style) ── */}
      <Modal isLazy onClose={() => setIsClearModalOpen(false)} isOpen={isClearModalOpen} isCentered size="md">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(3px)" />
        <ModalContent
          style={{
            background: "#202c33",
            border: "1px solid #222d34",
            borderRadius: "12px",
            color: "#e9edef",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            maxWidth: "420px",
          }}
        >
          <ModalHeader
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid #222d34",
              fontSize: "16px",
              fontWeight: "600",
              color: "#e9edef",
              fontFamily: "'Segoe UI', 'Inter', sans-serif",
            }}
          >
            Clear this chat?
          </ModalHeader>
          <ModalCloseButton color="#8696a0" top="14px" right="14px" />

          <ModalBody style={{ padding: "20px" }}>
            <p
              style={{
                fontSize: "14px",
                color: "#8696a0",
                lineHeight: "1.5",
                fontFamily: "'Segoe UI', 'Inter', sans-serif",
              }}
            >
              Messages in this chat will be cleared from your account only. Other participants will not be affected.
            </p>
          </ModalBody>

          <ModalFooter
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #222d34",
              gap: "10px",
            }}
          >
            <Button
              variant="ghost"
              color="#8696a0"
              _hover={{ bg: "#111b21", color: "#e9edef" }}
              borderRadius="8px"
              fontSize="14px"
              onClick={() => setIsClearModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              bg="#d97706"
              _hover={{ bg: "#b45309" }}
              color="#ffffff"
              borderRadius="8px"
              fontSize="14px"
              fontWeight="600"
              isLoading={clearLoading}
              onClick={handleClearChat}
            >
              Clear chat
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Delete Chat Confirmation Modal (WhatsApp Style) ── */}
      <Modal isLazy onClose={() => setIsDeleteModalOpen(false)} isOpen={isDeleteModalOpen} isCentered size="md">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(3px)" />
        <ModalContent
          style={{
            background: "#202c33",
            border: "1px solid #222d34",
            borderRadius: "12px",
            color: "#e9edef",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
            maxWidth: "420px",
          }}
        >
          <ModalHeader
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid #222d34",
              fontSize: "16px",
              fontWeight: "600",
              color: "#e9edef",
              fontFamily: "'Segoe UI', 'Inter', sans-serif",
            }}
          >
            Delete this chat?
          </ModalHeader>
          <ModalCloseButton color="#8696a0" top="14px" right="14px" />

          <ModalBody style={{ padding: "20px" }}>
            <p
              style={{
                fontSize: "14px",
                color: "#8696a0",
                lineHeight: "1.5",
                fontFamily: "'Segoe UI', 'Inter', sans-serif",
              }}
            >
              Are you sure you want to delete the chat with{" "}
              <strong style={{ color: "#e9edef" }}>{chatName}</strong>?
              This chat and its past message history will be removed from your account.
            </p>
          </ModalBody>

          <ModalFooter
            style={{
              padding: "14px 20px",
              borderTop: "1px solid #222d34",
              gap: "10px",
            }}
          >
            <Button
              variant="ghost"
              color="#8696a0"
              _hover={{ bg: "#111b21", color: "#e9edef" }}
              borderRadius="8px"
              fontSize="14px"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              bg="#ef4444"
              _hover={{ bg: "#dc2626" }}
              color="#ffffff"
              borderRadius="8px"
              fontSize="14px"
              fontWeight="600"
              isLoading={deleteLoading}
              onClick={handleDeleteChat}
            >
              Delete chat
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Group Info Modal */}
      {selectedChat?.isGroupChat && (
        <UpdateGroupChatModal
          isOpen={isGroupModalOpen}
          onClose={onCloseGroupModal}
          fetchMessages={fetchMessages}
          fetchAgain={fetchAgain}
          setFetchAgain={setFetchAgain}
        />
      )}
    </>
  );
};

export default SingleChat;
