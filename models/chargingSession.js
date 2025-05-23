// models/chargingSession.js
const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config();

// Create a PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || "5432", 10),
});

// Example query function for charging sessions
async function getChargingSession(transactionId) {
  const result = await pool.query(
    "SELECT * FROM charging_sessions WHERE transaction_id = $1",
    [transactionId],
  );
  return result.rows[0];
}

// Export the pool and any helper functions
module.exports = { pool, getChargingSession };
