const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

// Public: anyone logged in can read settings (to apply branding)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM app_settings");
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Admin only: update settings
router.put("/", requireAdmin, async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2`,
        [key, value]
      );
    }
    const result = await pool.query("SELECT key, value FROM app_settings");
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
