import WebSocket from "ws";

const ocppServerUrl = "ws://localhost:5000"; // Your server URL
const chargePointId = "CP001";
const ws = new WebSocket(ocppServerUrl, ["ocpp1.6"]);

function sendCall(action, payload) {
  const messageId = Math.random().toString(36).substr(2, 9);
  const callMessage = JSON.stringify([2, messageId, action, payload]);
  console.log(`Sending ${action}:`, callMessage);
  ws.send(callMessage);
}

let transactionId = null;
let meterValue = 0;
let activeConnectorId = null;

ws.on("open", () => {
  console.log("Connected to OCPP server");

  // Boot Notification
  sendCall("BootNotification", {
    chargePointVendor: "Simulator",
    chargePointModel: "TestModel",
  });
});

ws.on("message", (data) => {
  const message = JSON.parse(data);
  console.log("Received OCPP message:", message);

  if (message[2] === "RemoteStartTransaction") {
    const {
      connectorId,
      idTag,
      transactionId: incomingTransactionId,
    } = message[3];

    // Accept transaction
    transactionId = incomingTransactionId || `TXN-${Date.now()}`;
    activeConnectorId = connectorId;

    // Send StartTransaction response
    ws.send(
      JSON.stringify([
        3,
        message[1],
        {
          transactionId,
          idTagInfo: { status: "Accepted" },
        },
      ]),
    );
    console.log(
      `OCPP: RemoteStartTransaction accepted for connector ${connectorId}`,
    );

    // Start metering simulation
    startChargingSimulation();
  }

  if (message[2] === "RemoteStopTransaction") {
    const { transactionId: incomingTransactionId } = message[3];

    // Send StopTransaction response
    ws.send(
      JSON.stringify([
        3,
        message[1],
        {
          idTagInfo: { status: "Accepted" },
        },
      ]),
    );
    console.log(
      `OCPP: RemoteStopTransaction accepted for transaction ${incomingTransactionId}`,
    );

    // Stop metering simulation
    if (meterInterval) clearInterval(meterInterval);
    activeConnectorId = null;
  }
});

// Simulate charging progress
let meterInterval = null;

function startChargingSimulation() {
  meterInterval = setInterval(() => {
    meterValue += 0.1; // Simulate energy increase

    ws.send(
      JSON.stringify([
        2,
        "meterUpdate",
        "MeterValues",
        {
          connectorId: activeConnectorId,
          meterValue: meterValue.toFixed(2),
        },
      ]),
    );
  }, 1000);
}

ws.on("close", () => {
  console.log("Disconnected from OCPP server");
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});
