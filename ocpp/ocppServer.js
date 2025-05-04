// ocppServer.js
import { WebSocketServer } from "ws";
import { updateConnectorStatus } from "../server";
import { pool } from "../models/chargingSession";

let wssInstance;

export function setupOcppServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const chargePointId = req.url.replace("/", ""); // Extract charge point ID from URL
    console.log(`New charge point connected: ${chargePointId}`);

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
      } else if (message[2] === "StartTransaction") {
        // Handle StartTransaction
        const { connectorId, idTag, meterStart, timestamp } = message[3];
        const transactionId = message[3].transactionId;

        // Update database with new transaction
        await pool.query(
          "INSERT INTO charging_sessions (connector_id, user_id, transaction_id, start_time, status) VALUES ($1, $2, $3, $4, $5)",
          [connectorId, idTag, transactionId, timestamp, "active"],
        );

        ws.send(
          JSON.stringify([
            3,
            message[1],
            { transactionId, idTagInfo: { status: "Accepted" } },
          ]),
        );
      } else if (message[2] === "StopTransaction") {
        // Handle StopTransaction
        const { transactionId, meterStop, timestamp } = message[3];

        // Update database to stop the transaction
        await pool.query(
          "UPDATE charging_sessions SET end_time = $1, status = $2 WHERE transaction_id = $3 AND status = $4",
          [timestamp, "stopped", transactionId, "active"],
        );

        ws.send(
          JSON.stringify([
            3,
            message[1],
            { idTagInfo: { status: "Accepted" } },
          ]),
        );
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

// Broadcast RemoteStopTransaction to all connected charge points
export function broadcastRemoteStopTransaction(transactionId) {
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
          "RemoteStopTransaction",
          { transactionId },
        ]),
      );
    }
  });
}
