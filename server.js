import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pg from "pg";
import { WebSocketServer } from "ws";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const { Pool } = pg;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
dotenv.config();

const clients = new Set();

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

//email

const transporter = nodemailer.createTransport({
  service: "gmail", // or your email provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(email, code) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Verification Code",
      text: `Your verification code is: ${code}. This code expires in 10 minutes.`,
    });
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

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
  const allowedStatuses = ["available", "in use", "out of service"];
  if (!allowedStatuses.includes(status.toLowerCase())) {
    throw new Error(
      `Invalid status: ${status}. Allowed values are: ${allowedStatuses.join(", ")}`,
    );
  }
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

    if (!user.email_verified) {
      return res.status(401).json({ error: "Email not verified" });
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
      "INSERT INTO users (name, email, password_hash, email_verified) VALUES ($1, $2, $3, FALSE) RETURNING *",
      [name, email, passwordHash],
    );

    // Send verification email
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 10); // 10-minute expiration

    await pool.query(
      `
      UPDATE users 
      SET verification_code = $1, 
          code_expiration = $2
      WHERE id = $3
    `,
      [verificationCode, expiration, newUser.id],
    );

    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({
      message: "User created. Check your email for verification code.",
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
      [connectorId, "in use"],
    );

    if (activeSession.rows.length > 0) {
      return res.status(409).json({ error: "Connector is already in use" });
    }

    // Start new charging session
    await pool.query(
      "INSERT INTO charging_sessions (connector_id, user_id, transaction_id, status) VALUES ($1, $2, $3, $4)",
      [connectorId, userId, transactionId, "in use"],
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
      ["out of service", transactionId, "in use"], // Use the correct status values
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error stopping charging session:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/active-charge/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT cs.id, cs.connector_id, cs.user_id, cs.transaction_id, cs.start_time, cs.status, c.power FROM charging_sessions cs JOIN connectors c ON cs.connector_id = c.id WHERE cs.user_id = $1 AND cs.status = 'in use'",
      [userId],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "No active session found" });
    }

    const session = rows[0];
    const currentTime = Date.now();
    const sessionStartTime = new Date(session.start_time).getTime();
    const timeElapsedMs = currentTime - sessionStartTime;
    const timeElapsedHours = 0;
    const currentEnergy = timeElapsedHours * session.power;
    const soc = Math.min(60, Math.floor((currentEnergy / 60) * 100)); // Assuming default vehicle capacity of 60 kWh
    const totalCost = currentEnergy * 100; // Assuming 100〒/kWh

    const response = {
      success: true,
      data: {
        soc,
        energy_consumed: currentEnergy,
        total_cost: totalCost,
        elapsed_time: timeElapsedMs / 60000, // in minutes
        time_remaining: 0,
        connector_id: session.connector_id,
        transaction_id: session.transaction_id,
      },
    };

    console.log("API Response:", response);
    res.json(response);
  } catch (error) {
    console.error("Error fetching active session:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch active session" });
  }
});

