const express = require("express");
const { getStations } = require("./database");

const router = express.Router();

router.get("/stations", async (req, res) => {
  try {
    const stations = await getStations();
    res.json(stations);
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
