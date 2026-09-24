import { useState } from "react";
import { useToast } from "@chakra-ui/toast";
import axios from "axios";
import { useHistory } from "react-router";

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

const DarkInput = ({ id, type, placeholder, value, onChange, rightElement, accept }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        accept={accept}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...inputStyle,
          borderColor: focused ? "#4f46e5" : "#464555",
          boxShadow: focused ? "0 0 0 3px rgba(79,70,229,0.2)" : "none",
          paddingRight: rightElement ? "90px" : "14px",
          ...(type === "file" ? { paddingTop: "9px" } : {}),
        }}
      />
      {rightElement && (
        <div className="absolute right-2">{rightElement}</div>
      )}
    </div>
  );
};

const Signup = ({ onRegisterSuccess }) => {
  const [show, setShow] = useState(false);
  const toast = useToast();
  const history = useHistory();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [confirmpassword, setConfirmpassword] = useState("");
  const [password, setPassword] = useState("");
  const [pic, setPic] = useState();
  const [picLoading, setPicLoading] = useState(false);

  const submitHandler = async () => {
    setPicLoading(true);
    if (!username || !password || !confirmpassword) {
      toast({
        title: "Please enter username and password",
        status: "warning",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
      setPicLoading(false);
      return;
    }
    if (password !== confirmpassword) {
      toast({
        title: "Passwords do not match",
        status: "warning",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
      setPicLoading(false);
      return;
    }
    try {
      const config = { headers: { "Content-type": "application/json" } };
      await axios.post(
        "/api/user",
        { username, name: name.trim() || username, password, pic },
        config
      );
      toast({
        title: "Registration successful",
        description: "Account created! Please sign in with your password.",
        status: "success",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
      setPicLoading(false);
      if (onRegisterSuccess) {
        onRegisterSuccess(username);
      } else {
        history.push("/");
      }
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.message || "Failed to create account.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top",
      });
      setPicLoading(false);
    }
  };

  const postDetails = (pics) => {
    setPicLoading(true);
    if (pics === undefined) {
      toast({ title: "Please select an image!", status: "warning", duration: 4000, isClosable: true, position: "top" });
      return;
    }
    if (pics.type === "image/jpeg" || pics.type === "image/png") {
      const data = new FormData();
      data.append("file", pics);
      data.append("upload_preset", "chat-app");
      data.append("cloud_name", "piyushproj");
      fetch("https://api.cloudinary.com/v1_1/piyushproj/image/upload", {
        method: "post",
        body: data,
      })
        .then((res) => res.json())
        .then((data) => {
          setPic(data.url.toString());
          setPicLoading(false);
        })
        .catch(() => {
          setPicLoading(false);
        });
    } else {
      toast({ title: "Only JPEG/PNG are allowed!", status: "warning", duration: 4000, isClosable: true, position: "top" });
      setPicLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Username */}
      <div>
        <label htmlFor="signup-username" style={labelStyle}>Username</label>
        <DarkInput
          id="signup-username"
          type="text"
          placeholder="e.g. pandhu123"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>

      {/* Display Name (Optional) */}
      <div>
        <label htmlFor="signup-name" style={labelStyle}>
          Display Name <span style={{ color: "#918fa1", fontSize: "11px" }}>(optional)</span>
        </label>
        <DarkInput
          id="signup-name"
          type="text"
          placeholder="Name displayed in chat"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Password */}
      <div>
        <label htmlFor="signup-password" style={labelStyle}>Password</label>
        <DarkInput
          id="signup-password"
          type={show ? "text" : "password"}
          placeholder="Create password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          rightElement={
            <button type="button" onClick={() => setShow(!show)}
              style={{ fontSize: "12px", fontWeight: "600", color: "#c3c0ff", background: "rgba(79,70,229,0.15)", border: "none", borderRadius: "0.5rem", padding: "4px 10px", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
              {show ? "Hide" : "Show"}
            </button>
          }
        />
      </div>

      {/* Confirm Password */}
      <div>
        <label htmlFor="signup-confirm" style={labelStyle}>Confirm Password</label>
        <DarkInput
          id="signup-confirm"
          type={show ? "text" : "password"}
          placeholder="Re-enter password"
          value={confirmpassword}
          onChange={(e) => setConfirmpassword(e.target.value)}
        />
      </div>

      {/* Picture Upload */}
      <div>
        <label htmlFor="signup-pic" style={labelStyle}>Profile Picture <span style={{ color: "#464555" }}>(optional)</span></label>
        <div style={{
          ...inputStyle,
          padding: "8px 14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: pic ? "#10b981" : "#918fa1",
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
            {pic ? "check_circle" : "cloud_upload"}
          </span>
          <label htmlFor="signup-pic" style={{ cursor: "pointer", fontSize: "13px", flex: 1, margin: 0, color: "inherit", fontFamily: "'Inter', sans-serif" }}>
            {pic ? "Photo uploaded successfully" : "Click to upload photo (JPG/PNG)"}
          </label>
          <input
            id="signup-pic"
            type="file"
            accept="image/*"
            onChange={(e) => postDetails(e.target.files[0])}
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        id="btn-signup"
        onClick={submitHandler}
        disabled={picLoading}
        className="w-full mt-1 py-3 rounded-xl font-semibold text-white text-sm transition-all duration-200"
        style={{
          fontFamily: "'Inter', sans-serif",
          background: picLoading
            ? "#3323cc"
            : "linear-gradient(135deg, #4f46e5, #7c3aed)",
          border: "none",
          cursor: picLoading ? "not-allowed" : "pointer",
          boxShadow: picLoading ? "none" : "0 4px 20px rgba(79,70,229,0.4)",
          letterSpacing: "0.01em",
        }}
        onMouseEnter={e => { if (!picLoading) e.target.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.target.style.transform = "translateY(0)"; }}>
        {picLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        ) : "Create Account"}
      </button>
    </div>
  );
};

export default Signup;
