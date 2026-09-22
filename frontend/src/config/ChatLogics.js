
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

/**
 * Computes receipt state for a message ("sent" | "delivered" | "read")
 */
export const getMessageStatus = (message, currentUserId, chat) => {
  if (!message) return "sent";
  const isGroup = chat?.isGroupChat;
  const readBy = Array.isArray(message.readBy) ? message.readBy : [];
  const deliveredTo = Array.isArray(message.deliveredTo) ? message.deliveredTo : [];
  const myId = currentUserId ? String(currentUserId) : "";

  if (isGroup) {
    const readersOtherThanMe = readBy.filter((u) => String(u._id || u) !== myId);
    if (readersOtherThanMe.length > 0) return "read";
    const deliveredOtherThanMe = deliveredTo.filter((u) => String(u._id || u) !== myId);
    if (deliveredOtherThanMe.length > 0) return "delivered";
    return "sent";
  } else {
    const recipient = chat?.users?.find((u) => String(u._id || u) !== myId);
    const recipientId = recipient ? String(recipient._id || recipient) : "";

    if (recipientId && readBy.some((u) => String(u._id || u) === recipientId)) {
      return "read";
    }
    if (recipientId && deliveredTo.some((u) => String(u._id || u) === recipientId)) {
      return "delivered";
    }
    return "sent";
  }
};
