import "./styles.css";
import SingleChat from "./SingleChat";
import { ChatState } from "../Context/ChatProvider";

const Chatbox = ({ fetchAgain, setFetchAgain }) => {
  const { selectedChat } = ChatState();

  return (
    <main
      className={`flex-1 h-full flex flex-col relative overflow-hidden ${selectedChat ? "flex" : "hidden md:flex"}`}
      style={{ background: "#0b1326" }}>
      <SingleChat fetchAgain={fetchAgain} setFetchAgain={setFetchAgain} />
    </main>
  );
};

export default Chatbox;
