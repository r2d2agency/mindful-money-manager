const express = require("express");
const { pool } = require("../db");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM bank_accounts WHERE user_id = $1 ORDER BY name", [req.user.id]);
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, balance: parseFloat(r.balance), type: r.type,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/", async (req, res) => {
  try {
    const { name, balance, type } = req.body;
    const result = await pool.query(
      "INSERT INTO bank_accounts (user_id, name, balance, type) VALUES ($1,$2,$3,$4) RETURNING *",
      [req.user.id, name, balance || 0, type || "checking"]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, name: r.name, balance: parseFloat(r.balance), type: r.type });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.put("/:id", async (req, res) => {
  try {
    const { name, balance, type } = req.body;
    const result = await pool.query(
      "UPDATE bank_accounts SET name=COALESCE($1,name), balance=COALESCE($2,balance), type=COALESCE($3,type) WHERE id=$4 AND user_id=$5 RETURNING *",
      [name, balance, type, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const r = result.rows[0];
    res.json({ id: r.id, name: r.name, balance: parseFloat(r.balance), type: r.type });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM bank_accounts WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
