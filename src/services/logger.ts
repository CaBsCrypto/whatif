import { Server } from 'socket.io';

export class Logger {
  private static io: Server | null = null;

  static init(io: Server) {
    this.io = io;
  }

  static log(type: 'info' | 'success' | 'warn' | 'error', msg: string) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${type.toUpperCase()}] [${timestamp}] ${msg}`);
    if (this.io) {
      this.io.emit('log', { type, msg: `[${timestamp}] ${msg}` });
    }
  }
}
