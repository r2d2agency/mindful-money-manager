const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// List recurring plans
router.get("/", async (req, res) => {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await pool.query("SELECT * FROM recurring_plans ORDER BY day_of_week, time");
    } else {
      result = await pool.query("SELECT * FROM recurring_plans WHERE psychologist_id = $1 ORDER BY day_of_week, time", [req.user.psychologistId]);
    }
    res.json(result.rows.map(r => ({
      id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id,
      dayOfWeek: r.day_of_week, time: r.time, amount: parseFloat(r.amount), active: r.active,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Create recurring plan
router.post("/", async (req, res) => {
  try {
    const { patientId, psychologistId, dayOfWeek, time, amount } = req.body;
    const psyId = req.user.role === "psychologist" ? req.user.psychologistId : psychologistId;
    const result = await pool.query(
      "INSERT INTO recurring_plans (patient_id, psychologist_id, day_of_week, time, amount) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [patientId, psyId, dayOfWeek, time, amount || 0]
    );
    const r = result.rows[0];
    res.status(201).json({
      id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id,
      dayOfWeek: r.day_of_week, time: r.time, amount: parseFloat(r.amount), active: r.active,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Generate sessions from a recurring plan
router.post("/:id/generate", async (req, res) => {
  try {
    const { weeks } = req.body;
    const numWeeks = weeks || 4;

    const planResult = await pool.query("SELECT * FROM recurring_plans WHERE id = $1", [req.params.id]);
    if (planResult.rows.length === 0) return res.status(404).json({ message: "Plano não encontrado" });

    const plan = planResult.rows[0];
    const sessions = [];
    const today = new Date();

    for (let w = 0; w < numWeeks; w++) {
      const targetDate = new Date(today);
      const currentDay = today.getDay();
      let daysUntil = plan.day_of_week - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && w === 0) daysUntil = 0;
      targetDate.setDate(today.getDate() + daysUntil + (w * 7));

      const dateStr = targetDate.toISOString().split("T")[0];

      // Check if session already exists for this date and patient
      const existing = await pool.query(
        "SELECT id FROM sessions WHERE patient_id = $1 AND date = $2 AND recurring_plan_id = $3",
        [plan.patient_id, dateStr, plan.id]
      );

      if (existing.rows.length === 0) {
        const result = await pool.query(
          "INSERT INTO sessions (patient_id, psychologist_id, date, status, payment_status, expected_amount, paid_amount, is_recurring, recurring_plan_id, notes) VALUES ($1,$2,$3,'scheduled','pending',$4,0,true,$5,'') RETURNING *",
          [plan.patient_id, plan.psychologist_id, dateStr, plan.amount, plan.id]
        );
        const r = result.rows[0];
        sessions.push({
          id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id, date: r.date,
          status: r.status, paymentStatus: r.payment_status, expectedAmount: parseFloat(r.expected_amount),
          paidAmount: parseFloat(r.paid_amount), isRecurring: r.is_recurring, recurringPlanId: r.recurring_plan_id, notes: r.notes,
        });
      }
    }

    res.status(201).json(sessions);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Delete recurring plan
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM recurring_plans WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
