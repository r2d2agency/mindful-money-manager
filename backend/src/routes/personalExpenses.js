const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// Personal expenses are per-user
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM personal_expenses WHERE user_id = $1 ORDER BY date DESC NULLS LAST, created_at DESC", [req.user.id]);
    res.json(result.rows.map(r => ({
      id: r.id, description: r.description, amount: parseFloat(r.amount), category: r.category,
      date: r.date, type: r.type, paymentMethod: r.payment_method, paid: r.paid,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/", async (req, res) => {
  try {
    const { description, amount, category, date, type, paymentMethod, paid } = req.body;
    const result = await pool.query(
      "INSERT INTO personal_expenses (user_id, description, amount, category, date, type, payment_method, paid) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [req.user.id, description, amount, category || "", date || null, type || "expense", paymentMethod || "", paid || false]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, description: r.description, amount: parseFloat(r.amount), category: r.category, date: r.date, type: r.type, paymentMethod: r.payment_method, paid: r.paid });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.put("/:id", async (req, res) => {
  try {
    const { description, amount, category, date, type, paymentMethod, paid } = req.body;
    const result = await pool.query(
      "UPDATE personal_expenses SET description=COALESCE($1,description), amount=COALESCE($2,amount), category=COALESCE($3,category), date=COALESCE($4,date), type=COALESCE($5,type), payment_method=COALESCE($6,payment_method), paid=COALESCE($7,paid) WHERE id=$8 AND user_id=$9 RETURNING *",
      [description, amount, category, date, type, paymentMethod, paid, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const r = result.rows[0];
    res.json({ id: r.id, description: r.description, amount: parseFloat(r.amount), category: r.category, date: r.date, type: r.type, paymentMethod: r.payment_method, paid: r.paid });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM personal_expenses WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
