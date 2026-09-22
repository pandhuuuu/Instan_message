
export const isSameSender = (messages, m, i, userId) => {
  return (
    i < messages.length - 1 &&
    (messages[i + 1].sender._id !== m.sender._id ||
      messages[i + 1].sender._id === undefined) &&
    messages[i].sender._id !== userId
  );
};

export const isLastMessage = (messages, i, userId) => {
  return (
    i === messages.length - 1 &&
    messages[messages.length - 1].sender._id !== userId &&
    messages[messages.length - 1].sender._id
  );
};

export const isSameUser = (messages, m, i) => {
  return i > 0 && messages[i - 1].sender._id === m.sender._id;
};

export const getSender = (loggedUser, users) => {
  if (!users || !users.length) return "";
  const myId = loggedUser?._id ? String(loggedUser._id) : "";
  const other = users.find((u) => u && u._id && String(u._id) !== myId);
  return other ? other.name : (users[0]?.name || "");
};

export const getSenderFull = (loggedUser, users) => {
  if (!users || !users.length) return null;
  const myId = loggedUser?._id ? String(loggedUser._id) : "";
  const other = users.find((u) => u && u._id && String(u._id) !== myId);
  return other || users[0] || null;
};
