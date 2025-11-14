import { ClientMessage, ServerMessage } from '@bf42lite/protocol';

export interface NetworkStats {
  rtt: number;      // Round Trip Time (ms)
  loss: number;     // Packet loss % (simulated or real)
  bytesIn: number;
  bytesOut: number;
}

export interface NetworkAdapter {
  // Connection Management
  connect(url: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Messaging
  send(msg: ClientMessage): void;
  
  // Event Listeners
  onMessage(callback: (msg: ServerMessage) => void): void;
  onConnect(callback: () => void): void;
  onDisconnect(callback: (reason?: string) => void): void;

  // Diagnostics
  getStats(): NetworkStats;
}