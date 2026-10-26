import { io, Socket } from "socket.io-client";
import type { SecurityAlert } from "./sentinel-api";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;

export function connectSocket(
  onAlert: (alert: SecurityAlert) => void,
  onStatusChange?: (connected: boolean) => void,
) {
  if (socket?.connected) return;

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log("⚡ Connected to SentinelIDS:", socket?.id);
    onStatusChange?.(true);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 SentinelIDS disconnected:", reason);
    onStatusChange?.(false);
  });

  socket.on("connect_error", (error) => {
    console.warn("⚠️ Socket connection error:", error.message);
    onStatusChange?.(false);
  });

  socket.on("new_alert", (alert) => {
    console.log("🚨 Real-time alert received:", alert);

    const mappedAlert: SecurityAlert = {
      id: alert._id,
      severity: alert.severity,
      attackType: alert.attack_type,
      sourceIp: alert.source_ip,
      description: alert.message,
      status: alert.status,
      timestamp: alert.detected_at,
      fresh: true,
    };

    onAlert(mappedAlert);
  });
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}