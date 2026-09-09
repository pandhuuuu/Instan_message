const ChatLoading = () => {
  return (
    <div className="flex flex-col gap-2 px-1 py-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-3 rounded-xl"
          style={{
            background: "rgba(34,42,61,0.5)",
            animation: `shimmer 1.5s ${i * 0.1}s infinite linear`,
            backgroundSize: "200% 100%",
            backgroundImage: "linear-gradient(90deg, rgba(34,42,61,0.5) 0%, rgba(45,52,73,0.8) 50%, rgba(34,42,61,0.5) 100%)",
          }}>
          {/* Avatar skeleton */}
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            background: "rgba(70,69,85,0.4)", flexShrink: 0,
          }} />
          {/* Text skeleton */}
          <div className="flex-1 flex flex-col gap-2">
            <div style={{
              height: 12, borderRadius: "9999px",
              background: "rgba(70,69,85,0.4)",
              width: `${55 + (i % 3) * 15}%`,
            }} />
            <div style={{
              height: 10, borderRadius: "9999px",
              background: "rgba(70,69,85,0.25)",
              width: `${30 + (i % 4) * 10}%`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChatLoading;
