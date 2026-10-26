import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { subscribeToAlerts } from './pubsubService';
import { IAlert } from '../models/Alert';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.io attached to the HTTP server and wire up Redis Pub/Sub events.
 */
export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Allow all origins in local dev
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id} (Total: ${io?.engine.clientsCount})`);

    socket.emit('connection_established', {
      message: 'Connected to Network Intrusion Detection Real-Time Stream',
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  // Subscribe to Redis Pub/Sub alerts and forward immediately to all WebSocket clients
  subscribeToAlerts((alert: IAlert) => {
    if (io) {
      console.log(`📡 [Socket.IO] Broadcasting real-time alert to ${io.engine.clientsCount} connected clients: [${alert.attack_type}]`);
      io.emit('new_alert', alert);
    }
  });

  return io;
}

/**
 * Get the active Socket.IO server instance
 */
export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast an alert update event to all connected clients.
 */
export function broadcastAlertUpdated(alert: any): void {
  if (io) {
    io.emit('alert_updated', alert);
  }
}

/**
 * Broadcast an alert deletion event to all connected clients.
 */
export function broadcastAlertDeleted(alertId: string): void {
  if (io) {
    io.emit('alert_deleted', { id: alertId });
  }
}

