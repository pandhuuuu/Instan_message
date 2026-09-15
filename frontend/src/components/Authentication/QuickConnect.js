import { useState } from "react";
import axios from "axios";
import { useToast } from "@chakra-ui/react";
import { useHistory } from "react-router-dom";
import { ChatState } from "../../Context/ChatProvider";

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "0.75rem",
  background: "#222a3d",
  border: "1px solid #464555",
  color: "#dae2fd",
  fontSize: "14px",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: "500",
  color: "#918fa1",
  marginBottom: "6px",
  fontFamily: "'Inter', sans-serif",
  letterSpacing: "0.01em",
};

const QuickConnect = () => {
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const history = useHistory();
  const { setUser } = ChatState();

  const submitHandler = async () => {
    setLoading(true);
    if (!username) {
      toast({
        title: "Username is required",
        description: "Please enter any username to claim your IM session.",
        status: "warning",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
      setLoading(false);
      return;
    }

    try {
      const config = { headers: { "Content-type": "application/json" } };
      const { data } = await axios.post("/api/user/quick-connect", { username, name }, config);

      toast({
        title: "Connected Successfully",
        description: `Welcome to Instant Messaging, ${data.name}!`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "top",
      });

      setUser(data);
      sessionStorage.setItem("userInfo", JSON.stringify(data));
      localStorage.removeItem("userInfo");
      setLoading(false);
      history.push("/chats");
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to connect to server.";
      toast({
        title: error.response?.status === 409 ? "Username Collision Detected" : "Connection Failed",
        description: msg,
        status: "error",
        duration: 6000,
        isClosable: true,
        position: "top",
      });
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Specification compliance callout */}
      <div
        className="p-3 rounded-xl flex items-start gap-2.5"
        style={{
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.25)",
        }}
      >
        <span className="material-symbols-outlined shrink-0 text-emerald-400" style={{ fontSize: "20px" }}>
          verified
        </span>
        <p className="text-xs" style={{ color: "#a7f3d0", lineHeight: 1.4 }}>
          <strong>IM Spec Mode:</strong> No password required. Enter any username to immediately claim your session.
          Server validates uniqueness and handles active collisions.
        </p>
      </div>

      <div>
        <label style={labelStyle}>
          Username <span style={{ color: "#ef4444" }}>*</span>
        </label>
        <input
          id="quick-username"
          type="text"
          placeholder="e.g. alice, bob, or athallah"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitHandler();
          }}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Display Name <span style={{ color: "#918fa1" }}>(Optional)</span>
        </label>
        <input
          id="quick-name"
          type="text"
          placeholder="e.g. Alice Wonderland"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitHandler();
          }}
          style={inputStyle}
        />
      </div>

      <button
        id="quick-connect-btn"
        onClick={submitHandler}
        disabled={loading}
        className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 mt-2"
        style={{
          background: "linear-gradient(135deg, #10b981, #059669)",
          color: "#ffffff",
          fontFamily: "'Inter', sans-serif",
          boxShadow: "0 4px 16px rgba(16,185,129,0.35)",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <span>Connecting to IM Server...</span>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>login</span>
            <span>Join Chat Network</span>
          </>
        )}
      </button>
    </div>
  );
};

export default QuickConnect;
