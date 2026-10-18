import { io, type Socket } from "socket.io-client";
import { apiBaseUrl, getToken, initTokenStore, onAuthInvalidated } from "./api";

let socket: Socket | null = null;

onAuthInvalidated(() => {
  socket?.disconnect();
  socket = null;
});

/** Conexión única al chat. El token va en el handshake. */
export async function connectChatSocket() {
  await initTokenStore();
  const token = getToken();
  if (!token) return null;

  if (!socket) {
    socket = io(apiBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket"],
      auth: { token },
      autoConnect: true,
    });
  } else {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
  }
  return socket;
}
