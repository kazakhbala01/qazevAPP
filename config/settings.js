require("dotenv").config();

module.exports = {
  API_PORT: 8000,
  OCPP_PORT: 9000,
  DB_URL:
    process.env.DB_URL || "postgresql://postgres:Almasik0410@localhost/qazev",
};
