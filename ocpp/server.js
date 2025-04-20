const WebSocket = require("ws");
const ChargePoint = require("./chargePoint");
const { OCPP_PORT } = require("../config/settings");

const server = new WebSocket.Server({ port: OCPP_PORT });

server.on("connection", (socket, req) => {
  const chargePointId = req.url.replace("/", ""); // Extract charge point ID from URL
  const chargePoint = new ChargePoint(chargePointId, socket);
});

console.log(`🔌 OCPP Server running on ws://localhost:${OCPP_PORT}`);
