import { useState } from "react";
import Chatbox from "../components/Chatbox";
import MyChats from "../components/MyChats";
import { ChatState } from "../Context/ChatProvider";

const Chatpage = () => {
  const [fetchAgain, setFetchAgain] = useState(false);
  const { user } = ChatState();

  return (
    <div
      className="w-full h-screen flex items-stretch font-sans overflow-hidden"
      style={{ background: "#060e20" }}>

      {/* Main App Shell */}
      <div
        className="w-full flex overflow-hidden"
        style={{
          background: "#0b1326",
          boxShadow: "0 0 60px rgba(0,0,0,0.6)",
        }}>
        {user && <MyChats fetchAgain={fetchAgain} />}
        {user && (
          <Chatbox fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} />
        )}
      </div>
    </div>
  );
};

export default Chatpage;