// Start charging via OCPP
app.post("/api/start-charge", async (req, res) => {
  const { connectorId, userId } = req.body;

  if (!connectorId || !userId) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  try {
    // Check if the user has an active charging session
    const activeSession = await pool.query(
      "SELECT * FROM charging_sessions WHERE user_id = $1 AND status IN ('in use', 'reserved') AND end_time IS NULL",
      [userId],
    );

    if (activeSession.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "User already has an active charging session",
      });
    }

    // Check if connector is available
    const connector = await getConnector(connectorId);
    if (!connector || connector.status !== "available") {
      return res
        .status(409)
        .json({ success: false, error: "Connector not available" });
    }

    // Create transaction
    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Update connector status to "in use"
    await updateConnectorStatus(connectorId, "in use");

    // Create charging session
    await pool.query(
      "INSERT INTO charging_sessions (connector_id, user_id, transaction_id, status, start_time) VALUES ($1, $2, $3, $4, NOW())",
      [connectorId, userId, transactionId, "in use"],
    );

    // Notify charging point via OCPP
    if (wss) {
      broadcastRemoteStartTransaction(
        wss,
        connectorId,
        "USER123",
        transactionId,
      );
      console.log(
        `OCPP: RemoteStartTransaction sent for connector ${connectorId}`,
      );
    }

    res.json({ success: true, transactionId });
  } catch (error) {
    console.error("Error starting charge:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Stop charging via OCPP
app.post("/api/stop-charge", async (req, res) => {
  const { userId, connectorId, transactionId } = req.body;

  if (!userId || !connectorId || !transactionId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Update connector status to "available"
    await updateConnectorStatus(connectorId, "available");

    // Stop charging session
    await pool.query(
      "UPDATE charging_sessions SET end_time = NOW(), status = $1 WHERE transaction_id = $2 AND status = $3",
      ["out of service", transactionId, "in use"],
    );

    // Calculate consumption and cost
    const { rows: sessionRows } = await pool.query(
      `
      SELECT 
        cs.start_time,
        c.power
      FROM charging_sessions cs
      JOIN connectors c ON cs.connector_id = c.id
      WHERE cs.transaction_id = $1 AND cs.user_id = $2
      `,
      [transactionId, userId],
    );

    if (sessionRows.length === 0) {
      return res.status(404).json({ error: "Charging session not found" });
    }

    const session = sessionRows[0];
    const durationInHours =
      (Date.now() - new Date(session.start_time).getTime()) / (1000 * 60 * 60);
    const energyConsumed = durationInHours * session.power;
    const totalCost = Math.round(energyConsumed * 100); // Round to nearest integer

    // Add to charge history
    await pool.query(
      `
      INSERT INTO charge_history (
        user_id,
        session_id,
        connector_id,
        start_time,
        end_time,
        energy_consumed,
        total_cost
      )
      VALUES (
        $1,
        (SELECT id FROM charging_sessions WHERE transaction_id = $2),
        $3,
        $4,
        NOW(),
        $5,
        $6
      )
      `,
      [
        parseInt(userId),
        transactionId,
        parseInt(connectorId),
        session.start_time,
        parseFloat(energyConsumed.toFixed(2)),
        totalCost, // Use the rounded integer value
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error stopping charge:", error);
    res.status(500).json({ error: "Server error" });
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
let wss;
// Setup OCPP WebSocket server
function setupOcppServer(server) {
  const wsServer = new WebSocketServer({ server });

  wsServer.on("connection", (ws) => {
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
        console.log(
          `Backend received status update: ${status} for connector ${connectorId}`,
        );
      } else if (message[2] === "MeterValues") {
        // Handle MeterValues message
        const { connectorId, meterValue } = message[3];
        console.log(
          `Backend received meter update: ${meterValue} kWh for connector ${connectorId}`,
        );

        // Broadcast to clients
        broadcastMeterUpdate(connectorId, meterValue);
      }
    });

    ws.on("close", () => {
      console.log("Charge point disconnected");
    });
  });

  return wsServer;
}

function broadcastMeterUpdate(connectorId, meterValue) {
  if (!wss) {
    console.error("WebSocket server not initialized");
    return;
  }

  getActiveTransactionId(connectorId).then((transactionId) => {
    if (!transactionId) {
      console.error("No active transaction for connector", connectorId);
      return;
    }

    const update = {
      type: "meter_update",
      transactionId,
      connectorId,
      meterValue,
    };

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(update));
      }
    });
  });
}
// Broadcast RemoteStartTransaction to all connected charge points
function broadcastRemoteStartTransaction(
  wss,
  connectorId,
  idTag,
  transactionId,
) {
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify([
          2, // OCPP message type: CALL
          "msg123", // Unique message ID
          "RemoteStartTransaction",
          {
            connectorId,
            idTag,
            transactionId,
          },
        ]),
      );
    }
  });
}

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

