// Shared Test Client Utilities for IM Automation Harness
// Centralizes HTTP request transport and dynamic event-driven Socket.io awaiting.

const http = require("http");

/**
 * Standardized HTTP request helper for REST API integration tests.
 */
function httpRequest({ method, path: reqPath, data, token, host, port }) {
  const targetHost = host || process.env.TEST_HOST || "127.0.0.1";
  const targetPort = port || process.env.PORT || process.env.TEST_PORT || 5000;

  return new Promise((resolve, reject) => {
    const postData = data !== undefined ? JSON.stringify(data) : "";
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        host: targetHost,
        port: targetPort,
        path: reqPath,
        method,
        headers,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, data: parsed, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, text: body, headers: res.headers });
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Dynamic event-driven waiter for Socket.io events.
 * Resolves immediately when the event arrives without arbitrary sleep delays.
 *
 * @param {object} socket - Socket.io client instance
 * @param {string} eventName - Name of the event to await
 * @param {number} timeoutMs - Max timeout in milliseconds before throwing
 * @param {function} [predicate] - Optional filtering predicate (returns boolean)
 * @returns {Promise<any>} Payload received from the event
 */
function waitForSocketEvent(socket, eventName, timeoutMs = 4000, predicate = null) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for socket event: '${eventName}'`));
    }, timeoutMs);

    function handler(...args) {
      if (predicate && !predicate(...args)) {
        return;
      }
      cleanup();
      resolve(args.length <= 1 ? args[0] : args);
    }

    function cleanup() {
      clearTimeout(timer);
      socket.off(eventName, handler);
    }

    socket.on(eventName, handler);
  });
}

module.exports = {
  httpRequest,
  waitForSocketEvent,
};
