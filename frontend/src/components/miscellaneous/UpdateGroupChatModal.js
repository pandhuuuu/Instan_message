import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Spinner,
  Tooltip,
} from "@chakra-ui/react";
import axios from "axios";
import { useState } from "react";
import { ChatState } from "../../Context/ChatProvider";
import UserListItem from "../userAvatar/UserListItem";
import { getUserPresence, getStatusColor, getStatusLabel } from "../../config/userStatus";

const darkInput = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: "0.75rem",
  background: "#222a3d",
  border: "1px solid #464555",
  color: "#dae2fd",
  fontSize: "14px",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const actionBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "5px",
  borderRadius: "0.5rem",
  transition: "all 0.15s ease",
};

const UpdateGroupChatModal = ({ fetchMessages, fetchAgain, setFetchAgain }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [groupChatName, setGroupChatName] = useState("");
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [renameloading, setRenameLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const toast = useToast();

  const { selectedChat, setSelectedChat, user, onlineUsers } = ChatState();

  if (!selectedChat) return null;

  // Helper identifikasi peran
  const getOwnerId = () => {
    const adminId = selectedChat.groupAdmin?._id || selectedChat.groupAdmin;
    const adminStillInGroup = selectedChat.users?.some(
      (u) => String(u._id || u) === String(adminId)
    );
    if (adminId && adminStillInGroup) return adminId;
    return selectedChat.users?.[0]?._id;
  };

  const isUserOwner = (u) => {
    return String(getOwnerId()) === String(u._id || u);
  };

  const isUserAdmin = (u) => {
    if (isUserOwner(u)) return true;
    if (selectedChat.groupAdmins && Array.isArray(selectedChat.groupAdmins)) {
      return selectedChat.groupAdmins.some(
        (a) => String(a._id || a) === String(u._id || u)
      );
    }
    return false;
  };

  const isMeOwner = isUserOwner(user);
  const isMeAdmin = isUserAdmin(user);

  // Sorting anggota: Pembuat Grup -> Admin -> Anggota biasa
  const sortedUsers = [...(selectedChat.users || [])].sort((a, b) => {
    if (isUserOwner(a)) return -1;
    if (isUserOwner(b)) return 1;
    if (isUserAdmin(a) && !isUserAdmin(b)) return -1;
    if (!isUserAdmin(a) && isUserAdmin(b)) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query || query.trim() === "") {
      setSearchResult([]);
      return;
    }
    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`/api/user?search=${query}`, config);
      setLoading(false);
      setSearchResult(data);
    } catch (error) {
      toast({
        title: "Search failed",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom-left",
      });
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!groupChatName || groupChatName.trim() === "") return;
    if (!isMeAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can change the group name",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setRenameLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(
        `/api/chat/rename`,
        { chatId: selectedChat._id, chatName: groupChatName },
        config
      );
      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      if (fetchMessages) fetchMessages();
      setRenameLoading(false);
      setGroupChatName("");
      toast({
        title: "Group name updated successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Failed to update group name",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      setRenameLoading(false);
    }
  };

  const handleAddUser = async (user1) => {
    if (selectedChat.users.some((u) => u._id === user1._id)) {
      toast({
        title: "User is already in the group!",
        status: "warning",
        duration: 3000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    if (!isMeAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can add members!",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(
        `/api/chat/groupadd`,
        { chatId: selectedChat._id, userId: user1._id },
        config
      );
      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      if (fetchMessages) fetchMessages();
      setLoading(false);
      setSearch("");
      setSearchResult([]);
      toast({
        title: "Member Added Successfully",
        description: `${user1.name} has joined the group`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Failed to add member",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      setLoading(false);
    }
  };

  const handleRemove = async (user1) => {
    const isSelf = user1._id === user._id;

    // Validasi hak akses
    if (!isSelf && !isMeAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can remove members!",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    // Admin biasa tidak boleh mengeluarkan owner atau sesama admin
    if (!isSelf && !isMeOwner && isUserAdmin(user1)) {
      toast({
        title: "Access Denied",
        description: "Only the group owner can remove fellow admins!",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setActionLoadingId(user1._id);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(
        `/api/chat/groupremove`,
        { chatId: selectedChat._id, userId: user1._id },
        config
      );

      if (isSelf) {
        setSelectedChat(null);
        onClose();
        toast({
          title: "You left the group",
          status: "info",
          duration: 3000,
          isClosable: true,
          position: "top",
        });
      } else {
        setSelectedChat(data);
        toast({
          title: "Member Removed",
          description: `${user1.name} was removed from the group`,
          status: "success",
          duration: 3000,
          isClosable: true,
          position: "top",
        });
      }

      setFetchAgain(!fetchAgain);
      if (fetchMessages) fetchMessages();
      setActionLoadingId(null);
    } catch (error) {
      toast({
        title: "Failed to process",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      setActionLoadingId(null);
    }
  };

  const handlePromote = async (user1) => {
    if (!isMeAdmin) {
      toast({
        title: "Access Denied",
        description: "Only admins can promote members to admin!",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setActionLoadingId(user1._id);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(
        `/api/chat/groupadmin/promote`,
        { chatId: selectedChat._id, userId: user1._id },
        config
      );
      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      if (fetchMessages) fetchMessages();
      setActionLoadingId(null);
      toast({
        title: "Admin Promoted",
        description: `${user1.name} is now a group admin`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Failed to promote admin",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      setActionLoadingId(null);
    }
  };

  const handleDemote = async (user1) => {
    if (!isMeOwner) {
      toast({
        title: "Access Denied",
        description: "Only the group owner can demote admins!",
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      return;
    }

    try {
      setActionLoadingId(user1._id);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.put(
        `/api/chat/groupadmin/demote`,
        { chatId: selectedChat._id, userId: user1._id },
        config
      );
      setSelectedChat(data);
      setFetchAgain(!fetchAgain);
      if (fetchMessages) fetchMessages();
      setActionLoadingId(null);
      toast({
        title: "Admin Demoted",
        description: `${user1.name} is now a regular member`,
        status: "info",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
    } catch (error) {
      toast({
        title: "Failed to demote admin",
        description: error.response?.data?.message || error.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom",
      });
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <button
        onClick={onOpen}
        title="Group Settings & Members"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          color: "#918fa1",
          padding: "4px",
          borderRadius: "0.5rem",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#c3c0ff";
          e.currentTarget.style.background = "rgba(79,70,229,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#918fa1";
          e.currentTarget.style.background = "none";
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: "19px" }}>
          settings
        </span>
      </button>

      <Modal isLazy onClose={onClose} isOpen={isOpen} isCentered size="md">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(5px)" />
        <ModalContent
          style={{
            background: "#171f33",
            border: "1px solid #464555",
            borderRadius: "1.25rem",
            color: "#dae2fd",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
            overflow: "hidden",
            maxWidth: "480px",
          }}
        >
          {/* Header */}
          <ModalHeader
            style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid rgba(70,69,85,0.4)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                groups
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: "17px",
                  fontWeight: "700",
                  color: "#dae2fd",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedChat.chatName}
              </div>
              <div style={{ fontSize: "12px", color: "#918fa1", fontWeight: "500" }}>
                Your Role:{" "}
                {isMeOwner ? (
                  <span style={{ color: "#fbbf24", fontWeight: "700" }}>👑 Group Owner</span>
                ) : isMeAdmin ? (
                  <span style={{ color: "#34d399", fontWeight: "700" }}>⭐ Admin</span>
                ) : (
                  <span style={{ color: "#c3c0ff", fontWeight: "600" }}>Member</span>
                )}
              </div>
            </div>
            <ModalCloseButton
              position="static"
              style={{
                color: "#918fa1",
                borderRadius: "0.5rem",
              }}
            />
          </ModalHeader>

          <ModalBody
            style={{
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Change Group Name (Only for Admin / Owner) */}
            {isMeAdmin ? (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#918fa1",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}
                >
                  Change Group Name
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    style={darkInput}
                    placeholder="New group name..."
                    value={groupChatName}
                    onChange={(e) => setGroupChatName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#4f46e5";
                      e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.2)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#464555";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <button
                    onClick={handleRename}
                    disabled={renameloading || !groupChatName.trim()}
                    style={{
                      padding: "10px 16px",
                      borderRadius: "0.75rem",
                      background: groupChatName.trim()
                        ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                        : "rgba(79,70,229,0.2)",
                      border: "1px solid rgba(79,70,229,0.4)",
                      color: groupChatName.trim() ? "#fff" : "#918fa1",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: groupChatName.trim() ? "pointer" : "default",
                      fontFamily: "'Inter', sans-serif",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {renameloading ? <Spinner size="xs" color="#fff" /> : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#222a3d",
                  borderRadius: "0.75rem",
                  padding: "10px 14px",
                  border: "1px solid rgba(70,69,85,0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#918fa1", textTransform: "uppercase" }}>
                    Group Name
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#dae2fd" }}>
                    {selectedChat.chatName}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#918fa1",
                    background: "rgba(70,69,85,0.3)",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  🔒 Admin Only
                </span>
              </div>
            )}

            {/* Add Members (Only for Admin / Owner) */}
            {isMeAdmin && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#918fa1",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "6px",
                  }}
                >
                  Add New Members
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...darkInput, width: "100%", paddingLeft: "36px" }}
                    placeholder="Type user's name or username..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={(e) => {
                      e.target.style.borderColor = "#4f46e5";
                      e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.2)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "#464555";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                  <span
                    className="material-symbols-outlined"
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: "18px",
                      color: "#918fa1",
                      pointerEvents: "none",
                    }}
                  >
                    person_add
                  </span>
                </div>

                {/* Search Results Dropdown */}
                {search && (
                  <div
                    style={{
                      marginTop: "6px",
                      maxHeight: "150px",
                      overflowY: "auto",
                      background: "#222a3d",
                      borderRadius: "0.75rem",
                      border: "1px solid #464555",
                      padding: "4px",
                    }}
                  >
                    {loading ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: "12px" }}>
                        <Spinner size="sm" color="#4f46e5" />
                      </div>
                    ) : searchResult.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: "12px",
                          color: "#918fa1",
                          padding: "10px",
                        }}
                      >
                        No users found
                      </div>
                    ) : (
                      searchResult.slice(0, 4).map((u) => (
                        <UserListItem
                          key={u._id}
                          user={u}
                          handleFunction={() => handleAddUser(u)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Members List & Roles */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#918fa1",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Members ({sortedUsers.length})
                </span>
                <span style={{ fontSize: "11px", color: "#918fa1" }}>
                  {sortedUsers.filter((u) => isUserAdmin(u)).length} Admins
                </span>
              </div>

              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  paddingRight: "2px",
                }}
              >
                {sortedUsers.map((u) => {
                  const isOwner = isUserOwner(u);
                  const isAdmin = isUserAdmin(u);
                  const isSelf = u._id === user._id;
                  const presence = getUserPresence(u, onlineUsers);
                  const statusColor = getStatusColor(presence.status);
                  const statusLabel = getStatusLabel(presence.status, presence.lastSeen);
                  const isLoading = actionLoadingId === u._id;

                  return (
                    <div
                      key={u._id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        borderRadius: "0.75rem",
                        background: isSelf ? "rgba(79,70,229,0.1)" : "#222a3d",
                        border: isSelf
                          ? "1px solid rgba(79,70,229,0.3)"
                          : "1px solid rgba(70,69,85,0.4)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* User Info with Presence Dot */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: isOwner
                                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                : isAdmin
                                ? "linear-gradient(135deg, #10b981, #059669)"
                                : "linear-gradient(135deg, #4f46e5, #7c3aed)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: "700",
                              fontSize: "13px",
                            }}
                          >
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          {/* Live Presence Dot */}
                          <Tooltip label={statusLabel} placement="top" hasArrow>
                            <span
                              style={{
                                position: "absolute",
                                bottom: "-1px",
                                right: "-1px",
                                width: "10px",
                                height: "10px",
                                borderRadius: "50%",
                                background: statusColor,
                                border: "2px solid #222a3d",
                                boxShadow:
                                  presence.status === "online"
                                    ? "0 0 5px rgba(16,185,129,0.8)"
                                    : "none",
                              }}
                            />
                          </Tooltip>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              color: "#dae2fd",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            <span>{u.name}</span>
                            {isSelf && (
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "#c3c0ff",
                                  background: "rgba(79,70,229,0.25)",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  fontWeight: "700",
                                }}
                              >
                                You
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#918fa1",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "160px",
                            }}
                          >
                            @{u.username || u.name}
                          </div>
                        </div>
                      </div>

                      {/* Right: Badge & Actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        {/* Role Badge */}
                        {isOwner ? (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              background: "rgba(245, 158, 11, 0.15)",
                              border: "1px solid rgba(245, 158, 11, 0.4)",
                              color: "#fbbf24",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            👑 Owner
                          </span>
                        ) : isAdmin ? (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              background: "rgba(16, 185, 129, 0.15)",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              color: "#34d399",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            ⭐ Admin
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: "600",
                              padding: "2px 8px",
                              borderRadius: "9999px",
                              background: "rgba(145, 143, 161, 0.12)",
                              border: "1px solid rgba(145, 143, 161, 0.25)",
                              color: "#918fa1",
                            }}
                          >
                            Member
                          </span>
                        )}

                        {/* Action Buttons if allowed */}
                        {isLoading ? (
                          <Spinner size="xs" color="#4f46e5" />
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                            {/* Owner Controls */}
                            {isMeOwner && !isOwner && (
                              <>
                                {isAdmin ? (
                                  <Tooltip label="Demote to regular member" placement="top" hasArrow>
                                    <button
                                      onClick={() => handleDemote(u)}
                                      style={{
                                        ...actionBtnStyle,
                                        color: "#f59e0b",
                                        background: "rgba(245,158,11,0.1)",
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.background = "rgba(245,158,11,0.25)")
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = "rgba(245,158,11,0.1)")
                                      }
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                        remove_moderator
                                      </span>
                                    </button>
                                  </Tooltip>
                                ) : (
                                  <Tooltip label="Promote to Admin" placement="top" hasArrow>
                                    <button
                                      onClick={() => handlePromote(u)}
                                      style={{
                                        ...actionBtnStyle,
                                        color: "#34d399",
                                        background: "rgba(16,185,129,0.1)",
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.background = "rgba(16,185,129,0.25)")
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = "rgba(16,185,129,0.1)")
                                      }
                                    >
                                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                        add_moderator
                                      </span>
                                    </button>
                                  </Tooltip>
                                )}
                              </>
                            )}

                            {/* Kick Member Control */}
                            {!isSelf && (isMeOwner || (isMeAdmin && !isAdmin)) && (
                              <Tooltip label={`Remove ${u.name}`} placement="top" hasArrow>
                                <button
                                  onClick={() => handleRemove(u)}
                                  style={{
                                    ...actionBtnStyle,
                                    color: "#f87171",
                                    background: "rgba(239,68,68,0.1)",
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.background = "rgba(239,68,68,0.25)")
                                  }
                                  onMouseLeave={(e) =>
                                    (e.currentTarget.style.background = "rgba(239,68,68,0.1)")
                                  }
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                                    person_remove
                                  </span>
                                </button>
                              </Tooltip>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ModalBody>

          {/* Footer */}
          <ModalFooter
            style={{
              borderTop: "1px solid rgba(70,69,85,0.3)",
              display: "flex",
              justifyContent: "space-between",
              padding: "14px 20px",
            }}
          >
            <button
              onClick={() => handleRemove(user)}
              style={{
                padding: "8px 16px",
                borderRadius: "0.75rem",
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.12)")}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                logout
              </span>
              Leave Group
            </button>

            <button
              onClick={onClose}
              style={{
                padding: "8px 20px",
                borderRadius: "0.75rem",
                background: "rgba(70,69,85,0.35)",
                border: "1px solid rgba(70,69,85,0.6)",
                color: "#dae2fd",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(70,69,85,0.55)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(70,69,85,0.35)")}
            >
              Close
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default UpdateGroupChatModal;
