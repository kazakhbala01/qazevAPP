const { Pool } = require("pg");
const { DB_URL } = require("../config/settings");

const pool = new Pool({ connectionString: DB_URL });

const createTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS charging_sessions (
      id SERIAL PRIMARY KEY,
      charge_point_id TEXT,
      transaction_id INT,
      user_id TEXT,
      start_time TIMESTAMP,
      stop_time TIMESTAMP,
      energy_consumed FLOAT
    );
  `);
};

module.exports = { pool, createTable };
