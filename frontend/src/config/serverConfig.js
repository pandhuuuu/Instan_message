// Helper to manage dynamic Server IP & Port configuration for IM Client

const DEFAULT_HOST = window.location.hostname || "localhost";
const DEFAULT_PORT = "5000";

export const getServerConfig = () => {
  try {
    const saved = localStorage.getItem("imServerConfig");
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        host: parsed.host || DEFAULT_HOST,
        port: parsed.port || DEFAULT_PORT,
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
    port: (port || DEFAULT_PORT).trim(),
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
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:${port}`;
};
