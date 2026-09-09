import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useEffect, useState } from "react";
import { getSender, getSenderFull } from "../config/ChatLogics";
import { getUserPresence, getStatusColor } from "../config/userStatus";
import ChatLoading from "./ChatLoading";
import GroupChatModal from "./miscellaneous/GroupChatModal";
import ProfileModal from "./miscellaneous/ProfileModal";
import UserListItem from "./userAvatar/UserListItem";
import { ChatState } from "../Context/ChatProvider";
import { Menu, MenuButton, MenuList, MenuItem } from "@chakra-ui/menu";
import { Spinner } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";

const MyChats = ({ fetchAgain }) => {
  const [loggedUser, setLoggedUser] = useState();
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "online"
  const [typingChats, setTypingChats] = useState({});

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

  const totalUnread = chats ? chats.reduce((acc, c) => acc + (c.unreadCount || 0), 0) : 0;

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
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get("/api/chat", config);
      setChats(data);
      if (socket && data?.length) {
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

  // Real-time socket message handler for unread badge counters, typing & sync
  useEffect(() => {
    if (!socket) return;

    const handleMessageRecieved = (newMessage) => {
      if (!newMessage || !newMessage.chat) return;

      const chatId = String(newMessage.chat._id || newMessage.chat);
      const isCurrentChat = selectedChat && String(selectedChat._id) === chatId;

      // Clear typing indicator for this chat upon receiving a new message
      setTypingChats((prev) => {
        if (!prev[chatId]) return prev;
        const updated = { ...prev };
        delete updated[chatId];
        return updated;
      });

      setChats((prevChats) => {
        if (!prevChats) return prevChats;

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

    const handleMessagesReadUpdate = ({ chatId, readerId }) => {
      if (user && String(readerId) === String(user._id)) {
        setChats((prevChats) =>
          prevChats?.map((c) => (String(c._id) === String(chatId) ? { ...c, unreadCount: 0 } : c))
        );
      }
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
    };

    const handleStopTyping = (data) => {
      if (!data) return;
      const chatId = typeof data === "object" ? String(data.chatId || data.room) : String(data);
      if (!chatId) return;

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
        prevChats?.map((c) =>
          String(c._id) === idStr ? { ...c, latestMessage: null, unreadCount: 0 } : c
        )
      );
    };

    const handleMessageDeleted = ({ messageId, chatId }) => {
      const idStr = String(chatId);
      setChats((prevChats) =>
        prevChats?.map((c) => {
          if (String(c._id) === idStr && String(c.latestMessage?._id) === String(messageId)) {
            return { ...c, latestMessage: null };
          }
          return c;
        })
      );
      fetchChats();
    };

    const handleChatDeleted = (deletedChatId) => {
      const idStr = String(deletedChatId);
      setChats((prevChats) => prevChats?.filter((c) => String(c._id) !== idStr));
      if (selectedChat && String(selectedChat._id) === idStr) {
        setSelectedChat(null);
      }
    };

    const handleGroupUpdated = (updatedChat) => {
      if (!updatedChat?._id) return;
      const idStr = String(updatedChat._id);
      setChats((prevChats) =>
        prevChats?.map((c) => (String(c._id) === idStr ? { ...c, ...updatedChat } : c))
      );
    };

    socket.on("message recieved", handleMessageRecieved);
    socket.on("messages read update", handleMessagesReadUpdate);
    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);
    socket.on("chat cleared", handleChatCleared);
    socket.on("message deleted", handleMessageDeleted);
    socket.on("chat deleted", handleChatDeleted);
    socket.on("group updated", handleGroupUpdated);

    return () => {
      socket.off("message recieved", handleMessageRecieved);
      socket.off("messages read update", handleMessagesReadUpdate);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
      socket.off("chat cleared", handleChatCleared);
      socket.off("message deleted", handleMessageDeleted);
      socket.off("chat deleted", handleChatDeleted);
      socket.off("group updated", handleGroupUpdated);
    };
  }, [socket, selectedChat, user]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setChats((prev) =>
      prev?.map((c) => (c._id === chat._id ? { ...c, unreadCount: 0 } : c))
    );
    setNotification((prev) => prev.filter((n) => n.chat?._id !== chat._id));
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) { setSearchResult([]); return; }
    try {
      setLoadingSearch(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`/api/user?search=${query}`, config);
      setLoadingSearch(false);
      setSearchResult(data);
    } catch (error) {
      toast({ title: "Search failed", status: "error", duration: 4000, isClosable: true, position: "bottom-left" });
      setLoadingSearch(false);
    }
  };

  const accessChat = async (userId) => {
    try {
      const config = {
        headers: { "Content-type": "application/json", Authorization: `Bearer ${user.token}` },
      };
      const { data } = await axios.post(`/api/chat`, { userId }, config);
      if (!chats.find((c) => c._id === data._id)) setChats([data, ...chats]);
      setSelectedChat(data);
      setSearch("");
      setSearchResult([]);
      setActiveTab("chats");
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

  /* ─── Avatar helper ──────────────────────────── */
  const AvatarInitial = ({ name, size = 48 }) => {
    const colors = ["#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706"];
    const idx = name ? name.charCodeAt(0) % colors.length : 0;
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${colors[idx]}, ${colors[(idx+1)%colors.length]})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: "700", fontSize: size * 0.38,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        flexShrink: 0,
      }}>
        {name?.charAt(0).toUpperCase()}
      </div>
    );
  };

  /* ─── Chat time format ───────────────────────── */
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 86400) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 172800) return "Yesterday";
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  return (
    <section
      className={`shrink-0 h-full flex flex-col z-20 transition-all duration-300 ${selectedChat ? "hidden md:flex" : "flex"}`}
      style={{
        width: "340px",
        minWidth: "280px",
        background: "#131b2e",
        borderRight: "1px solid rgba(70,69,85,0.4)",
      }}>

      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4"
        style={{
          height: "64px",
          background: "#171f33",
          borderBottom: "1px solid rgba(70,69,85,0.4)",
        }}>
        {/* Brand + profile */}
        <div className="flex items-center gap-3">
          <Menu isLazy>
            <MenuButton>
              <div className="relative">
                {user.pic
                  ? <img alt="Profile" className="rounded-full object-cover" style={{ width: 36, height: 36 }} src={user.pic} />
                  : <AvatarInitial name={user.name} size={36} />
                }
                {/* Online indicator */}
                <span style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 10, height: 10, borderRadius: "50%",
                  background: "#10b981",
                  border: "2px solid #171f33",
                }} />
              </div>
            </MenuButton>
            <MenuList zIndex="popover">
              <ProfileModal user={user}>
                <MenuItem>My Profile</MenuItem>
              </ProfileModal>
              <MenuItem onClick={logoutHandler}>Logout</MenuItem>
            </MenuList>
          </Menu>
          <div>
            <div style={{ fontSize: "15px", fontWeight: "700", color: "#dae2fd", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1.2 }}>
              {user.name?.split(" ")[0]}
            </div>
            <div style={{
              fontSize: "11px",
              color: getStatusColor(myStatus),
              fontWeight: "500",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: getStatusColor(myStatus),
                display: "inline-block",
                boxShadow: myStatus === "online" ? "0 0 5px rgba(16,185,129,0.7)" : "none"
              }} />
              {myStatus === "away" ? "Away" : "Online"}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Notifications */}
          <Menu isLazy>
            <MenuButton>
              <div className="relative flex items-center justify-center rounded-xl transition-colors"
                style={{ width: 36, height: 36, color: "#918fa1", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>notifications</span>
                {notification.length > 0 && (
                  <span style={{
                    position: "absolute", top: 4, right: 4,
                    width: 8, height: 8, borderRadius: "50%",
                    background: "#8b5cf6", border: "2px solid #171f33",
                    animation: "pulse 2s infinite",
                  }} />
                )}
              </div>
            </MenuButton>
            <MenuList pl={2} zIndex="popover">
              {!notification.length && <MenuItem style={{ fontSize: "13px", color: "#918fa1" }}>No notifications</MenuItem>}
              {notification.map((notif) => {
                const notifChatId = String(notif.chat?._id || notif.chat);
                return (
                  <MenuItem
                    key={notif._id}
                    onClick={() => {
                      setSelectedChat(notif.chat);
                      setNotification((prev) => prev.filter((n) => String(n.chat?._id || n.chat) !== notifChatId));
                      setChats((prev) =>
                        prev?.map((c) => (String(c._id) === notifChatId ? { ...c, unreadCount: 0 } : c))
                      );
                    }}>
                    {notif.chat.isGroupChat
                      ? `💬 New message in ${notif.chat.chatName}`
                      : `💬 New message from ${getSender(user, notif.chat.users)}`}
                  </MenuItem>
                );
              })}
            </MenuList>
          </Menu>

          {/* New Group */}
          <GroupChatModal>
            <div className="flex items-center justify-center rounded-xl transition-colors"
              style={{ width: 36, height: 36, color: "#918fa1", cursor: "pointer" }}
              title="Create New Group"
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>group_add</span>
            </div>
          </GroupChatModal>
        </div>
      </div>
      {/* ── Segmented View Toggle: Chats vs Active Users ── */}
      <div className="shrink-0 px-3 pt-3 pb-1">
        <div
          className="flex p-1 rounded-xl"
          style={{
            background: "#1c253b",
            border: "1px solid rgba(70,69,85,0.3)",
          }}
        >
          <button
            onClick={() => {
              setActiveTab("chats");
              setSearch("");
              setSearchResult([]);
            }}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200"
            style={{
              background: activeTab === "chats" ? "linear-gradient(135deg, #4f46e5, #4338ca)" : "transparent",
              color: activeTab === "chats" ? "#ffffff" : "#918fa1",
              boxShadow: activeTab === "chats" ? "0 2px 8px rgba(79,70,229,0.4)" : "none",
              cursor: "pointer",
              border: "none",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chat</span>
            <span>Chats</span>
            {totalUnread > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  background: "#10b981",
                  color: "#fff",
                  borderRadius: "9999px",
                  padding: "0 5px",
                  fontWeight: "700",
                }}
              >
                {totalUnread}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("online");
              setSearch("");
              setSearchResult([]);
            }}
            className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200"
            style={{
              background: activeTab === "online" ? "linear-gradient(135deg, #059669, #10b981)" : "transparent",
              color: activeTab === "online" ? "#ffffff" : "#918fa1",
              boxShadow: activeTab === "online" ? "0 2px 8px rgba(16,185,129,0.4)" : "none",
              cursor: "pointer",
              border: "none",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 6px #10b981",
                display: "inline-block",
              }}
            />
            <span>Active Users</span>
            <span
              style={{
                fontSize: "10px",
                background: activeTab === "online" ? "rgba(255,255,255,0.25)" : "rgba(16,185,129,0.2)",
                color: activeTab === "online" ? "#ffffff" : "#10b981",
                borderRadius: "9999px",
                padding: "0 6px",
                fontWeight: "700",
              }}
            >
              {onlineCount}
            </span>
          </button>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="shrink-0 px-3 py-3" style={{ borderBottom: "1px solid rgba(70,69,85,0.3)" }}>
        <div className="flex items-center gap-2 px-3 rounded-xl"
          style={{ background: "#222a3d", border: "1px solid rgba(70,69,85,0.5)", height: "38px" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px", color: "#918fa1" }}>search</span>
          <input
            className="flex-1 bg-transparent focus:outline-none text-sm"
            style={{ color: "#dae2fd", fontFamily: "'Inter', sans-serif" }}
            placeholder={activeTab === "online" ? "Filter online users..." : "Search users..."}
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => { setSearch(""); setSearchResult([]); }}
              style={{ color: "#918fa1", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Chat List or Search Results ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "online" ? (
          /* Online Users Direct View */
          <div className="py-2">
            <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#464555" }}>
              <span>Currently Online</span>
              <span style={{ color: "#10b981" }}>{onlineCount} active</span>
            </div>

            {onlineCount === 0 ? (
              <div className="text-center py-12 px-4">
                <div
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#918fa1" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "24px" }}>person_off</span>
                </div>
                <p className="text-xs font-medium" style={{ color: "#dae2fd" }}>
                  No other users are online right now
                </p>
                <p className="text-xs mt-1" style={{ color: "#918fa1" }}>
                  When classmates or colleagues connect, they will appear here live.
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
                .map(([peerId, peerData], idx) => {
                  const displayName = peerData.name || peerData.username || "Active User";
                  const username = peerData.username ? `@${peerData.username}` : "";
                  const isAway = peerData.status === "away";

                  return (
                    <div
                      key={peerId}
                      onClick={() => accessChat(peerId)}
                      className="flex items-center justify-between px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition-colors duration-150"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.04)",
                        marginBottom: "6px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(79,70,229,0.12)";
                        e.currentTarget.style.borderColor = "rgba(79,70,229,0.3)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)";
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {peerData.pic ? (
                            <img
                              alt="User"
                              src={peerData.pic}
                              className="rounded-full object-cover"
                              style={{ width: 40, height: 40 }}
                            />
                          ) : (
                            <AvatarInitial name={displayName} size={40} />
                          )}
                          <span
                            style={{
                              position: "absolute",
                              bottom: 0,
                              right: 0,
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: isAway ? "#f59e0b" : "#10b981",
                              border: "2px solid #131b2e",
                              boxShadow: isAway ? "0 0 5px #f59e0b" : "0 0 6px #10b981",
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <div
                            style={{
                              fontSize: "13.5px",
                              fontWeight: "600",
                              color: "#dae2fd",
                              fontFamily: "'Plus Jakarta Sans', sans-serif",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {displayName}
                          </div>
                          <div className="flex items-center gap-1.5" style={{ fontSize: "11px" }}>
                            <span style={{ color: "#918fa1" }}>{username}</span>
                            <span style={{ color: "#464555" }}>•</span>
                            <span style={{ color: isAway ? "#f59e0b" : "#10b981", fontWeight: "500" }}>
                              {isAway ? "Away" : "Online"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          accessChat(peerId);
                        }}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: "rgba(79,70,229,0.2)",
                          color: "#c3c0ff",
                          border: "1px solid rgba(79,70,229,0.35)",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#4f46e5")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(79,70,229,0.2)")}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>chat</span>
                        <span>Chat</span>
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        ) : search ? (
          /* Search Results */
          <div className="py-2">
            {search && (
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "#464555" }}>
                Search Results
              </div>
            )}
            {loadingSearch ? (
              <div className="flex justify-center my-6"><Spinner color="#4f46e5" /></div>
            ) : searchResult?.length === 0 ? (
              <div className="text-center py-8" style={{ color: "#464555", fontSize: "13px" }}>
                User not found
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
          /* Normal Chat List */
          <>
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#464555" }}>
                  Messages
                </span>
                {totalUnread > 0 && (
                  <span
                    style={{
                      fontSize: "10.5px",
                      fontWeight: "700",
                      color: "#10b981",
                      background: "rgba(16,185,129,0.12)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      padding: "1px 7px",
                      borderRadius: "9999px",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {totalUnread} new
                  </span>
                )}
              </div>
              <span style={{ fontSize: "12px", color: "#918fa1" }}>{chats?.length || 0}</span>
            </div>

            {chats ? (
              chats.map((chat, idx) => {
                const isSelected = selectedChat?._id === chat._id;
                const currentUser = user || loggedUser;
                const chatName = !chat.isGroupChat ? getSender(currentUser, chat.users) : chat.chatName;
                const otherUser = !chat.isGroupChat ? getSenderFull(currentUser, chat.users) : null;
                const presence = otherUser ? getUserPresence(otherUser, onlineUsers) : null;
                const unreadCount = chat.unreadCount || 0;
                const hasUnread = unreadCount > 0;

                return (
                  <div
                    key={chat._id}
                    onClick={() => handleSelectChat(chat)}
                    className="flex items-center px-3 py-2.5 cursor-pointer transition-colors duration-150"
                    style={{
                      background: isSelected
                        ? "rgba(79,70,229,0.15)"
                        : hasUnread
                        ? "rgba(16,185,129,0.04)"
                        : "transparent",
                      borderLeft: isSelected
                        ? "3px solid #4f46e5"
                        : hasUnread
                        ? "3px solid #10b981"
                        : "3px solid transparent",
                      position: "relative",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = hasUnread ? "rgba(16,185,129,0.04)" : "transparent"; }}>

                    {/* Avatar */}
                    <div className="relative mr-3 shrink-0">
                      <AvatarInitial name={chatName} size={46} />
                      {!chat.isGroupChat && presence && (
                        <span
                          title={`Status: ${presence.status === "online" ? "Online" : presence.status === "away" ? "Away" : "Offline"}`}
                          style={{
                            position: "absolute", bottom: 0, right: 0,
                            width: 11, height: 11, borderRadius: "50%",
                            background: getStatusColor(presence.status),
                            border: "2px solid #131b2e",
                            boxShadow: presence.status === "online" ? "0 0 6px rgba(16,185,129,0.6)" : "none",
                          }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span style={{
                          fontSize: "14px",
                          fontWeight: hasUnread ? "700" : "600",
                          color: isSelected ? "#dae2fd" : hasUnread ? "#ffffff" : "#c7c4d8",
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {chatName}
                        </span>
                        {chat.latestMessage && (
                          <span style={{
                            fontSize: "11px",
                            color: hasUnread ? "#10b981" : "#464555",
                            fontWeight: hasUnread ? "600" : "400",
                            whiteSpace: "nowrap",
                            marginLeft: "8px",
                          }}>
                            {formatTime(chat.latestMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {typingChats[String(chat._id)] ? (
                          <p style={{
                            fontSize: "12.5px",
                            color: "#34d399",
                            fontWeight: "600",
                            fontStyle: "italic",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}>
                            <span>✍️</span>
                            <span>{chat.isGroupChat ? `${typingChats[String(chat._id)]} is typing...` : "typing..."}</span>
                          </p>
                        ) : chat.latestMessage ? (
                          <p style={{
                            fontSize: "12.5px",
                            color: hasUnread ? "#e2e8f0" : "#918fa1",
                            fontWeight: hasUnread ? "500" : "400",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            flex: 1,
                            minWidth: 0,
                          }}>
                            {chat.latestMessage.content}
                          </p>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#464555", fontStyle: "italic", flex: 1 }}>
                            No messages yet
                          </span>
                        )}

                        {/* Unread Badge */}
                        {hasUnread && (
                          <span
                            title={`${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`}
                            style={{
                              minWidth: "19px",
                              height: "19px",
                              padding: "0 6px",
                              borderRadius: "9999px",
                              background: "linear-gradient(135deg, #10b981, #059669)",
                              color: "#ffffff",
                              fontSize: "11px",
                              fontWeight: "700",
                              fontFamily: "'Inter', sans-serif",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 2px 8px rgba(16,185,129,0.5)",
                              flexShrink: 0,
                              animation: "pulse 3s infinite",
                              letterSpacing: "-0.01em",
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
            ) : (
              <div className="px-3 py-2">
                <ChatLoading />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default MyChats;
