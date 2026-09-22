import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import io from "socket.io-client";
import { getServerBaseUrl } from "../config/serverConfig";

const ChatContext = createContext();

const ChatProvider = ({ children }) => {
  const [selectedChat, setSelectedChat] = useState();
  const [user, setUser] = useState();
  const [notification, setNotification] = useState([]);
  const [chats, setChats] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [myStatus, setMyStatus] = useState("online");

  const history = useHistory();
  const isAwayRef = useRef(false);
  const socketRef = useRef(null);
  const selectedChatRef = useRef(selectedChat);
  const chatsRef = useRef(chats);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    localStorage.removeItem("userInfo");
    const userInfo = JSON.parse(sessionStorage.getItem("userInfo"));
    if (userInfo) {
      if (userInfo.pic && userInfo.pic.includes("anonymous-avatar-icon")) {
        userInfo.pic = "";
        sessionStorage.setItem("userInfo", JSON.stringify(userInfo));
      }
      setUser(userInfo);
    } else {
      history.push("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  // Inisialisasi Socket.io global saat user sudah login
  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const endpoint = getServerBaseUrl();
    const newSocket = io(endpoint, {
      auth: {
        token: user.token,
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("setup", user);
      newSocket.emit("get online users");
      if (selectedChatRef.current && selectedChatRef.current._id) {
        newSocket.emit("join chat", selectedChatRef.current._id);
      }
      if (chatsRef.current && Array.isArray(chatsRef.current) && chatsRef.current.length > 0) {
        newSocket.emit("join user chats", chatsRef.current.map((c) => c._id));
      }
    });

    newSocket.on("connected", (initialUsers = {}) => {
      setOnlineUsers((prev) => {
        const next = {};
        Object.keys(prev).forEach((idStr) => {
          if (!initialUsers[idStr]) {
            next[idStr] = {
              ...prev[idStr],
              status: "offline",
              lastSeen: prev[idStr]?.lastSeen || new Date(),
            };
          }
        });
        Object.entries(initialUsers).forEach(([idStr, data]) => {
          next[idStr] = {
            ...prev[idStr],
            ...data,
          };
        });
        return next;
      });
    });

    newSocket.on("online users list", (usersList = {}) => {
      setOnlineUsers((prev) => {
        const next = {};
        Object.keys(prev).forEach((idStr) => {
          if (!usersList[idStr]) {
            next[idStr] = {
              ...prev[idStr],
              status: "offline",
              lastSeen: prev[idStr]?.lastSeen || new Date(),
            };
          }
        });
        Object.entries(usersList).forEach(([idStr, data]) => {
          next[idStr] = {
            ...prev[idStr],
            ...data,
          };
        });
        return next;
      });
    });

    // ── Self-Healing Sync: Sinkronisasi otomatis daftar user aktif setiap 15 detik ──
    const syncInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit("get online users");
      }
    }, 15000);

    newSocket.on("user status change", ({ userId, status, lastSeen, name, username, pic }) => {
      if (!userId) return;
      const idStr = String(userId);
      setOnlineUsers((prev) => ({
        ...prev,
        [idStr]: {
          status: status || "offline",
          lastSeen: lastSeen || new Date(),
          name: name || prev[idStr]?.name,
          username: username || prev[idStr]?.username,
          pic: pic || prev[idStr]?.pic,
        },
      }));
    });

    // ── Sinkronisasi saat jendela kembali difokuskan (dibatasi minimal jeda 5 detik) ──
    let lastFocusSync = 0;
    const handleWindowFocus = () => {
      const now = Date.now();
      if (newSocket.connected && now - lastFocusSync > 5000) {
        lastFocusSync = now;
        newSocket.emit("get online users");
      }
    };

    // ── Deteksi Tab Aktif / Inaktif (Visibility Change) ──
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isAwayRef.current = true;
        setMyStatus("away");
        newSocket.emit("user away");
      } else {
        isAwayRef.current = false;
        setMyStatus("online");
        newSocket.emit("user active");
        newSocket.emit("get online users");
        resetIdle();
      }
    };

    // ── Deteksi Idle (2 menit inaktif) dengan Throttling ──
    let idleTimer = null;
    let lastActivityTime = 0;
    const IDLE_TIME = 2 * 60 * 1000;

    const resetIdle = () => {
      if (isAwayRef.current && !document.hidden) {
        isAwayRef.current = false;
        setMyStatus("online");
        newSocket.emit("user active");
      }
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        isAwayRef.current = true;
        setMyStatus("away");
        newSocket.emit("user away");
      }, IDLE_TIME);
    };

    // Throttle deteksi aktivitas agar tidak membakar CPU di setiap pixel cursor bergerak
    const handleThrottledActivity = () => {
      const now = Date.now();
      if (now - lastActivityTime < 3000) return; // Maksimal eksekusi 1x setiap 3 detik
      lastActivityTime = now;
      resetIdle();
    };

    // Gunakan event interaksi yang ringan (hindari mousemove & scroll langsung)
    const activityEvents = ["click", "keydown", "touchstart", "mousedown"];
    activityEvents.forEach((ev) => window.addEventListener(ev, handleThrottledActivity, { passive: true }));
    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const handleBeforeUnload = () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    resetIdle();

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (syncInterval) clearInterval(syncInterval);
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleThrottledActivity));
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  return (
    <ChatContext.Provider
      value={{
        selectedChat,
        setSelectedChat,
        user,
        setUser,
        notification,
        setNotification,
        chats,
        setChats,
        socket,
        onlineUsers,
        myStatus,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const ChatState = () => {
  return useContext(ChatContext);
};

export default ChatProvider;
