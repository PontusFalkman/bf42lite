/**
 * A network adapter that connects to a real WebSocket server.
 */

// Per the design, all messages are binary
type Message = Uint8Array;
type MessageHandler = (msg: Message) => void;

export class WebSocketAdapter {
  private ws: WebSocket;
  private messageHandler: MessageHandler | null = null;
  private connectedPromise: Promise<void>;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    // A promise that resolves when the connection is open
    this.connectedPromise = new Promise((resolve, reject) => {
      this.ws.onopen = () => {
        console.log("[Client] Connected to WebSocket server.");
        resolve();
      };
      this.ws.onerror = (err) => {
        console.error("[Client] WebSocket error:", err);
        reject(err);
      };
    });

    this.ws.onmessage = (event) => {
      // The server sends ArrayBuffers, which we pass on as Uint8Arrays
      const msg = new Uint8Array(event.data);
      if (this.messageHandler) {
        this.messageHandler(msg);
      }
    };

    this.ws.onclose = () => {
      console.log("[Client] Disconnected from WebSocket server.");
    };
  }

  /**
   * Waits for the WebSocket connection to be established.
   */
  public async awaitConnection(): Promise<void> {
    return this.connectedPromise;
  }

  /**
   * Called by the client to receive messages from the host.
   */
  public onMessage(handler: MessageHandler) {
    this.messageHandler = handler;
  }

  /**
   * Called by the client to send a binary message to the host.
   */
  public send(msg: Message) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      console.warn("[Client] WebSocket not open. Message not sent.");
    }
  }
}