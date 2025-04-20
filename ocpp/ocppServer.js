import { WebSocketServer } from "ws";
import { updateConnectorStatus } from "../server";

let wssInstance;

export function setupOcppServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("Charge point connected");

    ws.on("message", async (data) => {
      const message = JSON.parse(data);
      console.log("Received OCPP message:", message);

      if (message[2] === "BootNotification") {
        // Respond to BootNotification
        ws.send(
          JSON.stringify([
            3,
            message[1],
            {
              currentTime: new Date().toISOString(),
              interval: 300,
              status: "Accepted",
            },
          ]),
        );
      } else if (message[2] === "StatusNotification") {
        // Update connector status in the database
        const { connectorId, status } = message[3];
        await updateConnectorStatus(connectorId, status);
        console.log(`Updated connector ${connectorId} status to ${status}`);
      }
    });

    ws.on("close", () => {
      console.log("Charge point disconnected");
    });
  });

  wssInstance = wss; // Store the wss instance
  return wss;
}

// Broadcast RemoteStartTransaction to all connected charge points
export function broadcastRemoteStartTransaction(connectorId, idTag) {
  if (!wssInstance) {
    console.error("WebSocket server not initialized");
    return;
  }

  wssInstance.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify([
          2,
          "msg123",
          "RemoteStartTransaction",
          { connectorId, idTag },
        ]),
      );
    }
  });
}