app.post("/api/reservations", async (req, res) => {
  const { connector_id, arrival_time, duration, user_id, reservation_date } =
    req.body;

  if (
    !connector_id ||
    !arrival_time ||
    !duration ||
    !user_id ||
    !reservation_date
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Check for conflicts
    const newStartTime = new Date(`${reservation_date}T${arrival_time}`);
    newStartTime.setHours(
      parseInt(arrival_time.split(":")[0]),
      parseInt(arrival_time.split(":")[1]),
      0,
    );
    const newEndTime = new Date(newStartTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + parseInt(duration));

    const existingReservations = await pool.query(
      "SELECT arrival_time, duration FROM reservations WHERE connector_id = $1 AND reservation_date = $2",
      [connector_id, reservation_date],
    );

    let conflictExists = false;
    for (const res of existingReservations.rows) {
      const existingStartTime = new Date(
        `${reservation_date}T${res.arrival_time}`,
      );
      existingStartTime.setHours(
        parseInt(res.arrival_time.split(":")[0]),
        parseInt(res.arrival_time.split(":")[1]),
        0,
      );
      const existingEndTime = new Date(existingStartTime);
      existingEndTime.setMinutes(existingEndTime.getMinutes() + res.duration);

      if (newStartTime < existingEndTime && newEndTime > existingStartTime) {
        conflictExists = true;
        break;
      }
    }

    if (conflictExists) {
      return res.status(409).json({
        error: "Reservation time conflicts with existing reservation",
      });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO reservations (
        connector_id,
        arrival_time,
        duration,
        user_id,
        reservation_date
      )
      VALUES ($1, $2, $3, $4, to_date($5, 'YYYY-MM-DD'))
      RETURNING *
    `,
      [connector_id, arrival_time, duration, user_id, reservation_date],
    );

    rows[0].reservation_date = rows[0].reservation_date
      .toISOString()
      .split("T")[0];
    res.json(rows[0]);
  } catch (err) {
    console.error("Error creating reservation:", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});

// In server.js GET route
app.get("/api/reservations/connector/:connectorId", async (req, res) => {
  const { connectorId } = req.params;
  const { date } = req.query;

  try {
    let query =
      "SELECT *, to_char(reservation_date, 'YYYY-MM-DD') as formatted_date FROM reservations WHERE connector_id = $1";
    let params = [connectorId];

    if (date) {
      query += ` AND reservation_date = to_date($${params.length + 1}, 'YYYY-MM-DD')`;
      params.push(date);
    }

    const { rows } = await pool.query(query, params);
    res.json(
      rows.map((row) => ({
        ...row,
        reservation_date: row.formatted_date,
      })),
    );
  } catch (err) {
    console.error("Error fetching reservations by connector ID:", err);
    res.status(500).send("Server error");
  }
});
// In your server.js
app.get("/api/reservations/:reservationId", async (req, res) => {
  const { reservationId } = req.params;

  console.log(`Received request for reservation ID: ${reservationId}`);

  if (isNaN(parseInt(reservationId))) {
    console.log("Invalid reservation ID format");
    return res
      .status(400)
      .json({ success: false, message: "Invalid reservation ID" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        r.id,
        r.arrival_time,
        r.duration,
        r.connector_id,
        s.station_number AS station_name,
        l.name AS location_name
      FROM reservations r
      LEFT JOIN connectors c ON r.connector_id = c.id
      LEFT JOIN stations s ON c.station_id = s.id
      LEFT JOIN locations l ON s.location_id = l.id
      WHERE r.id = $1
      `,
      [reservationId],
    );

    if (rows.length === 0) {
      console.log(`Reservation not found for ID: ${reservationId}`);
      return res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }

    console.log(`Found reservation: `, rows[0]);
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
    return res.status(400).json({ error: "Missing user ID" });
  }

  try {
    const { rows } = await pool.query(
      `
    SELECT 
      r.id,
      r.arrival_time,
      r.duration,
      r.reservation_date,
      r.connector_id,
      s.station_number AS station_name,
      l.name AS location_name,
      c.connector_type
    FROM reservations r
    LEFT JOIN connectors c ON r.connector_id = c.id
    LEFT JOIN stations s ON c.station_id = s.id
    LEFT JOIN locations l ON s.location_id = l.id
    WHERE r.user_id = $1
  `,
      [userId],
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching user reservations:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/start-session", async (req, res) => {
  try {
    const { connectorId, userId } = req.body;

    if (!connectorId || !userId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Generate a unique transaction ID
    const transactionId = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    // Create the session
    const { rows } = await pool.query(
      "INSERT INTO charging_sessions (connector_id, user_id, transaction_id, status) VALUES ($1, $2, $3, 'in use') RETURNING *",
      [connectorId, userId, transactionId],
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error starting charging session:", error);
    res.status(500).json({ error: "Failed to start charging session" });
  }
});

// Stop a charging session
app.post("/api/stop-session", async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: "Missing transaction ID" });
    }

    // Update the active session
    const { rows } = await pool.query(
      "UPDATE charging_sessions SET end_time = NOW(), status = 'completed' WHERE transaction_id = $1 AND status = 'in use' RETURNING *",
      [transactionId],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Session not found or already completed" });
    }

    const session = rows[0];

    // Calculate energy consumed (example calculation)
    const durationInHours =
      (Date.now() - new Date(session.start_time).getTime()) / (1000 * 60 * 60);
    const energyConsumed = durationInHours * session.connector.power; // kWh
    const totalCost = energyConsumed * 100; // Assuming 100〒 per kWh

    // Update with calculated values
    await pool.query(
      "UPDATE charging_sessions SET energy_consumed = $1, total_cost = $2 WHERE id = $3",
      [energyConsumed, totalCost, session.id],
    );

    // Create history record
    await pool.query(
      "INSERT INTO charging_history (session_id, connector_id, user_id, transaction_id, start_time, end_time, energy_consumed, total_cost, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
      [
        session.id,
        session.connector_id,
        session.user_id,
        session.transaction_id,
        session.start_time,
        session.end_time,
        energyConsumed,
        totalCost,
        session.status,
        session.created_at,
      ],
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error stopping charging session:", error);
    res.status(500).json({ error: "Failed to stop charging session" });
  }
});

