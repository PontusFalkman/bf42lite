import { NetworkAdapter, NetworkStats } from './types';
import { pack, unpack } from 'msgpackr';
import { ClientMessage, ServerMessage } from '@bf42lite/protocol';

export class WebSocketAdapter implements NetworkAdapter {
  private socket: WebSocket | null = null;
  private handlers = {
    message: [] as ((msg: ServerMessage) => void)[],
    connect: [] as (() => void)[],
    disconnect: [] as ((reason?: string) => void)[]
  };
  
  private stats: NetworkStats = { rtt: 0, loss: 0, bytesIn: 0, bytesOut: 0 };

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(url);
      this.socket.binaryType = 'arraybuffer';

      this.socket.onopen = () => {
        console.log(`[Net] Connected to ${url}`);
        this.handlers.connect.forEach(cb => cb());
        resolve();
      };

      this.socket.onerror = (err) => {
        console.error('[Net] Connection Error', err);
        if (this.socket?.readyState !== WebSocket.OPEN) {
          reject(err);
        }
      };

      this.socket.onclose = (event) => {
        console.log('[Net] Disconnected', event.reason);
        this.handlers.disconnect.forEach(cb => cb(event.reason));
      };

      this.socket.onmessage = (event) => {
        try {
          const data = new Uint8Array(event.data as ArrayBuffer);
          this.stats.bytesIn += data.byteLength;
          
          // Decode Binary -> Object
          const msg = unpack(data) as ServerMessage;
          
          this.handlers.message.forEach(cb => cb(msg));
        } catch (e) {
          console.error('[Net] Failed to decode message', e);
        }
      };
    });
  }

  disconnect(): void {
    this.socket?.close();
  }

  send(msg: ClientMessage): void {
    if (!this.isConnected()) return;

    // Encode Object -> Binary
    const data = pack(msg);
    this.stats.bytesOut += data.byteLength;
    
    this.socket?.send(data);
  }

  onMessage(cb: (msg: ServerMessage) => void) { this.handlers.message.push(cb); }
  onConnect(cb: () => void) { this.handlers.connect.push(cb); }
  onDisconnect(cb: (reason?: string) => void) { this.handlers.disconnect.push(cb); }

  getStats() { return this.stats; }
}