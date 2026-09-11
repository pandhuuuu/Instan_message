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
      style={{ background: "#0c1317" }}>

      {/* Main App Shell */}
      <div
        className="w-full flex overflow-hidden"
        style={{
          background: "#111b21",
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
