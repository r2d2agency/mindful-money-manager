const express = require("express");
const { pool } = require("../db");
const router = express.Router();

// List categories for the user
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM categories WHERE user_id = $1 OR is_default = true ORDER BY is_default DESC, name ASC",
      [req.user.id]
    );
    res.json(result.rows.map(r => ({
      id: r.id, name: r.name, type: r.type, isDefault: r.is_default, userId: r.user_id,
    })));
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Create custom category
router.post("/", async (req, res) => {
  try {
    const { name, type } = req.body;
    if (!name) return res.status(400).json({ message: "Nome é obrigatório" });
    const result = await pool.query(
      "INSERT INTO categories (name, type, user_id, is_default) VALUES ($1, $2, $3, false) RETURNING *",
      [name, type || "expense", req.user.id]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, name: r.name, type: r.type, isDefault: r.is_default, userId: r.user_id });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Delete custom category (only non-default)
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Não encontrado" });
    if (result.rows[0].is_default) return res.status(400).json({ message: "Categorias padrão não podem ser removidas" });
    if (result.rows[0].user_id !== req.user.id) return res.status(403).json({ message: "Sem permissão" });
    await pool.query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    res.status(204).send();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
