const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, name, role, psychologist_id, created_at FROM users ORDER BY created_at DESC");
    res.json(result.rows.map(r => ({
      id: r.id, email: r.email, name: r.name, role: r.role, psychologistId: r.psychologist_id, createdAt: r.created_at,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { email, password, name, role, psychologistId } = req.body;
    if (!email || !password || !name || !role) return res.status(400).json({ message: "Campos obrigatórios" });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, name, role, psychologist_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, email, name, role, psychologist_id, created_at",
      [email, hash, name, role, psychologistId || null]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, email: r.email, name: r.name, role: r.role, psychologistId: r.psychologist_id, createdAt: r.created_at });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "Email já cadastrado" });
    console.error(err); res.status(500).json({ message: "Erro interno" });
  }
});

// Update user (name, email, role, psychologistId)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { name, email, role, psychologistId } = req.body;
    const result = await pool.query(
      "UPDATE users SET name=COALESCE($1,name), email=COALESCE($2,email), role=COALESCE($3,role), psychologist_id=$4 WHERE id=$5 RETURNING id, email, name, role, psychologist_id, created_at",
      [name, email, role, psychologistId || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const r = result.rows[0];
    res.json({ id: r.id, email: r.email, name: r.name, role: r.role, psychologistId: r.psychologist_id, createdAt: r.created_at });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "Email já cadastrado" });
    console.error(err); res.status(500).json({ message: "Erro interno" });
  }
});

// Reset password
router.put("/:id/password", requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ message: "Senha deve ter pelo menos 4 caracteres" });
    const hash = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, req.params.id]);
    res.json({ message: "Senha atualizada" });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ message: "Não pode deletar a si mesmo" });
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
