const express = require("express");
const router = require("./routes");
const { API_PORT } = require("../config/settings");

const app = express();
app.use(express.json());
app.use("/api", router);

app.listen(API_PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${API_PORT}`);
});
