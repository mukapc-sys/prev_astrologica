import { json, onRequestOptions } from "./_shared.js";
import { uidFrom, makeToken } from "./_auth.js";
export { onRequestOptions };

// GET /api/me  (Authorization: Bearer <token>)
// Valida a sessão salva no aparelho e devolve o perfil + status, sem senha.
export async function onRequestGet({ request, env }) {
  try {
    const uid = await uidFrom(request, env);
    if (!uid) return json({ error: "no_session" }, 401);

    const u = await env.DB.prepare(
      `SELECT id,nome,birth_date,birth_time,has_time,birth_city,lat,lon FROM leads WHERE id=?`
    ).bind(uid).first();
    if (!u) return json({ error: "no_session" }, 401);

    const unlocked = await env.DB.prepare(
      `SELECT 1 FROM unlocks WHERE lead_id=? AND status='paid' LIMIT 1`
    ).bind(uid).first();

    const chart = await env.DB.prepare(
      `SELECT chart_json FROM charts WHERE lead_id=? ORDER BY computed_at DESC LIMIT 1`
    ).bind(uid).first();

    const token = await makeToken(env, uid);   // renova a sessão (mantém conectado)
    return json({
      token,
      lead_id: u.id,
      nome: u.nome,
      unlocked: !!unlocked,
      perfil: {
        birth_date: u.birth_date, birth_time: u.birth_time, has_time: !!u.has_time,
        birth_city: u.birth_city, lat: u.lat, lon: u.lon,
      },
      chart_json: chart ? JSON.parse(chart.chart_json) : null,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
