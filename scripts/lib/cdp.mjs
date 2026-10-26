// Loopback-only test transport. Never included in app packages.
export async function connectPage(
  endpoint,
  { WebSocketImpl = WebSocket, timeout = 180000 } = {},
) {
  const url = new URL(endpoint);
  if (
    url.protocol !== "ws:" ||
    url.hostname !== "127.0.0.1" ||
    url.username ||
    url.password
  )
    throw Error("CDP must use an isolated loopback endpoint.");
  const socket = new WebSocketImpl(endpoint),
    pending = new Map();
  let sequence = 0;
  const disconnected = () => {
    for (const call of pending.values()) {
      clearTimeout(call.timer);
      call.reject(Error("CDP disconnected"));
    }
    pending.clear();
  };
  socket.addEventListener("close", disconnected);
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    clearTimeout(call.timer);
    message.error
      ? call.reject(Error("CDP: " + JSON.stringify(message.error)))
      : call.resolve(message.result);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        socket.close();
        reject(Error("CDP connection timeout"));
      },
      Math.min(timeout, 10000),
    );
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(Error("CDP connection failed"));
      },
      { once: true },
    );
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence,
        timer = setTimeout(() => {
          pending.delete(id);
          reject(Error("CDP command timeout: " + method));
        }, timeout);
      pending.set(id, { resolve, reject, timer });
      try {
        socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  return {
    send,
    close: () => {
      socket.close();
      disconnected();
    },
    evaluate: async (expression) => {
      const result = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails)
        throw Error(
          "Renderer exception: " + JSON.stringify(result.exceptionDetails),
        );
      return result.result.value;
    },
  };
}
