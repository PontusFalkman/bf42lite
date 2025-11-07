/**
 * Task N1: Local client <-> host message pipeline.
 *
 * This simulates a zero-latency, high-reliability network connection
 * by queueing messages and processing them on the *next* event loop tick.
 * This simulates the asynchronous nature of a real network.
 */

// Per the design, all messages are binary
type Message = Uint8Array;
type MessageHandler = (msg: Message) => void;

export class LoopbackAdapter {
  private clientMessageHandler: MessageHandler | null = null;
  private hostMessageHandler: MessageHandler | null = null;

  // Simulates the "wire"
  private clientQueue: Message[] = [];
  private hostQueue: Message[] = [];

  private isProcessing = false;

  /**
   * Called by the client-side logic to receive messages from the host.
   */
  public onClientMessage(handler: MessageHandler) {
    this.clientMessageHandler = handler;
  }

  /**
   * Called by the host-side logic to receive messages from the client.
   */
  public onHostMessage(handler: MessageHandler) {
    this.hostMessageHandler = handler;
  }

  /**
   * Called by the client to send a binary message to the host.
   */
  public sendClientMessage(msg: Message) {
    this.clientQueue.push(msg);
    this.scheduleProcessing();
  }

  /**
   * Called by the host to send a binary message to the client.
   */
  public sendHostMessage(msg: Message) {
    this.hostQueue.push(msg);
    this.scheduleProcessing();
  }

  private scheduleProcessing() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    // Process on the next tick using a promise
    Promise.resolve().then(() => this.processQueues());
  }

  private processQueues() {
    // Process all client->host messages
    if (this.hostMessageHandler) {
      while (this.clientQueue.length > 0) {
        // We just checked length, so this is safe
        const msg = this.clientQueue.shift()!; 
        this.hostMessageHandler(msg);
      }
    }

    // Process all host->client messages
    if (this.clientMessageHandler) {
      while (this.hostQueue.length > 0) {
        // We just checked length, so this is safe
        const msg = this.hostQueue.shift()!;
        this.clientMessageHandler(msg);
      }
    }

    this.isProcessing = false;
  }
}