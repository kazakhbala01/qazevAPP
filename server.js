import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pg from "pg";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";

const { Pool } = pg;
// Load environment variables
dotenv.config();

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

// Database methods
async function getConnector(connectorId) {
  const result = await pool.query("SELECT * FROM connectors WHERE id = $1", [
    connectorId,
  ]);
  return result.rows[0];
}

export async function updateConnectorStatus(connectorId, status) {
  // Convert status to lowercase for consistency
  status = status.toLowerCase();

  const allowedStatuses = ["available", "in use", "out of service"];

  // Validate status
  if (!allowedStatuses.includes(status)) {
    throw new Error(
      `Invalid status: ${status}. Allowed values are: ${allowedStatuses.join(", ")}`,
    );
  }

  // Update status in the database
  await pool.query("UPDATE connectors SET status = $1 WHERE id = $2", [
    status,
    connectorId,
  ]);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Fetch locations with nested stations and connectors
app.get("/api/locations", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        l.id,
        l.name,
        l.latitude::float AS latitude,
        l.longitude::float AS longitude,
        l.details,
        l.capacity,  -- Add this line to include capacity
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', s.id,
            'station_number', s.station_number,
            'status', s.status,
            'connectors', (
              SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id', c.id,
                  'connector_type', c.connector_type,
                  'power', c.power,
                  'status', c.status
                )
              )
              FROM connectors c
              WHERE c.station_id = s.id
            )
          )
        ) AS stations
      FROM locations l
      LEFT JOIN stations s ON l.id = s.location_id
      GROUP BY l.id
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching locations:", err);
    res.status(500).send("Server error");
  }
});

// Start charging via OCPP
app.post("/api/start-charge", async (req, res) => {
  const { connectorId, idTag } = req.body;

  // Input validation
  if (!connectorId || !idTag) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if connector exists and update its status to "In Use"
    const connector = await getConnector(connectorId);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }

    // Ensure consistent case sensitivity
    await updateConnectorStatus(connectorId, "in use");

    // Broadcast RemoteStartTransaction to charge points
    broadcastRemoteStartTransaction(wss, connectorId, idTag);

    res.json({ success: true });
  } catch (error) {
    console.error("Error starting charge:", error);
    res.status(500).json({ error: error.message });
  }
});
// Stop charging via OCPP
// Stop charging via OCPP
app.post("/api/stop-charge", async (req, res) => {
  const { connectorId, transactionId } = req.body;

  // Input validation
  if (!connectorId || !transactionId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if connector exists and update its status to "Available"
    const connector = await getConnector(connectorId);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }

    // Ensure consistent case sensitivity
    await updateConnectorStatus(connectorId, "available");

    // Broadcast RemoteStopTransaction to charge points
    broadcastRemoteStopTransaction(wss, transactionId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error stopping charge:", error);
    res.status(500).json({ error: error.message });
  }
});

// Broadcast RemoteStopTransaction to all connected charge points
// Broadcast RemoteStopTransaction to all connected charge points
function broadcastRemoteStopTransaction(wss, transactionId) {
  if (!wss) {
    console.error("WebSocket server not initialized");
    return;
  }
  wss.clients.forEach((client) => {
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

// Setup OCPP WebSocket server
let wss;
function setupOcppServer(server) {
  const wsServer = new WebSocketServer({ server });

  wsServer.on("connection", (ws) => {
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

  return wsServer;
}

// Fetch connector details by connectorId
app.get("/api/connectors/:connectorId", async (req, res) => {
  const { connectorId } = req.params;
  try {
    const { rows } = await pool.query(
      `
      SELECT 
        c.id AS connector_id,
        c.connector_type,
        c.power,
        c.status,
        s.station_number,
        l.name AS location_name
      FROM connectors c
      LEFT JOIN stations s ON c.station_id = s.id
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE c.id = $1
    `,
      [connectorId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Connector not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching connector details:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Broadcast RemoteStartTransaction to all connected charge points
function broadcastRemoteStartTransaction(wss, connectorId, idTag) {
  if (!wss) {
    console.error("WebSocket server not initialized");
    return;
  }

  wss.clients.forEach((client) => {
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
app.get("/api/reservations/:connectorId", async (req, res) => {
  const { connectorId } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM reservations WHERE connector_id = $1",
      [connectorId],
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching reservations:", err);
    res.status(500).send("Server error");
  }
});

app.post("/api/reservations", async (req, res) => {
  const { connector_id, arrival_time, duration } = req.body;

  // Input validation
  if (!connector_id || !arrival_time || !duration) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Insert reservation into database
    const { rows } = await pool.query(
      `
      INSERT INTO reservations (connector_id, arrival_time, duration)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [connector_id, arrival_time, duration],
    );

    res.json(rows[0]);
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Initialize OCPP WebSocket server
wss = setupOcppServer(server);
