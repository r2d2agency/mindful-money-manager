const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "psifinance-secret-change-me";

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Token não fornecido" });

  const token = header.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: "Token inválido" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Acesso negado" });
  next();
}

module.exports = { authenticate, requireAdmin, JWT_SECRET };
