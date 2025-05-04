import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pg from "pg";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const { Pool } = pg;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
dotenv.config();

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

//User

// Function to hash passwords
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

// Function to compare passwords
async function comparePasswords(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Create JWT token
function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

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

// Sign-in endpoint
app.post("/api/sign-in", async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    // Find user by email
    const {
      rows: [user],
    } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    // If user not found
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Compare password
    const isMatch = await comparePasswords(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create token
    const token = createToken(user);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Error signing in:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Sign-up endpoint
app.post("/api/sign-up", async (req, res) => {
  const { name, email, password } = req.body;

  // Input validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if user already exists
    const {
      rows: [existingUser],
    } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const {
      rows: [newUser],
    } = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [name, email, passwordHash],
    );

    // Create token
    const token = createToken(newUser);

    res.status(201).json({
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    console.error("Error signing up:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Protected route example
app.get("/api/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
    const {
      rows: [user],
    } = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [
      decoded.id,
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Server error" });
  }
});

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

app.post("/api/start-transaction", async (req, res) => {
  const { connectorId, userId, transactionId } = req.body;

  if (!connectorId || !userId || !transactionId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if connector is available
    const connector = await getConnector(connectorId);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }

    // Check if connector is already in use
    const activeSession = await pool.query(
      "SELECT * FROM charging_sessions WHERE connector_id = $1 AND status = $2",
      [connectorId, "active"],
    );

    if (activeSession.rows.length > 0) {
      return res.status(409).json({ error: "Connector is already in use" });
    }

    // Start new charging session
    await pool.query(
      "INSERT INTO charging_sessions (connector_id, user_id, transaction_id, status) VALUES ($1, $2, $3, $4)",
      [connectorId, userId, transactionId, "active"],
    );

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Error starting charging session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/stop-transaction", async (req, res) => {
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: "Missing transaction ID" });
  }

  try {
    // Stop the charging session
    await pool.query(
      "UPDATE charging_sessions SET end_time = NOW(), status = $1 WHERE transaction_id = $2 AND status = $3",
      ["stopped", transactionId, "active"],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Error stopping charging session:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/active-charge/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Fetch active charging session for the user
    const activeSession = await pool.query(
      "SELECT * FROM charging_sessions WHERE user_id = $1 AND status = $2",
      [userId, "active"],
    );

    if (activeSession.rows.length > 0) {
      res.json(activeSession.rows[0]); // Return the active session
    } else {
      res.status(404).json({ error: "No active charging session" });
    }
  } catch (err) {
    console.error("Error fetching active charging session:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// Start charging via OCPP
app.post("/api/start-charge", async (req, res) => {
  const { connectorId, idTag, userId } = req.body;

  if (!connectorId || !idTag || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check if connector exists and is available
    const connector = await getConnector(connectorId);
    if (!connector) {
      return res.status(404).json({ error: "Connector not found" });
    }

    // Check if connector is already in use
    const activeSession = await pool.query(
      "SELECT * FROM charging_sessions WHERE connector_id = $1 AND status = $2",
      [connectorId, "active"],
    );

    if (activeSession.rows.length > 0) {
      return res.status(409).json({ error: "Connector is already in use" });
    }

    // Generate a unique transaction ID
    const transactionId = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Start new charging session
    await pool.query(
      "INSERT INTO charging_sessions (connector_id, user_id, transaction_id, status) VALUES ($1, $2, $3, $4)",
      [connectorId, userId, transactionId, "active"],
    );

    res.json({ success: true, transactionId });
  } catch (error) {
    console.error("Error starting charging session:", error);
    res.status(500).json({ error: "Server error" });
  }
});
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

app.get("/api/reservations/connector/:connectorId", async (req, res) => {
  const { connectorId } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM reservations WHERE connector_id = $1",
      [connectorId],
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching reservations by connector ID:", err);
    res.status(500).send("Server error");
  }
});

app.post("/api/reservations", async (req, res) => {
  const { connector_id, arrival_time, duration, user_id } = req.body;

  // Input validation
  if (!connector_id || !arrival_time || !duration || !user_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Insert reservation into database
    const { rows } = await pool.query(
      `
      INSERT INTO reservations (connector_id, arrival_time, duration, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [connector_id, arrival_time, duration, user_id],
    );
    res.json(rows[0]);
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});

app.get("/api/reservations/:reservationId", async (req, res) => {
  const { reservationId } = req.params;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM reservations WHERE id = $1",
      [reservationId],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error fetching reservation by ID:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Endpoint for updating a reservation
app.put("/api/reservations/:reservationId", async (req, res) => {
  const { reservationId } = req.params;
  const { arrival_time, duration } = req.body;
  try {
    await pool.query(
      "UPDATE reservations SET arrival_time = $1, duration = $2 WHERE id = $3",
      [arrival_time, duration, reservationId],
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating reservation:", err);
    res.status(500).send("Server error");
  }
});

// Endpoint for deleting a reservation
app.delete("/api/reservations/:reservationId", async (req, res) => {
  const { reservationId } = req.params;
  try {
    await pool.query("DELETE FROM reservations WHERE id = $1", [reservationId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting reservation:", err);
    res.status(500).send("Server error");
  }
});

app.get("/api/user-reservations", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    console.error("Debug: Missing user ID");
    return res.status(400).json({ error: "Missing user ID" });
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM reservations WHERE user_id = $1",
      [userId],
    );
    res.json(rows);
  } catch (err) {
    console.error("Debug: Error fetching user reservations:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Initialize OCPP WebSocket server
wss = setupOcppServer(server);
