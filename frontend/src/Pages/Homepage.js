import { useEffect, useState } from "react";
import { useHistory } from "react-router";
import Login from "../components/Authentication/Login";
import Signup from "../components/Authentication/Signup";
import QuickConnect from "../components/Authentication/QuickConnect";
import ServerConfigModal from "../components/miscellaneous/ServerConfigModal";

function Homepage() {
  const history = useHistory();
  const [activeTab, setActiveTab] = useState("login");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("userInfo"));
    if (user) history.push("/chats");
  }, [history]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #060e20 0%, #0b1326 40%, #131b2e 100%)" }}>

      {/* Network Server Config in Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <ServerConfigModal />
      </div>

      {/* Ambient background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #4f46e5 0%, transparent 70%)" }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(79,70,229,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(79,70,229,0.5) 1px, transparent 1px)`,
            backgroundSize: "60px 60px"
          }} />
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md mx-4 animate-slide-up"
        style={{ animationDelay: "0.1s" }}>

        {/* Brand Header */}
        <div className="text-center mb-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
          {/* Logo Icon */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{
              background: "linear-gradient(135deg, #4f46e5, #8b5cf6)",
              boxShadow: "0 8px 32px rgba(79,70,229,0.4)"
            }}>
            <span className="material-symbols-outlined text-white text-2xl">forum</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}>
            Talk-A-Tive IM System
          </h1>
          <p className="text-xs" style={{ color: "#918fa1" }}>
            Real-Time Instant Messaging Protocol & Client
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-2xl overflow-hidden animate-slide-up"
          style={{
            background: "rgba(23, 31, 51, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px -12px rgba(0,0,0,0.6)"
          }}>

          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <button
              id="tab-quick"
              onClick={() => setActiveTab("quick")}
              className="flex-1 py-3 text-xs font-semibold transition-all duration-300 relative flex items-center justify-center gap-1"
              style={{
                fontFamily: "'Inter', sans-serif",
                color: activeTab === "quick" ? "#34d399" : "#918fa1",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>bolt</span>
              <span>Quick IM</span>
              {activeTab === "quick" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: "linear-gradient(90deg, #10b981, #059669)" }} />
              )}
            </button>
            <button
              id="tab-login"
              onClick={() => setActiveTab("login")}
              className="flex-1 py-3 text-xs font-semibold transition-all duration-300 relative"
              style={{
                fontFamily: "'Inter', sans-serif",
                color: activeTab === "login" ? "#c3c0ff" : "#918fa1",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}>
              Sign In
              {activeTab === "login" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: "linear-gradient(90deg, #4f46e5, #8b5cf6)" }} />
              )}
            </button>
            <button
              id="tab-signup"
              onClick={() => setActiveTab("signup")}
              className="flex-1 py-3 text-xs font-semibold transition-all duration-300 relative"
              style={{
                fontFamily: "'Inter', sans-serif",
                color: activeTab === "signup" ? "#c3c0ff" : "#918fa1",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}>
              Sign Up
              {activeTab === "signup" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: "linear-gradient(90deg, #4f46e5, #8b5cf6)" }} />
              )}
            </button>
          </div>

          {/* Form Panel */}
          <div className="p-6">
            {activeTab === "quick" ? (
              <QuickConnect />
            ) : activeTab === "login" ? (
              <Login />
            ) : (
              <Signup />
            )}
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center mt-5 text-xs animate-fade-in"
          style={{ color: "#464555", animationDelay: "0.5s" }}>
          By signing in, you agree to our terms and privacy policy.
        </p>
      </div>
    </div>
  );
}

export default Homepage;
