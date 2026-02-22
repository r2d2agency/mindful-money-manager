const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM psychologists ORDER BY created_at DESC");
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone,
      specialty: r.specialty, sessionRate: parseFloat(r.session_rate), createdAt: r.created_at,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, specialty, sessionRate } = req.body;
    const result = await pool.query(
      "INSERT INTO psychologists (name, email, phone, specialty, session_rate) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, email || "", phone || "", specialty || "", sessionRate || 0]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, name: r.name, email: r.email, phone: r.phone, specialty: r.specialty, sessionRate: parseFloat(r.session_rate), createdAt: r.created_at });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, specialty, sessionRate } = req.body;
    const result = await pool.query(
      "UPDATE psychologists SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), specialty=COALESCE($4,specialty), session_rate=COALESCE($5,session_rate) WHERE id=$6 RETURNING *",
      [name, email, phone, specialty, sessionRate, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const r = result.rows[0];
    res.json({ id: r.id, name: r.name, email: r.email, phone: r.phone, specialty: r.specialty, sessionRate: parseFloat(r.session_rate), createdAt: r.created_at });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM psychologists WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
