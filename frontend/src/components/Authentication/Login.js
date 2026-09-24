import { useEffect, useState } from "react";
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

const DarkInput = ({ id, type, placeholder, value, onChange, rightElement }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          borderColor: focused ? "#4f46e5" : "#464555",
          boxShadow: focused ? "0 0 0 3px rgba(79,70,229,0.2)" : "none",
          paddingRight: rightElement ? "80px" : "14px",
        }}
      />
      {rightElement && (
        <div className="absolute right-2">{rightElement}</div>
      )}
    </div>
  );
};

const Login = ({ initialUsername = "" }) => {
  const [show, setShow] = useState(false);
  const toast = useToast();
  const [username, setUsername] = useState(initialUsername || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialUsername) {
      setUsername(initialUsername);
    }
  }, [initialUsername]);

  const history = useHistory();
  const { setUser } = ChatState();

  const submitHandler = async () => {
    setLoading(true);
    if (!username || !password) {
      toast({
        title: "Please fill in all fields",
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
      const { data } = await axios.post("/api/user/login", { username, password }, config);
      toast({
        title: "Login successful",
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
      toast({
        title: error.response?.status === 409 ? "Akun Sedang Aktif" : "Login failed",
        description: error.response?.data?.message || "Invalid username or password.",
        status: "error",
        duration: 6000,
        isClosable: true,
        position: "top",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Username */}
      <div>
        <label htmlFor="login-username" style={labelStyle}>Username</label>
        <DarkInput
          id="login-username"
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="login-password" style={labelStyle}>Password</label>
        <DarkInput
          id="login-password"
          type={show ? "text" : "password"}
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          rightElement={
            <button
              type="button"
              onClick={() => setShow(!show)}
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: "#c3c0ff",
                background: "rgba(79,70,229,0.15)",
                border: "none",
                borderRadius: "0.5rem",
                padding: "4px 10px",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "background 0.2s",
              }}>
              {show ? "Hide" : "Show"}
            </button>
          }
        />
      </div>

      {/* Login button */}
      <button
        id="btn-login"
        onClick={submitHandler}
        disabled={loading}
        className="w-full mt-2 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200"
        style={{
          fontFamily: "'Inter', sans-serif",
          background: loading
            ? "#3323cc"
            : "linear-gradient(135deg, #4f46e5, #7c3aed)",
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: loading ? "none" : "0 4px 20px rgba(79,70,229,0.4)",
          transform: "translateY(0)",
          letterSpacing: "0.01em",
        }}
        onMouseEnter={e => { if (!loading) e.target.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.target.style.transform = "translateY(0)"; }}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        ) : "Sign In"}
      </button>
    </div>
  );
};

export default Login;
