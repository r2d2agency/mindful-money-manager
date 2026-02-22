const bcrypt = require("bcryptjs");
const { pool } = require("./db");

async function seed() {
  const hash = await bcrypt.hash("admin123", 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING`,
    ["admin@psifinance.com", hash, "Administrador", "admin"]
  );
  console.log("Admin criado: admin@psifinance.com / admin123");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
