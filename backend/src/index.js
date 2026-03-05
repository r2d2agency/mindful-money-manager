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
const recurringPlansRoutes = require("./routes/recurringPlans");
const invoicesRoutes = require("./routes/invoices");
const categoriesRoutes = require("./routes/categories");
const settingsRoutes = require("./routes/settings");
const whatsappRoutes = require("./routes/whatsapp");
const { authenticate } = require("./middleware/auth");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

// Handle all OPTIONS preflight requests
app.options("*", cors());

app.use(express.json({ limit: "50mb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/auth", authRoutes);
app.use("/api/patients", authenticate, patientsRoutes);
app.use("/api/psychologists", authenticate, psychologistsRoutes);
app.use("/api/sessions", authenticate, sessionsRoutes);
app.use("/api/personal-expenses", authenticate, personalExpensesRoutes);
app.use("/api/bank-accounts", authenticate, bankAccountsRoutes);
app.use("/api/users", authenticate, usersRoutes);
app.use("/api/recurring-plans", authenticate, recurringPlansRoutes);
app.use("/api/invoices", authenticate, invoicesRoutes);
app.use("/api/categories", authenticate, categoriesRoutes);
app.use("/api/settings", authenticate, settingsRoutes);
app.use("/api/whatsapp", authenticate, whatsappRoutes);

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
