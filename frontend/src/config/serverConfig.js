// Helper to manage dynamic Server IP & Port configuration for IM Client

const currentHost = (typeof window !== "undefined" && window.location.hostname) ? window.location.hostname : "localhost";
const currentPort = (typeof window !== "undefined" && window.location.port) ? window.location.port : "";

const DEFAULT_HOST = currentHost;
const DEFAULT_PORT = currentPort === "3000" ? "5000" : (currentPort || "5000");

export const getServerConfig = () => {
  try {
    const saved = localStorage.getItem("imServerConfig");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        host: parsed.host || DEFAULT_HOST,
        port: (parsed.port !== undefined && parsed.port !== "") ? parsed.port : DEFAULT_PORT,
      };
    }
  } catch (e) {
    console.error("Failed to parse server config", e);
  }
  return {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
  };
};

export const setServerConfig = (host, port) => {
  const config = {
    host: (host || DEFAULT_HOST).trim(),
    port: port !== undefined ? port.trim() : DEFAULT_PORT,
  };
  localStorage.setItem("imServerConfig", JSON.stringify(config));
  return config;
};

export const getServerBaseUrl = () => {
  const { host, port } = getServerConfig();
  // If host already includes protocol (http:// or https://), handle it
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return port ? `${host}:${port}` : host;
  }
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "https:" : "http:";
  return port ? `${protocol}//${host}:${port}` : `${protocol}//${host}`;
};
