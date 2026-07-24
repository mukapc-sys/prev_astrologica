import { json, onRequestOptions } from "./_shared.js";
import { uidFrom } from "./_auth.js";
export { onRequestOptions };

// POST /api/update-birth  { birth_time:"HH:MM", chart_json }
// Adiciona (ou corrige) a hora de nascimento de quem já tem conta.
// O mapa muda, então as leituras já geradas são apagadas para nascerem de novo, corretas.
export async function onRequestPost({ request, env }) {
  try {
    const uid = await uidFrom(request, env);
    if (!uid) return json({ error: "no_session" }, 401);

    const b = await request.json();
    const t = (b.birth_time || "").trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) return json({ error: "hora_invalida" }, 400);
    const [hh, mm] = t.split(":").map(Number);
    if (hh > 23 || mm > 59) return json({ error: "hora_invalida" }, 400);
    const hora = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

    await env.DB.prepare(
      `UPDATE leads SET birth_time=?, has_time=1, updated_at=datetime('now') WHERE id=?`
    ).bind(hora, uid).run();

    if (b.chart_json) {
      await env.DB.prepare(`INSERT INTO charts (id,lead_id,chart_json) VALUES (?,?,?)`)
        .bind(crypto.randomUUID(), uid, JSON.stringify(b.chart_json)).run();
    }

    // o mapa mudou: limpa o que foi escrito com o mapa antigo
    await env.DB.prepare(`DELETE FROM readings WHERE lead_id=?`).bind(uid).run();
    await env.DB.prepare(`DELETE FROM horoscopes WHERE lead_id=?`).bind(uid).run();

    return json({ ok: true, birth_time: hora });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
