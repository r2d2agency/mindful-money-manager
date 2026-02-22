const express = require("express");
const { pool } = require("../db");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await pool.query("SELECT * FROM sessions ORDER BY date DESC");
    } else {
      result = await pool.query("SELECT * FROM sessions WHERE psychologist_id = $1 ORDER BY date DESC", [req.user.psychologistId]);
    }
    res.json(result.rows.map(r => ({
      id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id, date: r.date,
      time: r.time || "", duration: r.duration || 50,
      status: r.status, paymentStatus: r.payment_status, expectedAmount: parseFloat(r.expected_amount),
      paidAmount: parseFloat(r.paid_amount), isRecurring: r.is_recurring,
      recurringPlanId: r.recurring_plan_id || null, invoiceId: r.invoice_id || null, notes: r.notes,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/", async (req, res) => {
  try {
    const { patientId, psychologistId, date, time, duration, status, paymentStatus, expectedAmount, paidAmount, isRecurring, notes } = req.body;
    const psyId = req.user.role === "psychologist" ? req.user.psychologistId : psychologistId;
    const result = await pool.query(
      "INSERT INTO sessions (patient_id, psychologist_id, date, time, duration, status, payment_status, expected_amount, paid_amount, is_recurring, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *",
      [patientId, psyId || null, date, time || "", duration || 50, status || "scheduled", paymentStatus || "pending", expectedAmount || 0, paidAmount || 0, isRecurring || false, notes || ""]
    );
    const r = result.rows[0];
    res.status(201).json({
      id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id, date: r.date,
      time: r.time || "", duration: r.duration || 50,
      status: r.status, paymentStatus: r.payment_status, expectedAmount: parseFloat(r.expected_amount),
      paidAmount: parseFloat(r.paid_amount), isRecurring: r.is_recurring,
      recurringPlanId: r.recurring_plan_id || null, invoiceId: r.invoice_id || null, notes: r.notes,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.put("/:id", async (req, res) => {
  try {
    const { status, paymentStatus, paidAmount, notes, expectedAmount, time, duration } = req.body;
    const result = await pool.query(
      "UPDATE sessions SET status=COALESCE($1,status), payment_status=COALESCE($2,payment_status), paid_amount=COALESCE($3,paid_amount), notes=COALESCE($4,notes), expected_amount=COALESCE($5,expected_amount), time=COALESCE($6,time), duration=COALESCE($7,duration) WHERE id=$8 RETURNING *",
      [status, paymentStatus, paidAmount, notes, expectedAmount, time, duration, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    const r = result.rows[0];
    res.json({
      id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id, date: r.date,
      time: r.time || "", duration: r.duration || 50,
      status: r.status, paymentStatus: r.payment_status, expectedAmount: parseFloat(r.expected_amount),
      paidAmount: parseFloat(r.paid_amount), isRecurring: r.is_recurring,
      recurringPlanId: r.recurring_plan_id || null, invoiceId: r.invoice_id || null, notes: r.notes,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM sessions WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
