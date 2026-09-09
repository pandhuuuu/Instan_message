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
} from "@chakra-ui/react";
import axios from "axios";
import { useState } from "react";
import { ChatState } from "../../Context/ChatProvider";
import UserBadgeItem from "../userAvatar/UserBadgeItem";
import UserListItem from "../userAvatar/UserListItem";

const darkInput = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "0.75rem",
  background: "#222a3d",
  border: "1px solid #464555",
  color: "#dae2fd",
  fontSize: "14px",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  marginBottom: "12px",
};

const GroupChatModal = ({ children }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [groupChatName, setGroupChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const { user, chats, setChats } = ChatState();

  const handleGroup = (userToAdd) => {
    if (selectedUsers.find(u => u._id === userToAdd._id)) {
      toast({ title: "User already added", status: "warning", duration: 3000, isClosable: true, position: "top" });
      return;
    }
    setSelectedUsers([...selectedUsers, userToAdd]);
  };

  const handleSearch = async (query) => {
    setSearch(query);
    if (!query) return;
    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.get(`/api/user?search=${query}`, config);
      setLoading(false);
      setSearchResult(data);
    } catch (error) {
      toast({ title: "Search failed", status: "error", duration: 4000, isClosable: true, position: "bottom-left" });
    }
  };

  const handleDelete = (delUser) => {
    setSelectedUsers(selectedUsers.filter((sel) => sel._id !== delUser._id));
  };

  const handleSubmit = async () => {
    if (!groupChatName || selectedUsers.length < 2) {
      toast({ title: "Group name & at least 2 members are required", status: "warning", duration: 4000, isClosable: true, position: "top" });
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${user.token}` } };
      const { data } = await axios.post(
        `/api/chat/group`,
        { name: groupChatName, users: JSON.stringify(selectedUsers.map((u) => u._id)) },
        config
      );
      setChats([data, ...chats]);
      onClose();
      toast({ title: "Group created successfully! 🎉", status: "success", duration: 4000, isClosable: true, position: "bottom" });
    } catch (error) {
      toast({ title: "Failed to create group", description: error.response?.data, status: "error", duration: 4000, isClosable: true, position: "bottom" });
    }
  };

  return (
    <>
      <span onClick={onOpen}>{children}</span>

      <Modal isLazy onClose={onClose} isOpen={isOpen} isCentered>
        <ModalOverlay />
        <ModalContent style={{ background: "#171f33", border: "1px solid #464555", borderRadius: "1rem", color: "#dae2fd", maxWidth: "420px" }}>
          <ModalHeader style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "18px", fontWeight: "700", color: "#dae2fd", borderBottom: "1px solid rgba(70,69,85,0.4)", textAlign: "center" }}>
            <span className="material-symbols-outlined" style={{ verticalAlign: "middle", marginRight: "8px", color: "#4f46e5" }}>group_add</span>
            Create New Group
          </ModalHeader>
          <ModalCloseButton style={{ color: "#918fa1" }} />

          <ModalBody style={{ padding: "20px 20px 8px" }}>
            {/* Group name input */}
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#918fa1", display: "block", marginBottom: "6px" }}>
              Group Name
            </label>
            <input
              style={darkInput}
              placeholder="Group chat name..."
              value={groupChatName}
              onChange={(e) => setGroupChatName(e.target.value)}
              onFocus={e => { e.target.style.borderColor = "#4f46e5"; e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.2)"; }}
              onBlur={e => { e.target.style.borderColor = "#464555"; e.target.style.boxShadow = "none"; }}
            />

            {/* Search users */}
            <label style={{ fontSize: "12px", fontWeight: "500", color: "#918fa1", display: "block", marginBottom: "6px" }}>
              Add Members
            </label>
            <input
              style={darkInput}
              placeholder="Search users..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={e => { e.target.style.borderColor = "#4f46e5"; e.target.style.boxShadow = "0 0 0 3px rgba(79,70,229,0.2)"; }}
              onBlur={e => { e.target.style.borderColor = "#464555"; e.target.style.boxShadow = "none"; }}
            />

            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                {selectedUsers.map((u) => (
                  <UserBadgeItem key={u._id} user={u} handleFunction={() => handleDelete(u)} />
                ))}
              </div>
            )}

            {/* Search results */}
            <div style={{ maxHeight: "200px", overflowY: "auto", borderRadius: "0.75rem", border: searchResult.length ? "1px solid rgba(70,69,85,0.4)" : "none" }}>
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}>
                  <Spinner color="#4f46e5" />
                </div>
              ) : (
                searchResult.slice(0, 5).map((u) => (
                  <UserListItem key={u._id} user={u} handleFunction={() => handleGroup(u)} />
                ))
              )}
            </div>
          </ModalBody>

          <ModalFooter style={{ borderTop: "1px solid rgba(70,69,85,0.3)", gap: "8px", justifyContent: "flex-end" }}>
            <button onClick={onClose}
              style={{
                padding: "8px 16px", borderRadius: "0.75rem",
                background: "rgba(70,69,85,0.3)", border: "1px solid rgba(70,69,85,0.5)",
                color: "#918fa1", fontSize: "13px", fontWeight: "600",
                cursor: "pointer", fontFamily: "'Inter', sans-serif",
              }}>
              Cancel
            </button>
            <button onClick={handleSubmit}
              style={{
                padding: "8px 20px", borderRadius: "0.75rem",
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                border: "none", color: "#fff", fontSize: "13px", fontWeight: "600",
                cursor: "pointer", fontFamily: "'Inter', sans-serif",
                boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
              }}>
              Create Group
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default GroupChatModal;
