const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

const WAPI_BASE = "https://api.w-api.app/v1";

// ===== INSTANCES =====

// Create instance via integrator API
router.post("/instances", requireAdmin, async (req, res) => {
  try {
    const { instanceName, globalToken, rejectCalls, callMessage } = req.body;
    if (!instanceName || !globalToken) return res.status(400).json({ message: "instanceName e globalToken são obrigatórios" });

    const wapiRes = await fetch(`${WAPI_BASE}/integrator/create-instance`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${globalToken}` },
      body: JSON.stringify({ instanceName, rejectCalls: rejectCalls || false, callMessage: callMessage || "" }),
    });
    const wapiData = await wapiRes.json();

    if (wapiData.error) return res.status(400).json({ message: wapiData.message || "Erro ao criar instância na W-API" });

    const result = await pool.query(
      `INSERT INTO whatsapp_instances (instance_name, instance_id, token, global_token, status)
       VALUES ($1, $2, $3, $4, 'disconnected') RETURNING *`,
      [instanceName, wapiData.instanceId, wapiData.token, globalToken]
    );

    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// List instances
router.get("/instances", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, instance_name, instance_id, status, connected_phone, created_at FROM whatsapp_instances ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Delete instance
router.delete("/instances/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Get QR Code
router.get("/instances/:id/qrcode", requireAdmin, async (req, res) => {
  try {
    const inst = await pool.query("SELECT instance_id, token FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    const { instance_id, token } = inst.rows[0];

    const wapiRes = await fetch(`${WAPI_BASE}/instance/qr-code?instanceId=${instance_id}&image=disable`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await wapiRes.json();

    if (data.error === false && data.qrcode) {
      await pool.query("UPDATE whatsapp_instances SET status = 'pending' WHERE id = $1", [req.params.id]);
    }

    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Check instance status
router.get("/instances/:id/status", async (req, res) => {
  try {
    const inst = await pool.query("SELECT instance_id, token FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    const { instance_id, token } = inst.rows[0];

    const wapiRes = await fetch(`${WAPI_BASE}/instance/status?instanceId=${instance_id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await wapiRes.json();

    const isConnected = data.connected === true;
    await pool.query("UPDATE whatsapp_instances SET status = $1, connected_phone = $2 WHERE id = $3",
      [isConnected ? "connected" : "disconnected", data.connectedPhone || null, req.params.id]);

    res.json({ ...data, dbStatus: isConnected ? "connected" : "disconnected" });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== SEND MESSAGES =====
router.post("/send", async (req, res) => {
  try {
    const { instanceId, phone, message, type, mediaUrl, patientId, templateId } = req.body;
    if (!instanceId || !phone || !message) return res.status(400).json({ message: "instanceId, phone e message são obrigatórios" });

    const inst = await pool.query("SELECT instance_id, token, status FROM whatsapp_instances WHERE id = $1", [instanceId]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    if (inst.rows[0].status !== "connected") return res.status(400).json({ message: "Instância não conectada" });

    const { instance_id, token } = inst.rows[0];
    const msgType = type || "text";

    let endpoint, body;
    const cleanPhone = phone.replace(/\D/g, "");

    switch (msgType) {
      case "image":
        endpoint = "send-image";
        body = { phone: cleanPhone, image: mediaUrl, caption: message };
        break;
      case "audio":
        endpoint = "send-audio";
        body = { phone: cleanPhone, audio: mediaUrl };
        break;
      case "video":
        endpoint = "send-video";
        body = { phone: cleanPhone, video: mediaUrl, caption: message };
        break;
      case "document":
        endpoint = "send-document";
        body = { phone: cleanPhone, document: mediaUrl, fileName: "documento", caption: message };
        break;
      default:
        endpoint = "send-text";
        body = { phone: cleanPhone, message, delayMessage: 3 };
    }

    const wapiRes = await fetch(`${WAPI_BASE}/message/${endpoint}?instanceId=${instance_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await wapiRes.json();

    const logStatus = wapiRes.ok ? "sent" : "failed";
    const errorMsg = wapiRes.ok ? "" : (data.message || JSON.stringify(data));

    await pool.query(
      `INSERT INTO whatsapp_message_logs (patient_id, template_id, instance_id, phone, message, type, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [patientId || null, templateId || null, instanceId, cleanPhone, message, msgType, logStatus, errorMsg, logStatus === "sent" ? new Date() : null]
    );

    if (!wapiRes.ok) return res.status(400).json({ message: errorMsg, data });

    res.json({ success: true, data });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== TEMPLATES =====
router.get("/templates", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM whatsapp_templates ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/templates", requireAdmin, async (req, res) => {
  try {
    const { name, message, type, mediaUrl } = req.body;
    if (!name || !message) return res.status(400).json({ message: "name e message são obrigatórios" });
    const result = await pool.query(
      `INSERT INTO whatsapp_templates (name, message, type, media_url) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, message, type || "text", mediaUrl || ""]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.put("/templates/:id", requireAdmin, async (req, res) => {
  try {
    const { name, message, type, mediaUrl, active } = req.body;
    const result = await pool.query(
      `UPDATE whatsapp_templates SET name=COALESCE($1,name), message=COALESCE($2,message), type=COALESCE($3,type), media_url=COALESCE($4,media_url), active=COALESCE($5,active) WHERE id=$6 RETURNING *`,
      [name, message, type, mediaUrl, active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/templates/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM whatsapp_templates WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== MESSAGE LOGS =====
router.get("/logs", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, p.name as patient_name, t.name as template_name, i.instance_name
       FROM whatsapp_message_logs l
       LEFT JOIN patients p ON l.patient_id = p.id
       LEFT JOIN whatsapp_templates t ON l.template_id = t.id
       LEFT JOIN whatsapp_instances i ON l.instance_id = i.id
       ORDER BY l.created_at DESC LIMIT 500`
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Resend a failed message
router.post("/logs/:id/resend", async (req, res) => {
  try {
    const log = await pool.query("SELECT * FROM whatsapp_message_logs WHERE id = $1", [req.params.id]);
    if (!log.rows.length) return res.status(404).json({ message: "Log não encontrado" });

    const l = log.rows[0];
    const inst = await pool.query("SELECT instance_id, token, status FROM whatsapp_instances WHERE id = $1", [l.instance_id]);
    if (!inst.rows.length || inst.rows[0].status !== "connected") return res.status(400).json({ message: "Instância não conectada" });

    const { instance_id, token } = inst.rows[0];

    let endpoint, body;
    switch (l.type) {
      case "image": endpoint = "send-image"; body = { phone: l.phone, image: l.media_url || "", caption: l.message }; break;
      case "audio": endpoint = "send-audio"; body = { phone: l.phone, audio: l.media_url || "" }; break;
      case "document": endpoint = "send-document"; body = { phone: l.phone, document: l.media_url || "", caption: l.message }; break;
      default: endpoint = "send-text"; body = { phone: l.phone, message: l.message, delayMessage: 3 };
    }

    const wapiRes = await fetch(`${WAPI_BASE}/message/${endpoint}?instanceId=${instance_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await wapiRes.json();

    if (wapiRes.ok) {
      await pool.query("UPDATE whatsapp_message_logs SET status='sent', error_message='', sent_at=NOW() WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } else {
      const errMsg = data.message || JSON.stringify(data);
      await pool.query("UPDATE whatsapp_message_logs SET error_message=$1 WHERE id=$2", [errMsg, req.params.id]);
      res.status(400).json({ message: errMsg });
    }
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== BULK SEND (billing) =====
router.post("/send-billing", requireAdmin, async (req, res) => {
  try {
    const { instanceId, templateId, patientIds } = req.body;
    if (!instanceId || !templateId || !patientIds?.length) return res.status(400).json({ message: "Dados incompletos" });

    const tmpl = await pool.query("SELECT * FROM whatsapp_templates WHERE id = $1", [templateId]);
    if (!tmpl.rows.length) return res.status(404).json({ message: "Template não encontrado" });
    const template = tmpl.rows[0];

    const results = [];
    for (const patientId of patientIds) {
      const pResult = await pool.query("SELECT p.*, ps.session_rate FROM patients p LEFT JOIN psychologists ps ON p.psychologist_id = ps.id WHERE p.id = $1", [patientId]);
      if (!pResult.rows.length) continue;
      const patient = pResult.rows[0];

      // Count pending sessions and total due
      const sessResult = await pool.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(expected_amount - paid_amount), 0) as total_due, COALESCE(AVG(expected_amount), 0) as avg_rate
         FROM sessions WHERE patient_id = $1 AND payment_status IN ('pending', 'partial')`, [patientId]);
      const { count, total_due, avg_rate } = sessResult.rows[0];

      const nickname = patient.nickname || patient.name.split(" ")[0];
      const personalizedMsg = template.message
        .replace(/\{nome\}/gi, nickname)
        .replace(/\{sessoes\}/gi, count)
        .replace(/\{valor_sessao\}/gi, parseFloat(avg_rate).toFixed(2).replace(".", ","))
        .replace(/\{valor_total\}/gi, parseFloat(total_due).toFixed(2).replace(".", ","));

      // Send via the send endpoint logic
      const sendRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": req.headers.authorization },
        body: JSON.stringify({ instanceId, phone: patient.phone, message: personalizedMsg, type: template.type, mediaUrl: template.media_url, patientId, templateId }),
      });
      const sendData = await sendRes.json();
      results.push({ patientId, name: patient.name, success: sendRes.ok, data: sendData });
    }

    res.json({ results });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
