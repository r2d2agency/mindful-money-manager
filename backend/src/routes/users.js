const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, name, role, psychologist_id, created_at FROM users ORDER BY created_at DESC");
    res.json(result.rows.map(r => ({
      id: r.id, email: r.email, name: r.name, role: r.role, psychologistId: r.psychologist_id,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role, psychologistId } = req.body;
    if (!email || !password || !name || !role) return res.status(400).json({ message: "Campos obrigatórios" });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, name, role, psychologist_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role, psychologist_id",
      [email, hash, name, role, psychologistId || null]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, email: r.email, name: r.name, role: r.role, psychologistId: r.psychologist_id });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "Email já cadastrado" });
    console.error(err); res.status(500).json({ message: "Erro interno" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: "Não pode deletar a si mesmo" });
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
