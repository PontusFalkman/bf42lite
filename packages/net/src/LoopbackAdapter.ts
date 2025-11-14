import { NetworkAdapter, NetworkStats } from './types';
import { ClientMessage, ServerMessage } from '@bf42lite/protocol';

export class LoopbackAdapter implements NetworkAdapter {
  private connected = false;
  private peer: LoopbackAdapter | null = null;
  
  private onMsgCallbacks: ((msg: any) => void)[] = [];
  private onConnectCallbacks: (() => void)[] = [];
  
  public latencyMs = 0; 

  constructor() {}

  static pair(): [LoopbackAdapter, LoopbackAdapter] {
    const a = new LoopbackAdapter();
    const b = new LoopbackAdapter();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  async connect(_url: string): Promise<void> {
    setTimeout(() => {
      this.connected = true;
      this.onConnectCallbacks.forEach(cb => cb());
    }, 10);
  }

  disconnect() {
    this.connected = false;
  }

  isConnected() { return this.connected; }

  send(msg: ClientMessage | ServerMessage) {
    const peer = this.peer; // Capture locally to satisfy TS in setTimeout
    if (!peer) return;
    
    const data = JSON.parse(JSON.stringify(msg));

    if (this.latencyMs > 0) {
      setTimeout(() => peer.receive(data), this.latencyMs);
    } else {
      peer.receive(data);
    }
  }

  private receive(msg: any) {
    if (this.connected) {
      this.onMsgCallbacks.forEach(cb => cb(msg));
    }
  }

  onMessage(cb: (msg: any) => void) { this.onMsgCallbacks.push(cb); }
  onConnect(cb: () => void) { this.onConnectCallbacks.push(cb); }
  onDisconnect(_cb: (reason?: string) => void) {}
  
  getStats(): NetworkStats {
    return { rtt: 0, loss: 0, bytesIn: 0, bytesOut: 0 };
  }
}