//emailchik validationchik)
app.post("/api/request-verification", async (req, res) => {
  const { email } = req.body;

  try {
    // Find user by email
    const {
      rows: [user],
    } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate 4-digit verification code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiration = new Date();
    expiration.setMinutes(expiration.getMinutes() + 10); // 10-minute expiration

    // Update user with verification code
    await pool.query(
      `
      UPDATE users 
      SET verification_code = $1, 
          code_expiration = $2
      WHERE id = $3
    `,
      [verificationCode, expiration, user.id],
    );

    // Send email with verification code
    await sendVerificationEmail(email, verificationCode);

    res.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    console.error("Error sending verification code:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

app.post("/api/verify-code", async (req, res) => {
  const { email, code } = req.body;

  try {
    // Find user by email
    const {
      rows: [user],
    } = await pool.query(
      `
      SELECT * FROM users 
      WHERE email = $1 
      AND verification_code = $2 
      AND code_expiration > NOW()
    `,
      [email, code],
    );

    if (!user) {
      return res.status(401).json({ error: "Invalid verification code" });
    }

    // Clear verification code after use
    await pool.query(
      `
      UPDATE users 
      SET verification_code = NULL, 
          code_expiration = NULL,
          email_verified = TRUE
      WHERE id = $1
    `,
      [user.id],
    );

    // Create token
    const token = createToken(user);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Error verifying code:", err);
    res.status(500).json({ error: "Failed to verify code" });
  }
});

async function getActiveTransactionId(connectorId) {
  try {
    const { rows } = await pool.query(
      "SELECT transaction_id FROM charging_sessions WHERE connector_id = $1 AND status = $2",
      [connectorId, "in use"],
    );
    return rows.length > 0 ? rows[0].transaction_id : null;
  } catch (error) {
    console.error("Error fetching active transaction ID:", error);
    return null;
  }
}

app.get("/api/user-balance/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT balance FROM user_balances WHERE user_id = $1",
      [userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User balance not found" });
    }

    res.json({ balance: rows[0].balance });
  } catch (err) {
    console.error("Error fetching user balance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/top-up-balance", async (req, res) => {
  const { userId, amount } = req.body;
  console.log(
    `Received top-up request for user ${userId} with amount ${amount}`,
  );

  if (!userId || !amount) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  if (amount <= 0) {
    return res
      .status(400)
      .json({ success: false, error: "Amount must be positive" });
  }

  try {
    await pool.query("BEGIN");

    try {
      const { rows } = await pool.query(
        `
        INSERT INTO user_balances (user_id, balance)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET
          balance = user_balances.balance + EXCLUDED.balance,
          last_updated = NOW()
        RETURNING balance
      `,
        [userId, amount],
      );

      await pool.query("COMMIT");

      res.json({ success: true, data: { balance: rows[0].balance } });
    } catch (error) {
      await pool.query("ROLLBACK");
      console.error("Error during balance update:", error);
      res.status(500).json({
        success: false,
        error: "Server error",
        details: error.message,
      });
    }
  } catch (err) {
    console.error("Error topping up balance:", err);
    res
      .status(500)
      .json({ success: false, error: "Server error", details: err.message });
  }
});

app.post("/api/update-balance", async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || !amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Start a transaction
    await pool.query("BEGIN");

    try {
      // Update the user balance
      const { rows } = await pool.query(
        `
        INSERT INTO user_balances (user_id, balance)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET
          balance = user_balances.balance + EXCLUDED.balance,
          last_updated = NOW()
        RETURNING balance
      `,
        [userId, amount],
      );

      // Commit the transaction
      await pool.query("COMMIT");

      res.json({ balance: rows[0].balance });
    } catch (error) {
      // Rollback the transaction on error
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (err) {
    console.error("Error updating user balance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/deduct-balance", async (req, res) => {
  const { userId, cost } = req.body;

  if (!userId || !cost) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Start a transaction
    await pool.query("BEGIN");

    try {
      // Check if the user has sufficient balance
      const { rows } = await pool.query(
        "SELECT balance FROM user_balances WHERE user_id = $1 FOR UPDATE",
        [userId],
      );

      if (rows.length === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "User balance not found" });
      }

      const currentBalance = rows[0].balance;

      if (currentBalance < cost) {
        await pool.query("ROLLBACK");
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Deduct the charging cost
      await pool.query(
        `
        UPDATE user_balances
        SET balance = balance - $1, last_updated = NOW()
        WHERE user_id = $2
        RETURNING balance
      `,
        [cost, userId],
      );

      // Commit the transaction
      await pool.query("COMMIT");

      res.json({ success: true });
    } catch (error) {
      // Rollback the transaction on error
      await pool.query("ROLLBACK");
      throw error;
    }
  } catch (err) {
    console.error("Error deducting balance:", err);
    res.status(500).json({ error: "Server error" });
  }
});

//charging historyyyyyy

// Add charge history entry
app.post("/api/add-charge-history", async (req, res) => {
  const { userId, session_id, connectorId, energyConsumed, totalCost } =
    req.body;

  if (!userId || !connectorId || !energyConsumed || !totalCost) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO charge_history (
        user_id,
        session_id,
        connector_id,
        start_time,
        end_time,
        energy_consumed,
        total_cost
      )
      SELECT
        $1,
        $2,
        $3,
        cs.start_time,
        NOW(),
        $4,
        $5
      FROM charging_sessions cs
      WHERE cs.id = $2 AND cs.user_id = $1
      RETURNING *
      `,
      [userId, session_id, connectorId, energyConsumed, totalCost],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Charging session not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error adding charge history:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get charge history for user
app.get("/api/charge-history/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ch.id,
        ch.start_time,
        ch.end_time,
        ch.energy_consumed,
        ch.total_cost,
        c.station_id,
        s.location_id,
        l.name AS location_name
      FROM charge_history ch
      JOIN connectors c ON ch.connector_id = c.id
      JOIN stations s ON c.station_id = s.id
      JOIN locations l ON s.location_id = l.id
      WHERE ch.user_id = $1
      ORDER BY ch.start_time DESC
      `,
      [userId],
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching charge history:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get detailed charge history entry
app.get("/api/charge-history-detail/:historyId", async (req, res) => {
  const { historyId } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ch.*,
        c.station_id,
        s.location_id,
        l.name AS location_name
      FROM charge_history ch
      JOIN connectors c ON ch.connector_id = c.id
      JOIN stations s ON c.station_id = s.id
      JOIN locations l ON s.location_id = l.id
      WHERE ch.id = $1
      `,
      [historyId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "History entry not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching charge history detail:", err);
    res.status(500).json({ error: "Server error" });
  }
});

async function deleteExpiredReservations() {
  try {
    await pool.query(`
      DELETE FROM reservations
      WHERE 
        to_timestamp(
          to_char(current_date, 'YYYY-MM-DD') || ' ' || arrival_time,
          'YYYY-MM-DD HH24:MI:SS'
        ) + INTERVAL '5 minutes' < NOW()
        AND id NOT IN (
          SELECT r.id
          FROM reservations r
          JOIN charging_sessions cs ON r.connector_id = cs.connector_id
          WHERE cs.user_id = r.user_id
            AND cs.status = 'in use'
            AND cs.start_time BETWEEN to_timestamp(
              to_char(current_date, 'YYYY-MM-DD') || ' ' || r.arrival_time,
              'YYYY-MM-DD HH24:MI:SS'
            ) AND to_timestamp(
              to_char(current_date, 'YYYY-MM-DD') || ' ' || r.arrival_time,
              'YYYY-MM-DD HH24:MI:SS'
            ) + INTERVAL '5 minutes'
        )
    `);
  } catch (error) {
    console.error("Error deleting expired reservations:", error);
  }
}

// Run every minute
setInterval(deleteExpiredReservations, 60000);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Initialize OCPP WebSocket server
wss = setupOcppServer(server);
