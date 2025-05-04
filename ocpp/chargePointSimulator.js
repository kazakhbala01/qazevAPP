// chargePointSimulator.js
import WebSocket from "ws";

const ocppServerUrl = "ws://localhost:5000";
const chargePointId = "CP001";

const ws = new WebSocket(ocppServerUrl, ["ocpp1.6"]);

function sendCall(action, payload) {
  const messageId = Math.random().toString(36).substr(2, 9);
  const callMessage = JSON.stringify([2, messageId, action, payload]);
  console.log(`Sending ${action}:`, callMessage);
  ws.send(callMessage);
}

ws.on("open", () => {
  console.log("Connected to OCPP server");
  sendCall("BootNotification", {
    chargePointVendor: "Simulator",
    chargePointModel: "TestModel",
  });
});

ws.on("message", (data) => {
  const message = JSON.parse(data);
  console.log("Received OCPP message:", message);

  if (message[2] === "RemoteStartTransaction") {
    console.log("Starting transaction...");
    setTimeout(() => {
      sendCall("StartTransaction", {
        connectorId: 1,
        idTag: message[3].idTag,
        meterStart: 0,
        timestamp: new Date().toISOString(),
      });
    }, 1000);
  } else if (message[2] === "RemoteStopTransaction") {
    console.log("Stopping transaction...");
    setTimeout(() => {
      sendCall("StopTransaction", {
        transactionId: message[3].transactionId,
        meterStop: 1000,
        timestamp: new Date().toISOString(),
      });
    }, 1000);
  } else if (message[2] === "StatusNotification") {
    console.log("StatusNotification received");
  } else if (message[2] === "StartTransaction") {
    console.log("StartTransaction received");
  } else if (message[2] === "StopTransaction") {
    console.log("StopTransaction received");
  }
});

ws.on("close", () => {
  console.log("Disconnected from OCPP server");
});

ws.on("error", (error) => {
  console.error("WebSocket error:", error);
});
