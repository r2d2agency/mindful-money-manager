const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// List invoices
router.get("/", async (req, res) => {
  try {
    let result;
    if (req.user.role === "admin") {
      result = await pool.query("SELECT * FROM invoices ORDER BY date DESC");
    } else {
      result = await pool.query("SELECT * FROM invoices WHERE psychologist_id = $1 ORDER BY date DESC", [req.user.psychologistId]);
    }
    res.json(result.rows.map(r => ({
      id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id,
      amount: parseFloat(r.amount), date: r.date, sessionIds: r.session_ids || [],
      notes: r.notes || "", fileData: r.file_data || "", fileName: r.file_name || "",
      createdAt: r.created_at,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Create invoice
router.post("/", async (req, res) => {
  try {
    const { patientId, psychologistId, amount, date, sessionIds, notes, fileData, fileName } = req.body;
    const psyId = req.user.role === "psychologist" ? req.user.psychologistId : psychologistId;

    const result = await pool.query(
      "INSERT INTO invoices (patient_id, psychologist_id, amount, date, session_ids, notes, file_data, file_name) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [patientId, psyId, amount, date, JSON.stringify(sessionIds || []), notes || "", fileData || "", fileName || ""]
    );

    // Mark linked sessions as paid
    if (sessionIds && sessionIds.length > 0) {
      for (const sid of sessionIds) {
        await pool.query(
          "UPDATE sessions SET payment_status = 'paid', paid_amount = expected_amount, invoice_id = $1 WHERE id = $2",
          [result.rows[0].id, sid]
        );
      }
    }

    const r = result.rows[0];
    res.status(201).json({
      id: r.id, patientId: r.patient_id, psychologistId: r.psychologist_id,
      amount: parseFloat(r.amount), date: r.date, sessionIds: r.session_ids || [],
      notes: r.notes || "", fileData: r.file_data || "", fileName: r.file_name || "",
      createdAt: r.created_at,
    });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Delete invoice
router.delete("/:id", async (req, res) => {
  try {
    // Unlink sessions
    await pool.query("UPDATE sessions SET invoice_id = NULL, payment_status = 'pending' WHERE invoice_id = $1", [req.params.id]);
    await pool.query("DELETE FROM invoices WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
