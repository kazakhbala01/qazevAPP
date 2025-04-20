const { pool } = require("../models/chargingSession");

const getStations = async () => {
  const result = await pool.query(
    "SELECT charge_point_id, status FROM station_status",
  );
  return result.rows;
};

module.exports = { getStations };
