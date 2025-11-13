// apps/client-tauri/src/NetworkClient.ts
import { Packr } from "msgpackr";

// Interfaces from your original code
export interface TickSnapshot { entities: any[]; game_state: any; }
export interface ServerEnvelope { your_id: number; snapshot: TickSnapshot; }

export class NetworkClient {
  socket: WebSocket | null = null;
  msgpackr = new Packr();
  
  onSnapshot: (data: TickSnapshot, yourId: number | null) => void;
  onConnect: () => void;

  constructor(
    onSnapshot: (data: TickSnapshot, yourId: number | null) => void,
    onConnect: () => void
  ) {
    this.onSnapshot = onSnapshot;
    this.onConnect = onConnect;
  }

  connect(url: string) {
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = () => {
      console.log("[WS] open");
      this.onConnect();
    };

    this.socket.onerror = (ev) => { console.error("[WS] error", ev); };
    this.socket.onclose = (ev) => { console.warn("[WS] close", ev.code, ev.reason); };

    this.socket.onmessage = async (event) => {
      // robust Blob/ArrayBuffer handling
      let ab: ArrayBuffer;
      if (event.data instanceof Blob) ab = await event.data.arrayBuffer();
      else if (event.data instanceof ArrayBuffer) ab = event.data;
      else if (event.data?.buffer instanceof ArrayBuffer) ab = event.data.buffer as ArrayBuffer;
      else { console.error("[WS] unknown event.data type", typeof event.data); return; }
    
      // decode
      let tickData: TickSnapshot;
      let yourId: number | null = null;
      try {
        const raw = this.msgpackr.decode(new Uint8Array(ab)) as any; 
        const hasEnvelope = raw && typeof raw === "object" && "snapshot" in raw && "your_id" in raw;
        if (hasEnvelope) { 
          yourId = (raw as ServerEnvelope).your_id; 
          tickData = (raw as ServerEnvelope).snapshot; 
        } else { 
          tickData = raw as TickSnapshot; 
        }
      } catch (e) { console.error("[WS] decode failed", e); return; }
    
      this.onSnapshot(tickData, yourId);
    };
  }

  sendInput(tick: number, inputs: any, dx: number, dy: number) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const msg = this.msgpackr.encode([
        tick,
        inputs,
        dx,
        dy
      ]);
      this.socket.send(msg);
    }
  }
}