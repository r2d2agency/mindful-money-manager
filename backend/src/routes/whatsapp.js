const express = require("express");
const { pool } = require("../db");
const { requireAdmin } = require("../middleware/auth");
const router = express.Router();

const WAPI_BASE = "https://api.w-api.app/v1";

// ===== INSTANCES =====

router.post("/instances", requireAdmin, async (req, res) => {
  try {
    const { instanceName, globalToken, autoCreate = true, rejectCalls, callMessage, manualInstanceId, manualToken } = req.body;
    if (!instanceName) return res.status(400).json({ message: "Nome da conexão é obrigatório" });

    if (autoCreate) {
      if (!globalToken) return res.status(400).json({ message: "Token global é obrigatório para criação automática" });
      const wapiRes = await fetch(`${WAPI_BASE}/integrator/create-instance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${globalToken}` },
        body: JSON.stringify({ instanceName, rejectCalls: rejectCalls || false, callMessage: callMessage || "" }),
      });
      const wapiData = await wapiRes.json();
      if (wapiData.error) return res.status(400).json({ message: wapiData.message || "Erro ao criar instância na W-API" });

      const result = await pool.query(
        `INSERT INTO whatsapp_instances (instance_name, instance_id, token, global_token, status) VALUES ($1, $2, $3, $4, 'disconnected') RETURNING *`,
        [instanceName, wapiData.instanceId, wapiData.token, globalToken]
      );
      res.json(result.rows[0]);
    } else {
      if (!manualInstanceId || !manualToken) return res.status(400).json({ message: "Instance ID e Token são obrigatórios" });
      const result = await pool.query(
        `INSERT INTO whatsapp_instances (instance_name, instance_id, token, global_token, status) VALUES ($1, $2, $3, $4, 'disconnected') RETURNING *`,
        [instanceName, manualInstanceId, manualToken, globalToken || ""]
      );
      res.json(result.rows[0]);
    }
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/instances", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, instance_name, instance_id, status, connected_phone, created_at FROM whatsapp_instances ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/instances/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/instances/:id/qrcode", requireAdmin, async (req, res) => {
  try {
    const inst = await pool.query("SELECT instance_id, token FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    const { instance_id, token } = inst.rows[0];
    const wapiRes = await fetch(`${WAPI_BASE}/instance/qr-code?instanceId=${instance_id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await wapiRes.json();
    if (data.error === false && (data.qrcode || data.base64)) {
      await pool.query("UPDATE whatsapp_instances SET status = 'pending' WHERE id = $1", [req.params.id]);
    }
    res.json({ ...data, qrcode: data.base64 || data.qrcode });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/instances/:id/status", async (req, res) => {
  try {
    const inst = await pool.query("SELECT instance_id, token FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    const { instance_id, token } = inst.rows[0];
    const wapiRes = await fetch(`${WAPI_BASE}/instance/status-instance?instanceId=${instance_id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    let data;
    try { data = await wapiRes.json(); } catch { data = {}; }
    const isConnected = data.connected === true;
    const phone = data.connectedPhone || data.phone || null;
    await pool.query("UPDATE whatsapp_instances SET status = $1, connected_phone = $2 WHERE id = $3",
      [isConnected ? "connected" : "disconnected", phone, req.params.id]);
    res.json({ connected: isConnected, connectedPhone: phone, dbStatus: isConnected ? "connected" : "disconnected" });
  } catch (err) { console.error("Status error:", err); res.status(500).json({ message: "Erro ao verificar status: " + err.message }); }
});

router.post("/instances/:id/restart", requireAdmin, async (req, res) => {
  try {
    const inst = await pool.query("SELECT instance_id, token FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    const { instance_id, token } = inst.rows[0];
    const wapiRes = await fetch(`${WAPI_BASE}/instance/restart?instanceId=${instance_id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await wapiRes.json();
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.post("/instances/:id/disconnect", requireAdmin, async (req, res) => {
  try {
    const inst = await pool.query("SELECT instance_id, token FROM whatsapp_instances WHERE id = $1", [req.params.id]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    const { instance_id, token } = inst.rows[0];
    const wapiRes = await fetch(`${WAPI_BASE}/instance/disconnect?instanceId=${instance_id}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    const data = await wapiRes.json();
    await pool.query("UPDATE whatsapp_instances SET status = 'disconnected', connected_phone = NULL WHERE id = $1", [req.params.id]);
    res.json(data);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== SEND SINGLE MESSAGE (internal helper) =====
async function sendSingleMessage(instance_id, token, phone, message, type, mediaBase64, simulateTyping) {
  const cleanPhone = phone.replace(/\D/g, "");
  let endpoint, body;

  // Simulate typing/recording
  if (simulateTyping) {
    const presenceType = type === "audio" ? "recording" : "composing";
    try {
      await fetch(`${WAPI_BASE}/chat/send-presence?instanceId=${instance_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ phone: cleanPhone, presence: presenceType }),
      });
    } catch (e) { console.error("Presence error:", e); }
  }

  switch (type) {
    case "image":
      endpoint = "send-image";
      body = { phone: cleanPhone, image: mediaBase64, caption: message };
      break;
    case "audio":
      endpoint = "send-audio";
      body = { phone: cleanPhone, audio: mediaBase64 };
      break;
    case "video":
      endpoint = "send-video";
      body = { phone: cleanPhone, video: mediaBase64, caption: message };
      break;
    case "document":
      endpoint = "send-document";
      body = { phone: cleanPhone, document: mediaBase64, fileName: "documento", caption: message };
      break;
    default:
      endpoint = "send-text";
      body = { phone: cleanPhone, message };
  }

  const wapiRes = await fetch(`${WAPI_BASE}/message/${endpoint}?instanceId=${instance_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await wapiRes.json();
  return { ok: wapiRes.ok, data };
}

// ===== SEND MULTIPLE MESSAGES (sequence with delays) =====
router.post("/send-multi", async (req, res) => {
  try {
    const { instanceId, phone, messages, patientId } = req.body;
    // messages: [{ type, message, mediaBase64, delayAfter, simulateTyping }]
    if (!instanceId || !phone || !messages?.length) return res.status(400).json({ message: "Dados incompletos" });

    const inst = await pool.query("SELECT instance_id, token, status FROM whatsapp_instances WHERE id = $1", [instanceId]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    if (inst.rows[0].status !== "connected") return res.status(400).json({ message: "Instância não conectada" });

    const { instance_id, token } = inst.rows[0];
    const results = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const result = await sendSingleMessage(instance_id, token, phone, msg.message || "", msg.type || "text", msg.mediaBase64 || "", msg.simulateTyping);
      
      const logStatus = result.ok ? "sent" : "failed";
      const errorMsg = result.ok ? "" : (result.data.message || JSON.stringify(result.data));

      await pool.query(
        `INSERT INTO whatsapp_message_logs (patient_id, instance_id, phone, message, type, status, error_message, sent_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [patientId || null, instanceId, phone.replace(/\D/g, ""), msg.message || `[${msg.type}]`, msg.type || "text", logStatus, errorMsg, logStatus === "sent" ? new Date() : null]
      );

      results.push({ index: i, success: result.ok, data: result.data });

      // Wait delay before next message
      if (i < messages.length - 1 && msg.delayAfter > 0) {
        await new Promise(resolve => setTimeout(resolve, msg.delayAfter * 1000));
      }
    }

    res.json({ success: true, results });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== SEND SINGLE (legacy) =====
router.post("/send", async (req, res) => {
  try {
    const { instanceId, phone, message, type, mediaUrl, mediaBase64, patientId, templateId, simulateTyping } = req.body;
    if (!instanceId || !phone || (!message && type === "text")) return res.status(400).json({ message: "Dados incompletos" });

    const inst = await pool.query("SELECT instance_id, token, status FROM whatsapp_instances WHERE id = $1", [instanceId]);
    if (!inst.rows.length) return res.status(404).json({ message: "Instância não encontrada" });
    if (inst.rows[0].status !== "connected") return res.status(400).json({ message: "Instância não conectada" });

    const { instance_id, token } = inst.rows[0];
    const media = mediaBase64 || mediaUrl || "";
    const result = await sendSingleMessage(instance_id, token, phone, message || "", type || "text", media, simulateTyping);

    const logStatus = result.ok ? "sent" : "failed";
    const errorMsg = result.ok ? "" : (result.data.message || JSON.stringify(result.data));

    await pool.query(
      `INSERT INTO whatsapp_message_logs (patient_id, template_id, instance_id, phone, message, type, status, error_message, sent_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [patientId || null, templateId || null, instanceId, phone.replace(/\D/g, ""), message || `[${type}]`, type || "text", logStatus, errorMsg, logStatus === "sent" ? new Date() : null]
    );

    if (!result.ok) return res.status(400).json({ message: errorMsg, data: result.data });
    res.json({ success: true, data: result.data });
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

router.post("/logs/:id/resend", async (req, res) => {
  try {
    const log = await pool.query("SELECT * FROM whatsapp_message_logs WHERE id = $1", [req.params.id]);
    if (!log.rows.length) return res.status(404).json({ message: "Log não encontrado" });
    const l = log.rows[0];
    const inst = await pool.query("SELECT instance_id, token, status FROM whatsapp_instances WHERE id = $1", [l.instance_id]);
    if (!inst.rows.length || inst.rows[0].status !== "connected") return res.status(400).json({ message: "Instância não conectada" });
    const { instance_id, token } = inst.rows[0];
    const result = await sendSingleMessage(instance_id, token, l.phone, l.message, l.type, "", false);
    if (result.ok) {
      await pool.query("UPDATE whatsapp_message_logs SET status='sent', error_message='', sent_at=NOW() WHERE id=$1", [req.params.id]);
      res.json({ success: true });
    } else {
      const errMsg = result.data.message || JSON.stringify(result.data);
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

    const inst = await pool.query("SELECT instance_id, token, status FROM whatsapp_instances WHERE id = $1", [instanceId]);
    if (!inst.rows.length || inst.rows[0].status !== "connected") return res.status(400).json({ message: "Instância não conectada" });
    const { instance_id, token } = inst.rows[0];

    const results = [];
    for (const patientId of patientIds) {
      const pResult = await pool.query("SELECT p.*, ps.session_rate FROM patients p LEFT JOIN psychologists ps ON p.psychologist_id = ps.id WHERE p.id = $1", [patientId]);
      if (!pResult.rows.length) continue;
      const patient = pResult.rows[0];

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

      const result = await sendSingleMessage(instance_id, token, patient.phone, personalizedMsg, template.type, template.media_url, false);
      const logStatus = result.ok ? "sent" : "failed";
      await pool.query(
        `INSERT INTO whatsapp_message_logs (patient_id, template_id, instance_id, phone, message, type, status, error_message, sent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [patientId, templateId, instanceId, patient.phone.replace(/\D/g, ""), personalizedMsg, template.type, logStatus, result.ok ? "" : JSON.stringify(result.data), result.ok ? new Date() : null]
      );
      results.push({ patientId, name: patient.name, success: result.ok, data: result.data });
    }

    res.json({ results });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== PATIENT BILLING CONFIG =====
router.get("/billing-config", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bc.*, p.name as patient_name, p.phone as patient_phone, t.name as template_name, i.instance_name
       FROM patient_billing_config bc
       JOIN patients p ON bc.patient_id = p.id
       LEFT JOIN whatsapp_templates t ON bc.template_id = t.id
       LEFT JOIN whatsapp_instances i ON bc.instance_id = i.id
       ORDER BY bc.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.get("/billing-config/:patientId", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM patient_billing_config WHERE patient_id = $1", [req.params.patientId]);
    res.json(result.rows[0] || null);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.put("/billing-config/:patientId", async (req, res) => {
  try {
    const { active, billingDay, templateId, instanceId } = req.body;
    const result = await pool.query(
      `INSERT INTO patient_billing_config (patient_id, active, billing_day, template_id, instance_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (patient_id) DO UPDATE SET active=$2, billing_day=$3, template_id=$4, instance_id=$5, updated_at=NOW()
       RETURNING *`,
      [req.params.patientId, active, billingDay, templateId || null, instanceId || null]
    );
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.delete("/billing-config/:patientId", async (req, res) => {
  try {
    await pool.query("DELETE FROM patient_billing_config WHERE patient_id = $1", [req.params.patientId]);
    // Cancel future scheduled billings
    await pool.query("UPDATE scheduled_billings SET status='cancelled' WHERE patient_id = $1 AND status='pending' AND scheduled_date > CURRENT_DATE", [req.params.patientId]);
    res.status(204).end();
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// ===== SCHEDULED BILLINGS =====
router.get("/scheduled-billings", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sb.*, p.name as patient_name, p.phone as patient_phone, t.name as template_name, i.instance_name
       FROM scheduled_billings sb
       JOIN patients p ON sb.patient_id = p.id
       LEFT JOIN whatsapp_templates t ON sb.template_id = t.id
       LEFT JOIN whatsapp_instances i ON sb.instance_id = i.id
       ORDER BY sb.scheduled_date ASC`
    );
    res.json(result.rows);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

router.put("/scheduled-billings/:id", async (req, res) => {
  try {
    const { scheduledDate, templateId, instanceId, status, notes } = req.body;
    const result = await pool.query(
      `UPDATE scheduled_billings SET scheduled_date=COALESCE($1,scheduled_date), template_id=COALESCE($2,template_id), instance_id=COALESCE($3,instance_id), status=COALESCE($4,status), notes=COALESCE($5,notes) WHERE id=$6 RETURNING *`,
      [scheduledDate, templateId, instanceId, status, notes, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Não encontrado" });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Force send a scheduled billing now
router.post("/scheduled-billings/:id/send-now", async (req, res) => {
  try {
    const sb = await pool.query(
      `SELECT sb.*, p.name, p.phone, p.nickname, ps.session_rate
       FROM scheduled_billings sb
       JOIN patients p ON sb.patient_id = p.id
       LEFT JOIN psychologists ps ON p.psychologist_id = ps.id
       WHERE sb.id = $1`, [req.params.id]);
    if (!sb.rows.length) return res.status(404).json({ message: "Não encontrado" });
    const billing = sb.rows[0];

    if (!billing.template_id || !billing.instance_id) return res.status(400).json({ message: "Template ou instância não configurados" });

    const tmpl = await pool.query("SELECT * FROM whatsapp_templates WHERE id = $1", [billing.template_id]);
    if (!tmpl.rows.length) return res.status(404).json({ message: "Template não encontrado" });

    const inst = await pool.query("SELECT instance_id, token, status FROM whatsapp_instances WHERE id = $1", [billing.instance_id]);
    if (!inst.rows.length || inst.rows[0].status !== "connected") return res.status(400).json({ message: "Instância não conectada" });

    const sessResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(expected_amount - paid_amount), 0) as total_due, COALESCE(AVG(expected_amount), 0) as avg_rate
       FROM sessions WHERE patient_id = $1 AND payment_status IN ('pending', 'partial')`, [billing.patient_id]);
    const { count, total_due, avg_rate } = sessResult.rows[0];

    const nickname = billing.nickname || billing.name.split(" ")[0];
    const personalizedMsg = tmpl.rows[0].message
      .replace(/\{nome\}/gi, nickname)
      .replace(/\{sessoes\}/gi, count)
      .replace(/\{valor_sessao\}/gi, parseFloat(avg_rate).toFixed(2).replace(".", ","))
      .replace(/\{valor_total\}/gi, parseFloat(total_due).toFixed(2).replace(".", ","));

    const result = await sendSingleMessage(inst.rows[0].instance_id, inst.rows[0].token, billing.phone, personalizedMsg, tmpl.rows[0].type, "", false);

    if (result.ok) {
      await pool.query("UPDATE scheduled_billings SET status='sent', sent_at=NOW() WHERE id=$1", [req.params.id]);
      await pool.query(
        `INSERT INTO whatsapp_message_logs (patient_id, template_id, instance_id, phone, message, type, status, sent_at) VALUES ($1,$2,$3,$4,$5,$6,'sent',NOW())`,
        [billing.patient_id, billing.template_id, billing.instance_id, billing.phone.replace(/\D/g, ""), personalizedMsg, tmpl.rows[0].type]
      );
      res.json({ success: true });
    } else {
      const errMsg = result.data.message || JSON.stringify(result.data);
      await pool.query("UPDATE scheduled_billings SET status='failed', error_message=$1 WHERE id=$2", [errMsg, req.params.id]);
      res.status(400).json({ message: errMsg });
    }
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

// Generate scheduled billings from billing configs (call periodically or manually)
router.post("/generate-scheduled-billings", requireAdmin, async (req, res) => {
  try {
    const configs = await pool.query("SELECT * FROM patient_billing_config WHERE active = true");
    let created = 0;

    for (const config of configs.rows) {
      // Generate for next 3 months
      for (let m = 0; m < 3; m++) {
        const date = new Date();
        date.setMonth(date.getMonth() + m);
        const day = Math.min(config.billing_day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate());
        date.setDate(day);
        const dateStr = date.toISOString().split("T")[0];

        // Skip past dates
        if (new Date(dateStr) < new Date(new Date().toISOString().split("T")[0])) continue;

        // Check if already exists
        const exists = await pool.query(
          "SELECT 1 FROM scheduled_billings WHERE patient_id=$1 AND scheduled_date=$2 AND status != 'cancelled'",
          [config.patient_id, dateStr]
        );
        if (exists.rows.length) continue;

        await pool.query(
          `INSERT INTO scheduled_billings (patient_id, config_id, template_id, instance_id, scheduled_date) VALUES ($1,$2,$3,$4,$5)`,
          [config.patient_id, config.id, config.template_id, config.instance_id, dateStr]
        );
        created++;
      }
    }

    res.json({ created });
  } catch (err) { console.error(err); res.status(500).json({ message: "Erro interno" }); }
});

module.exports = router;
