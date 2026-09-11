import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useEffect, useState, useRef } from "react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { getUserPresence, getStatusColor } from "../config/userStatus";
import ChatLoading from "./ChatLoading";
import GroupChatModal from "./miscellaneous/GroupChatModal";
import ProfileModal from "./miscellaneous/ProfileModal";
import UserListItem from "./userAvatar/UserListItem";
import UserAvatar from "./userAvatar/UserAvatar";
import { ChatState } from "../Context/ChatProvider";
import { Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/menu";
import { Spinner } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";

const MyChats = ({ fetchAgain }) => {
  const [loggedUser, setLoggedUser] = useState();
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [filterTab, setFilterTab] = useState("all"); // "all" | "unread" | "groups" | "online"
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [typingChats, setTypingChats] = useState({});
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const typingTimeoutsRef = useRef({});

  const {
    selectedChat,
    setSelectedChat,
    user,
    setUser,
    chats,
    setChats,
    notification,
    setNotification,
    onlineUsers,
    myStatus,
    socket,
  } = ChatState();
  const toast = useToast();
  const history = useHistory();

  const totalUnread = Array.isArray(chats)
    ? chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0)
    : 0;

  // Compute online peers list excluding oneself
  const onlinePeerEntries = Object.entries(onlineUsers || {}).filter(([id, data]) => {
    const isMe = user && (String(id) === String(user._id) || String(id) === String(user.username));
    return !isMe && data && (data.status === "online" || data.status === "away");
  });
  const onlineCount = onlinePeerEntries.length;

  // Sync browser document title with unread count
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Talk-A-Tive — Real-Time Chat App`;
    } else {
      document.title = "Talk-A-Tive — Real-Time Chat App";
    }
  }, [totalUnread]);

  const fetchChats = async () => {
    try {
      const currentUser = user || JSON.parse(localStorage.getItem("userInfo"));
      if (!currentUser?.token) return;
      const config = { headers: { Authorization: `Bearer ${currentUser.token}` } };
      const { data } = await axios.get("/api/chat", config);
      setChats(Array.isArray(data) ? data : []);
      if (socket && Array.isArray(data) && data.length) {
        socket.emit("join user chats", data.map((c) => c._id));
      }
    } catch (error) {
      toast({ title: "Failed to load chats", status: "error", duration: 4000, isClosable: true, position: "bottom-left" });
    }
  };

  useEffect(() => {
    setLoggedUser(JSON.parse(localStorage.getItem("userInfo")));
    fetchChats();
    // eslint-disable-next-line
  }, [fetchAgain]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      Object.values(typingTimeoutsRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  // Real-time socket message handler for unread badge counters, typing, read receipts & sync
  useEffect(() => {
    if (!socket) return;

    const handleMessageRecieved = (newMessage) => {
      if (!newMessage || !newMessage.chat) return;

      const chatId = String(newMessage.chat._id || newMessage.chat);
      const isCurrentChat = selectedChat && String(selectedChat._id) === chatId;

      // Clear typing indicator for this chat upon receiving a new message
      if (typingTimeoutsRef.current[chatId]) {
        clearTimeout(typingTimeoutsRef.current[chatId]);
        delete typingTimeoutsRef.current[chatId];
      }
      setTypingChats((prev) => {
        if (!prev[chatId]) return prev;
        const updated = { ...prev };
        delete updated[chatId];
        return updated;
      });

      setChats((prevChats) => {
        if (!Array.isArray(prevChats)) return prevChats;

        const existingIndex = prevChats.findIndex((c) => String(c._id) === chatId);

        if (existingIndex === -1) {
          fetchChats();
          return prevChats;
        }

        const targetChat = prevChats[existingIndex];
        const isSystem = newMessage.isSystemMessage === true;
        const updatedChat = {
          ...targetChat,
          latestMessage: newMessage,
          unreadCount: isCurrentChat ? 0 : (targetChat.unreadCount || 0) + (isSystem ? 0 : 1),
        };

        const remainingChats = prevChats.filter((c) => String(c._id) !== chatId);
        return [updatedChat, ...remainingChats];
      });
    };

    // Live Read Receipt Sync (Double Blue Ticks)
    const handleMessagesReadUpdate = ({ chatId, readerId }) => {
      const currentUserId = String(user?._id || loggedUser?._id || "");
      const readerIdStr = String(readerId);
      const chatIdStr = String(chatId);

      setChats((prevChats) => {
        if (!Array.isArray(prevChats)) return prevChats;
        return prevChats.map((c) => {
          if (String(c._id) !== chatIdStr) return c;

          // If current user read messages in this chat, reset unread counter
          if (readerIdStr === currentUserId) {
            return { ...c, unreadCount: 0 };
          }

          // If peer read current user's message, update readBy so sender's tick turns double cyan live
          if (
            c.latestMessage &&
            String(c.latestMessage.sender?._id || c.latestMessage.sender) === currentUserId
          ) {
            const existingReadBy = Array.isArray(c.latestMessage.readBy) ? c.latestMessage.readBy : [];
            const alreadyIn = existingReadBy.some((u) => String(u._id || u) === readerIdStr);
            if (!alreadyIn) {
              return {
                ...c,
                latestMessage: {
                  ...c.latestMessage,
                  readBy: [...existingReadBy, readerIdStr],
                },
              };
            }
          }

          return c;
        });
      });
    };

    // Live Delivered Receipt Sync (Double Gray Ticks)
    const handleMessagesDeliveredUpdate = (payload) => {
      if (!payload) return;
      const currentUserId = String(user?._id || loggedUser?._id || "");
      const peerUserId = String(payload.userId || "");
      const chatId = String(payload.chatId || "");

      if (!chatId || peerUserId === currentUserId) return;

      setChats((prevChats) => {
        if (!Array.isArray(prevChats)) return prevChats;
        return prevChats.map((c) => {
          if (String(c._id) !== chatId) return c;
          if (
            c.latestMessage &&
            String(c.latestMessage.sender?._id || c.latestMessage.sender) === currentUserId
          ) {
            const existingDelivered = Array.isArray(c.latestMessage.deliveredTo)
              ? c.latestMessage.deliveredTo
              : [];
            const alreadyIn = existingDelivered.some((u) => String(u._id || u) === peerUserId);
            if (!alreadyIn) {
              return {
                ...c,
                latestMessage: {
                  ...c.latestMessage,
                  deliveredTo: [...existingDelivered, peerUserId],
                },
              };
            }
          }
          return c;
        });
      });
    };

    const handleTyping = (data) => {
      if (!data) return;
      const chatId = typeof data === "object" ? String(data.chatId || data.room) : String(data);
      const senderId = typeof data === "object" ? String(data.senderId || data.userId || "") : "";
      const senderName = typeof data === "object" ? (data.senderName || data.name || "") : "";

      if (senderId && user && String(senderId) === String(user._id)) return;
      if (!chatId) return;

      setTypingChats((prev) => ({
        ...prev,
        [chatId]: senderName || "Someone",
      }));

      // Auto-clear typing indicator after 3.5 seconds if sender drops/stops without signal
      if (typingTimeoutsRef.current[chatId]) {
        clearTimeout(typingTimeoutsRef.current[chatId]);
      }
      typingTimeoutsRef.current[chatId] = setTimeout(() => {
        setTypingChats((prev) => {
          if (!prev[chatId]) return prev;
          const updated = { ...prev };
          delete updated[chatId];
          return updated;
        });
        delete typingTimeoutsRef.current[chatId];
      }, 3500);
    };

    const handleStopTyping = (data) => {
      if (!data) return;
      const chatId = typeof data === "object" ? String(data.chatId || data.room) : String(data);
      if (!chatId) return;

      if (typingTimeoutsRef.current[chatId]) {
        clearTimeout(typingTimeoutsRef.current[chatId]);
        delete typingTimeoutsRef.current[chatId];
      }

      setTypingChats((prev) => {
        if (!prev[chatId]) return prev;
        const updated = { ...prev };
        delete updated[chatId];
        return updated;
      });
    };

    const handleChatCleared = (clearedChatId) => {
      const idStr = String(clearedChatId);
      setChats((prevChats) =>
        Array.isArray(prevChats)
          ? prevChats.map((c) =>
              String(c._id) === idStr ? { ...c, latestMessage: null, unreadCount: 0 } : c
            )
          : []
      );
    };

    const handleMessageDeleted = ({ messageId, chatId }) => {
      const idStr = String(chatId);
      setChats((prevChats) =>
        Array.isArray(prevChats)
          ? prevChats.map((c) => {
              if (String(c._id) === idStr && String(c.latestMessage?._id) === String(messageId)) {
                return { ...c, latestMessage: null };
              }
              return c;
            })
          : []
      );
      fetchChats();
    };

    const handleChatDeleted = (deletedChatId) => {
      const idStr = String(deletedChatId);
      setChats((prevChats) =>
        Array.isArray(prevChats) ? prevChats.filter((c) => String(c._id) !== idStr) : []
      );
      if (selectedChat && String(selectedChat._id) === idStr) {
        setSelectedChat(null);
      }
    };

    const handleGroupUpdated = (updatedChat) => {
      if (!updatedChat?._id) return;
      const idStr = String(updatedChat._id);
      setChats((prevChats) =>
        Array.isArray(prevChats)
          ? prevChats.map((c) => (String(c._id) === idStr ? { ...c, ...updatedChat } : c))
          : []
      );
    };

    socket.on("message recieved", handleMessageRecieved);
    socket.on("messages read update", handleMessagesReadUpdate);
    socket.on("message delivered update", handleMessagesDeliveredUpdate);
    socket.on("messages delivered update", handleMessagesDeliveredUpdate);
    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);
    socket.on("chat cleared", handleChatCleared);
    socket.on("message deleted", handleMessageDeleted);
    socket.on("chat deleted", handleChatDeleted);
    socket.on("group updated", handleGroupUpdated);

    return () => {
      socket.off("message recieved", handleMessageRecieved);
      socket.off("messages read update", handleMessagesReadUpdate);
      socket.off("message delivered update", handleMessagesDeliveredUpdate);
      socket.off("messages delivered update", handleMessagesDeliveredUpdate);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
      socket.off("chat cleared", handleChatCleared);
      socket.off("message deleted", handleMessageDeleted);
      socket.off("chat deleted", handleChatDeleted);
      socket.off("group updated", handleGroupUpdated);
    };
  }, [socket, selectedChat, user, loggedUser]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setChats((prev) =>
      Array.isArray(prev) ? prev.map((c) => (c._id === chat._id ? { ...c, unreadCount: 0 } : c)) : []
    );
    setNotification((prev) => (Array.isArray(prev) ? prev.filter((n) => n.chat?._id !== chat._id) : []));

    // Instantly notify socket that messages are read upon selection
    const currentUserId = user?._id || loggedUser?._id;
    if (socket && currentUserId && chat?._id) {
      socket.emit("mark messages read", { chatId: chat._id, userId: currentUserId });
    }
  };

  // Debounced search to avoid spamming the backend directory search
  const handleSearch = (query) => {
    setSearch(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!query.trim()) {
      setSearchResult([]);
      setLoadingSearch(false);
      return;
    }

    setLoadingSearch(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const currentUser = user || JSON.parse(localStorage.getItem("userInfo"));
        if (!currentUser?.token) return;
        const config = { headers: { Authorization: `Bearer ${currentUser.token}` } };
        const { data } = await axios.get(
          `/api/user?search=${encodeURIComponent(query.trim())}`,
          config
        );
        setSearchResult(Array.isArray(data) ? data : []);
      } catch (error) {
        toast({ title: "Search failed", status: "error", duration: 3000, isClosable: true, position: "bottom-left" });
      } finally {
        setLoadingSearch(false);
      }
    }, 300);
  };

  const accessChat = async (userId) => {
    try {
      const currentUser = user || JSON.parse(localStorage.getItem("userInfo"));
      if (!currentUser?.token) return;
      const config = {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${currentUser.token}` },
      };
      const { data } = await axios.post(`/api/chat`, { userId }, config);
      setChats((prev) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.find((c) => c._id === data._id) ? arr : [data, ...arr];
      });
      setSelectedChat(data);
      if (socket && data?._id) {
        socket.emit("join chat", data._id);
      }
      setSearch("");
      setSearchResult([]);
      setFilterTab("all");
    } catch (error) {
      toast({ title: "Failed to access chat", description: error.message, status: "error", duration: 4000, isClosable: true, position: "bottom-left" });
    }
  };

  const logoutHandler = () => {
    if (socket) {
      socket.disconnect();
    }
    localStorage.removeItem("userInfo");
    if (setUser) setUser(null);
    if (setSelectedChat) setSelectedChat(null);
    history.push("/");
  };

  /* ─── Group Avatar Helper ───────────────────── */
  const GroupAvatar = ({ size = 49 }) => (
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

  /* ─── Avatar Initial Helper ─────────────────── */
  const AvatarInitial = ({ name, size = 49 }) => {
    const colors = ["#005c4b", "#128c7e", "#075e54", "#1f7a65", "#00a884", "#2e7d32", "#00796b"];
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

  /* ─── Chat time format (Exact WhatsApp date logic) ─────────────────── */
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();

    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  };

  /* ─── Render Sender Status Ticks (Single / Double Gray / Double Blue) ─── */
  const renderLatestMessageStatus = (latestMsg) => {
    if (!latestMsg || latestMsg.isSystemMessage) return null;
    const currentUserId = String(user?._id || loggedUser?._id || "");
    const senderId = String(latestMsg.sender?._id || latestMsg.sender || "");
    if (senderId !== currentUserId) return null;

    const readBy = Array.isArray(latestMsg.readBy) ? latestMsg.readBy : [];
    const deliveredTo = Array.isArray(latestMsg.deliveredTo) ? latestMsg.deliveredTo : [];

    const isReadByOther = readBy.some((u) => String(u._id || u) !== currentUserId);
    if (isReadByOther) {
      return (
        <span
          className="material-symbols-outlined shrink-0"
          style={{ fontSize: "16px", color: "#53bdeb", marginRight: "3px" }}
          title="Read"
        >
          done_all
        </span>
      );
    }

    const isDeliveredToOther = deliveredTo.some((u) => String(u._id || u) !== currentUserId);
    if (isDeliveredToOther) {
      return (
        <span
          className="material-symbols-outlined shrink-0"
          style={{ fontSize: "16px", color: "#8696a0", marginRight: "3px" }}
          title="Delivered"
        >
          done_all
        </span>
      );
    }

    return (
      <span
        className="material-symbols-outlined shrink-0"
        style={{ fontSize: "16px", color: "#8696a0", marginRight: "3px" }}
        title="Sent"
      >
        check
      </span>
    );
  };

  // Filter chats by tab
  const filteredChats = Array.isArray(chats)
    ? chats.filter((c) => {
        if (filterTab === "unread") return (c.unreadCount || 0) > 0;
        if (filterTab === "groups") return c.isGroupChat === true;
        return true;
      })
    : [];

  // Filter chats by search keyword
  const visibleChats = search.trim()
    ? filteredChats.filter((c) => {
        const currentUser = user || loggedUser;
        const name = !c.isGroupChat ? getSender(currentUser, c.users) : c.chatName;
        return (name || "").toLowerCase().includes(search.toLowerCase());
      })
    : filteredChats;

  return (
    <section
      className={`shrink-0 h-full flex flex-col z-20 transition-all duration-300 ${
        selectedChat ? "hidden md:flex" : "flex"
      } w-full md:w-[380px] lg:w-[400px] xl:w-[420px]`}
      style={{
        minWidth: "320px",
        maxWidth: "460px",
        background: "#111b21",
        borderRight: "1px solid #222d34",
      }}
    >
      {/* ── Top Header (WhatsApp Web Standard: 60px height, #202c33) ── */}
      <header
        className="shrink-0 flex items-center justify-between px-4"
        style={{
          height: "60px",
          background: "#202c33",
          borderBottom: "1px solid #222d34",
        }}
      >
        {/* Left: User Avatar + Online status */}
        <div className="flex items-center gap-3">
          <ProfileModal user={user}>
            <div className="relative cursor-pointer" title="View profile">
              <UserAvatar user={user} size={40} />
              {/* Online indicator dot */}
              <span
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 11,
                  height: 11,
                  borderRadius: "50%",
                  background: getStatusColor(myStatus),
                  border: "2px solid #202c33",
                  boxShadow: myStatus === "online" ? "0 0 5px rgba(0, 168, 132, 0.8)" : "none",
                }}
              />
            </div>
          </ProfileModal>

          <div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: "600",
                color: "#e9edef",
                fontFamily: "'Segoe UI', 'Inter', sans-serif",
                lineHeight: 1.2,
              }}
            >
              {user.name?.split(" ")[0]}
            </div>
            <div
              style={{
                fontSize: "11px",
                color: getStatusColor(myStatus),
                fontWeight: "500",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: getStatusColor(myStatus),
                  display: "inline-block",
                }}
              />
              {myStatus === "away" ? "Away" : "Online"}
            </div>
          </div>
        </div>

        {/* Right: Actions (Status, New Community/Group, New Chat, Menu ⋮) */}
        <div className="flex items-center gap-1">
          {/* Status / Active Users button */}
          <button
            onClick={() => setFilterTab((prev) => (prev === "online" ? "all" : "online"))}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 40,
              height: 40,
              color: filterTab === "online" ? "#00a884" : "#aebac1",
              background: filterTab === "online" ? "rgba(0, 168, 132, 0.15)" : "transparent",
              border: "none",
              cursor: "pointer",
            }}
            title={`Status & Active Users (${onlineCount})`}
            onMouseEnter={(e) => {
              if (filterTab !== "online") e.currentTarget.style.color = "#e9edef";
            }}
            onMouseLeave={(e) => {
              if (filterTab !== "online") e.currentTarget.style.color = "#aebac1";
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
              donut_large
            </span>
          </button>

          {/* New Group button */}
          <GroupChatModal>
            <button
              className="flex items-center justify-center rounded-full transition-colors"
              style={{
                width: 40,
                height: 40,
                color: "#aebac1",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              title="New Group"
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e9edef")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#aebac1")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                groups
              </span>
            </button>
          </GroupChatModal>

          {/* New Chat button */}
          <button
            onClick={() => {
              setFilterTab("all");
              searchInputRef.current?.focus();
            }}
            className="flex items-center justify-center rounded-full transition-colors"
            style={{
              width: 40,
              height: 40,
              color: "#aebac1",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
            title="New Chat"
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e9edef")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#aebac1")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "21px" }}>
              chat
            </span>
          </button>

          {/* Menu Titik Tiga (⋮) */}
          <Menu isLazy>
            <MenuButton
              as="button"
              className="flex items-center justify-center rounded-full transition-colors"
              style={{
                width: 40,
                height: 40,
                color: "#aebac1",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
              title="Menu"
              onMouseEnter={(e) => (e.currentTarget.style.color = "#e9edef")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#aebac1")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>
                more_vert
              </span>
            </MenuButton>

            <MenuList
              bg="#202c33"
              borderColor="#222d34"
              color="#e9edef"
              boxShadow="0 8px 24px rgba(0,0,0,0.5)"
              borderRadius="8px"
              py={2}
              px={1}
              zIndex="popover"
            >
              <GroupChatModal>
                <MenuItem
                  bg="transparent"
                  _hover={{ bg: "#111b21", color: "#00a884" }}
                  borderRadius="6px"
                  fontSize="14px"
                  fontFamily="'Segoe UI', 'Inter', sans-serif"
                >
                  New Group
                </MenuItem>
              </GroupChatModal>

              <MenuItem
                bg="transparent"
                _hover={{ bg: "#111b21", color: "#00a884" }}
                borderRadius="6px"
                fontSize="14px"
                fontFamily="'Segoe UI', 'Inter', sans-serif"
                onClick={() => setFilterTab("online")}
              >
                Active Users ({onlineCount})
              </MenuItem>

              <ProfileModal user={user}>
                <MenuItem
                  bg="transparent"
                  _hover={{ bg: "#111b21", color: "#00a884" }}
                  borderRadius="6px"
                  fontSize="14px"
                  fontFamily="'Segoe UI', 'Inter', sans-serif"
                >
                  My Profile
                </MenuItem>
              </ProfileModal>

              <MenuItem
                bg="transparent"
                _hover={{ bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}
                borderRadius="6px"
                fontSize="14px"
                fontFamily="'Segoe UI', 'Inter', sans-serif"
                color="#ef4444"
                onClick={logoutHandler}
              >
                Log Out
              </MenuItem>
            </MenuList>
          </Menu>
        </div>
      </header>

      {/* ── Search & Filter Bar (WhatsApp Web Standard: Search + [All] [Unread] [Groups] [Active]) ── */}
      <div className="shrink-0 px-3 pt-2 pb-2" style={{ background: "#111b21" }}>
        {/* Search input container */}
        <div
          className="flex items-center gap-3 px-3 rounded-lg transition-all"
          style={{
            background: "#202c33",
            height: "36px",
            border: isSearchFocused ? "1px solid #00a884" : "1px solid transparent",
          }}
        >
          <span
            className="material-symbols-outlined shrink-0"
            style={{ fontSize: "18px", color: isSearchFocused ? "#00a884" : "#8696a0" }}
          >
            search
          </span>
          <input
            ref={searchInputRef}
            className="flex-1 bg-transparent focus:outline-none text-sm"
            style={{
              color: "#e9edef",
              fontFamily: "'Segoe UI', 'Inter', sans-serif",
            }}
            placeholder="Search or start new chat"
            type="text"
            value={search}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                setSearchResult([]);
              }}
              style={{
                color: "#8696a0",
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                close
              </span>
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 mt-2.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => {
              setFilterTab("all");
              setSearch("");
              setSearchResult([]);
            }}
            className="shrink-0 px-3 py-1 rounded-full text-xs transition-colors duration-150"
            style={{
              background: filterTab === "all" ? "#0a332c" : "#202c33",
              color: filterTab === "all" ? "#00a884" : "#8696a0",
              border: filterTab === "all" ? "1px solid #00a884" : "1px solid transparent",
              fontWeight: filterTab === "all" ? "600" : "500",
              cursor: "pointer",
            }}
          >
            All
          </button>

          <button
            onClick={() => {
              setFilterTab("unread");
              setSearch("");
              setSearchResult([]);
            }}
            className="shrink-0 px-3 py-1 rounded-full text-xs transition-colors duration-150 flex items-center gap-1.5"
            style={{
              background: filterTab === "unread" ? "#0a332c" : "#202c33",
              color: filterTab === "unread" ? "#00a884" : "#8696a0",
              border: filterTab === "unread" ? "1px solid #00a884" : "1px solid transparent",
              fontWeight: filterTab === "unread" ? "600" : "500",
              cursor: "pointer",
            }}
          >
            <span>Unread</span>
            {totalUnread > 0 && (
              <span
                style={{
                  background: "#00a884",
                  color: "#111b21",
                  borderRadius: "9999px",
                  padding: "0 5px",
                  fontSize: "10px",
                  fontWeight: "700",
                }}
              >
                {totalUnread}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setFilterTab("groups");
              setSearch("");
              setSearchResult([]);
            }}
            className="shrink-0 px-3 py-1 rounded-full text-xs transition-colors duration-150"
            style={{
              background: filterTab === "groups" ? "#0a332c" : "#202c33",
              color: filterTab === "groups" ? "#00a884" : "#8696a0",
              border: filterTab === "groups" ? "1px solid #00a884" : "1px solid transparent",
              fontWeight: filterTab === "groups" ? "600" : "500",
              cursor: "pointer",
            }}
          >
            Groups
          </button>

          <button
            onClick={() => {
              setFilterTab("online");
              setSearch("");
              setSearchResult([]);
            }}
            className="shrink-0 px-3 py-1 rounded-full text-xs transition-colors duration-150 flex items-center gap-1.5"
            style={{
              background: filterTab === "online" ? "#0a332c" : "#202c33",
              color: filterTab === "online" ? "#00a884" : "#8696a0",
              border: filterTab === "online" ? "1px solid #00a884" : "1px solid transparent",
              fontWeight: filterTab === "online" ? "600" : "500",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#00a884",
                display: "inline-block",
              }}
            />
            <span>Active ({onlineCount})</span>
          </button>
        </div>
      </div>

      {/* ── Main List Area: Chats, Search Results, or Active Users ── */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#111b21" }}>
        {filterTab === "online" ? (
          /* Active Users List (WhatsApp Style) */
          <div className="py-2">
            <div
              className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8696a0" }}
            >
              <span>Currently Online</span>
              <span style={{ color: "#00a884" }}>{onlineCount} active</span>
            </div>

            {onlineCount === 0 ? (
              <div className="text-center py-12 px-4">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "#202c33", color: "#8696a0" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    person_off
                  </span>
                </div>
                <p className="text-xs font-medium" style={{ color: "#e9edef" }}>
                  No other users are online right now
                </p>
                <p className="text-xs mt-1" style={{ color: "#8696a0" }}>
                  When peers connect, they will appear here live.
                </p>
              </div>
            ) : (
              onlinePeerEntries
                .filter(([peerId, peerData]) => {
                  if (!search) return true;
                  const query = search.toLowerCase();
                  const name = (peerData.name || "").toLowerCase();
                  const uName = (peerData.username || "").toLowerCase();
                  return name.includes(query) || uName.includes(query);
                })
                .map(([peerId, peerData]) => {
                  const displayName = peerData.name || peerData.username || "Active User";
                  const username = peerData.username ? `@${peerData.username}` : "";
                  const isAway = peerData.status === "away";

                  return (
                    <div
                      key={peerId}
                      onClick={() => accessChat(peerId)}
                      className="flex items-center px-4 cursor-pointer transition-colors duration-150"
                      style={{
                        height: "72px",
                        borderBottom: "1px solid #222d34",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#202c33")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div className="relative mr-3 shrink-0" style={{ width: 49, height: 49 }}>
                        <UserAvatar user={peerData} name={displayName} size={49} />
                        <span
                          style={{
                            position: "absolute",
                            bottom: 1,
                            right: 1,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: isAway ? "#f59e0b" : "#00a884",
                            border: "2.5px solid #111b21",
                            boxShadow: isAway ? "none" : "0 0 6px rgba(0, 168, 132, 0.7)",
                          }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: "500",
                            color: "#e9edef",
                            fontFamily: "'Segoe UI', 'Inter', sans-serif",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {displayName}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: "13px" }}>
                          <span style={{ color: "#8696a0" }}>{username}</span>
                          <span style={{ color: "#464555" }}>•</span>
                          <span style={{ color: isAway ? "#f59e0b" : "#00a884", fontWeight: "500" }}>
                            {isAway ? "Away" : "Online"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          accessChat(peerId);
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={{
                          background: "#00a884",
                          color: "#111b21",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#029070")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#00a884")}
                      >
                        Chat
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        ) : search.trim() ? (
          /* Search Results */
          <div className="py-2">
            {/* Matching existing chats */}
            {visibleChats.length > 0 && (
              <>
                <div
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#8696a0" }}
                >
                  Chats
                </div>
                {visibleChats.map((chat) => {
                  const isSelected = selectedChat?._id === chat._id;
                  const currentUser = user || loggedUser;
                  const chatName = !chat.isGroupChat
                    ? getSender(currentUser, chat.users)
                    : chat.chatName;
                  const otherUser = !chat.isGroupChat
                    ? getSenderFull(currentUser, chat.users)
                    : null;
                  const presence = otherUser ? getUserPresence(otherUser, onlineUsers) : null;
                  const unreadCount = chat.unreadCount || 0;
                  const hasUnread = unreadCount > 0;

                  return (
                    <div
                      key={chat._id}
                      onClick={() => handleSelectChat(chat)}
                      className="flex items-center px-4 cursor-pointer transition-colors duration-150"
                      style={{
                        height: "72px",
                        background: isSelected ? "#2a3942" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "#202c33";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div className="relative mr-3 shrink-0" style={{ width: 49, height: 49 }}>
                        {chat.isGroupChat ? (
                          <GroupAvatar size={49} />
                        ) : (
                          <UserAvatar user={otherUser} name={chatName} size={49} />
                        )}
                        {!chat.isGroupChat && presence && (
                          <span
                            style={{
                              position: "absolute",
                              bottom: 1,
                              right: 1,
                              width: 12,
                              height: 12,
                              borderRadius: "50%",
                              background: getStatusColor(presence.status),
                              border: "2.5px solid #111b21",
                            }}
                          />
                        )}
                      </div>

                      <div
                        className="flex-1 min-w-0 flex flex-col justify-center h-full"
                        style={{ borderBottom: "1px solid #222d34" }}
                      >
                        <div className="flex justify-between items-baseline mb-1">
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: hasUnread ? "600" : "500",
                              color: "#e9edef",
                              fontFamily: "'Segoe UI', 'Inter', sans-serif",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {chatName}
                          </span>
                          {chat.latestMessage && (
                            <span
                              style={{
                                fontSize: "12px",
                                color: hasUnread ? "#00a884" : "#8696a0",
                                fontWeight: hasUnread ? "600" : "400",
                              }}
                            >
                              {formatTime(chat.latestMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center min-w-0 flex-1">
                            {renderLatestMessageStatus(chat.latestMessage)}
                            <span
                              style={{
                                fontSize: "13.5px",
                                color: hasUnread ? "#e9edef" : "#8696a0",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {chat.latestMessage?.content || "No messages yet"}
                            </span>
                          </div>
                          {hasUnread && (
                            <span
                              style={{
                                minWidth: "20px",
                                height: "20px",
                                padding: "0 6px",
                                borderRadius: "9999px",
                                background: "#00a884",
                                color: "#111b21",
                                fontSize: "11.5px",
                                fontWeight: "700",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {/* Directory users search results */}
            <div
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider mt-2"
              style={{ color: "#8696a0" }}
            >
              Directory Contacts
            </div>

            {loadingSearch ? (
              <div className="flex justify-center my-6">
                <Spinner color="#00a884" />
              </div>
            ) : searchResult?.length === 0 ? (
              <div className="text-center py-6" style={{ color: "#8696a0", fontSize: "13px" }}>
                No contact found in directory
              </div>
            ) : (
              searchResult.map((u) => (
                <UserListItem
                  key={u._id}
                  user={u}
                  presence={getUserPresence(u, onlineUsers)}
                  handleFunction={() => accessChat(u._id)}
                />
              ))
            )}
          </div>
        ) : (
          /* Normal WhatsApp Chat List */
          <div>
            {visibleChats.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "#202c33", color: "#8696a0" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>
                    chat_bubble_outline
                  </span>
                </div>
                <p className="text-sm font-medium" style={{ color: "#e9edef" }}>
                  {filterTab === "unread"
                    ? "No unread chats"
                    : filterTab === "groups"
                    ? "No group chats yet"
                    : "No chats yet"}
                </p>
                <p className="text-xs mt-1" style={{ color: "#8696a0" }}>
                  {filterTab === "unread"
                    ? "You are all caught up!"
                    : filterTab === "groups"
                    ? "Create a group using the group icon above."
                    : "Start a conversation by searching contacts or checking active users."}
                </p>
              </div>
            ) : (
              visibleChats.map((chat) => {
                const isSelected = selectedChat?._id === chat._id;
                const currentUser = user || loggedUser;
                const chatName = !chat.isGroupChat
                  ? getSender(currentUser, chat.users)
                  : chat.chatName;
                const otherUser = !chat.isGroupChat
                  ? getSenderFull(currentUser, chat.users)
                  : null;
                const presence = otherUser ? getUserPresence(otherUser, onlineUsers) : null;
                const unreadCount = chat.unreadCount || 0;
                const hasUnread = unreadCount > 0;

                return (
                  <div
                    key={chat._id}
                    onClick={() => handleSelectChat(chat)}
                    className="flex items-center px-4 cursor-pointer transition-colors duration-150"
                    style={{
                      height: "72px",
                      background: isSelected ? "#2a3942" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#202c33";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* Avatar (49px circular WhatsApp style) */}
                    <div className="relative mr-3 shrink-0" style={{ width: 49, height: 49 }}>
                      {chat.isGroupChat ? (
                        <GroupAvatar size={49} />
                      ) : (
                        <UserAvatar user={otherUser} name={chatName} size={49} />
                      )}

                      {/* Online indicator on avatar */}
                      {!chat.isGroupChat && presence && (
                        <span
                          title={`Status: ${
                            presence.status === "online"
                              ? "Online"
                              : presence.status === "away"
                              ? "Away"
                              : "Offline"
                          }`}
                          style={{
                            position: "absolute",
                            bottom: 1,
                            right: 1,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: getStatusColor(presence.status),
                            border: "2.5px solid #111b21",
                            boxShadow:
                              presence.status === "online"
                                ? "0 0 6px rgba(0, 168, 132, 0.7)"
                                : "none",
                          }}
                        />
                      )}
                    </div>

                    {/* Middle Content & Indented Bottom Divider */}
                    <div
                      className="flex-1 min-w-0 flex flex-col justify-center h-full"
                      style={{
                        borderBottom: "1px solid #222d34",
                      }}
                    >
                      {/* Row 1: Name and Timestamp */}
                      <div className="flex justify-between items-baseline mb-1">
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: hasUnread ? "600" : "500",
                            color: "#e9edef",
                            fontFamily: "'Segoe UI', 'Inter', sans-serif",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {chatName}
                        </span>
                        {chat.latestMessage && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: hasUnread ? "#00a884" : "#8696a0",
                              fontWeight: hasUnread ? "600" : "400",
                              whiteSpace: "nowrap",
                              marginLeft: "8px",
                            }}
                          >
                            {formatTime(chat.latestMessage.createdAt)}
                          </span>
                        )}
                      </div>

                      {/* Row 2: Message Snippet + Status Ticks + Unread Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                          {typingChats[String(chat._id)] ? (
                            <span
                              style={{
                                fontSize: "13.5px",
                                color: "#00a884",
                                fontWeight: "500",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {chat.isGroupChat
                                ? `${typingChats[String(chat._id)]} is typing...`
                                : "typing..."}
                            </span>
                          ) : chat.latestMessage ? (
                            <div className="flex items-center min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                              {renderLatestMessageStatus(chat.latestMessage)}
                              <span
                                style={{
                                  fontSize: "13.5px",
                                  color: hasUnread ? "#e9edef" : "#8696a0",
                                  fontWeight: hasUnread ? "500" : "400",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {chat.latestMessage.content}
                              </span>
                            </div>
                          ) : (
                            <span
                              style={{ fontSize: "13px", color: "#8696a0", fontStyle: "italic" }}
                            >
                              No messages yet
                            </span>
                          )}
                        </div>

                        {/* Unread Badge (WhatsApp Green circle/pill) */}
                        {hasUnread && (
                          <span
                            title={`${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`}
                            style={{
                              minWidth: "20px",
                              height: "20px",
                              padding: "0 6px",
                              borderRadius: "9999px",
                              background: "#00a884",
                              color: "#111b21",
                              fontSize: "11.5px",
                              fontWeight: "700",
                              fontFamily: "'Segoe UI', 'Inter', sans-serif",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              lineHeight: 1,
                            }}
                          >
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default MyChats;
