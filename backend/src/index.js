const express = require("express");
const cors = require("cors");
const { pool } = require("./db");
const authRoutes = require("./routes/auth");
const patientsRoutes = require("./routes/patients");
const psychologistsRoutes = require("./routes/psychologists");
const sessionsRoutes = require("./routes/sessions");
const personalExpensesRoutes = require("./routes/personalExpenses");
const bankAccountsRoutes = require("./routes/bankAccounts");
const usersRoutes = require("./routes/users");
const { authenticate } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", authenticate, patientsRoutes);
app.use("/api/psychologists", authenticate, psychologistsRoutes);
app.use("/api/sessions", authenticate, sessionsRoutes);
app.use("/api/personal-expenses", authenticate, personalExpensesRoutes);
app.use("/api/bank-accounts", authenticate, bankAccountsRoutes);
app.use("/api/users", authenticate, usersRoutes);

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
