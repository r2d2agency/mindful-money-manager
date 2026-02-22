const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// GET - list (psychologist sees only their patients)
router.get("/", async (req, res) => {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await pool.query("SELECT * FROM patients ORDER BY created_at DESC");
    } else {
      result = await pool.query("SELECT * FROM patients WHERE psychologist_id = $1 ORDER BY created_at DESC", [req.user.psychologistId]);
    }
    const patients = result.rows.map(r => ({
      id: r.id, name: r.name, email: r.email, phone: r.phone,
      psychologistId: r.psychologist_id, notes: r.notes, createdAt: r.created_at,
    }));
    res.json(patients);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// POST
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, psychologistId, notes } = req.body;
    const psyId = req.user.role === "psychologist" ? req.user.psychologistId : psychologistId;
    const result = await pool.query(
      "INSERT INTO patients (name, email, phone, psychologist_id, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, email || "", phone || "", psyId || null, notes || ""]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, name: r.name, email: r.email, phone: r.phone, psychologistId: r.psychologist_id, notes: r.notes, createdAt: r.created_at });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// PUT
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, psychologistId, notes } = req.body;
    const result = await pool.query(
      "UPDATE patients SET name=COALESCE($1,name), email=COALESCE($2,email), phone=COALESCE($3,phone), psychologist_id=COALESCE($4,psychologist_id), notes=COALESCE($5,notes) WHERE id=$6 RETURNING *",
      [name, email, phone, psychologistId || null, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const r = result.rows[0];
    res.json({ id: r.id, name: r.name, email: r.email, phone: r.phone, psychologistId: r.psychologist_id, notes: r.notes, createdAt: r.created_at });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM patients WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
