const WebSocket = require("ws");
const { pool } = require("../models/chargingSession");

class ChargePoint {
  constructor(id, socket) {
    this.id = id;
    this.socket = socket;
    this.setupListeners();
  }

  setupListeners() {
    this.socket.on("message", async (message) => {
      const [messageTypeId, uniqueId, action, payload] = JSON.parse(message);

      if (action === "BootNotification") {
        console.log(`BootNotification received from ${this.id}`);

        const response = [
          3,
          uniqueId,
          {
            status: "Accepted",
            currentTime: new Date().toISOString(),
            interval: 10,
          },
        ];
        this.socket.send(JSON.stringify(response));
      }

      if (action === "StartTransaction") {
        const { connectorId, idTag, meterStart, timestamp } = payload;
        const transactionId = Math.floor(Math.random() * 100000);

        await pool.query(
          "INSERT INTO charging_sessions (charge_point_id, transaction_id, user_id, start_time) VALUES ($1, $2, $3, $4)",
          [this.id, transactionId, idTag, timestamp],
        );

        const response = [
          3,
          uniqueId,
          { transactionId, idTagInfo: { status: "Accepted" } },
        ];
        this.socket.send(JSON.stringify(response));
      }
    });
  }
}

module.exports = ChargePoint;
