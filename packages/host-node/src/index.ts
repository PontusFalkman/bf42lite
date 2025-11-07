import { WebSocketServer } from "ws";

const PORT = 8080;

const wss = new WebSocketServer({ port: PORT });

console.log(`[bf42lite] Host server starting on ws://localhost:${PORT}`);

wss.on("connection", (ws) => {
  console.log("[Host] Client connected.");

  ws.on("message", (message) => {
    // For now, just log that we got a message
    console.log("[Host] Received message:", message);
  });

  ws.on("close", () => {
    console.log("[Host] Client disconnected.");
  });

  ws.on("error", (error) => {
    console.error("[Host] WebSocket error:", error);
  });
});