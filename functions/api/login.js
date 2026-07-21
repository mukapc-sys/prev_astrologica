import { json, onRequestOptions } from "./_shared.js";
import { verifyPassword, makeToken } from "./_auth.js";
export { onRequestOptions };

// POST /api/login  { email, senha }
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (!b.email || !b.senha) return json({ error: "dados incompletos" }, 400);

    const u = await env.DB.prepare(
      `SELECT id,password_hash,salt,nome,birth_date,birth_time,has_time,birth_city,lat,lon FROM leads WHERE email=?`
    ).bind(b.email).first();
    if (!u || !u.password_hash) return json({ error: "credenciais" }, 401);

    const ok = await verifyPassword(b.senha, u.salt, u.password_hash);
    if (!ok) return json({ error: "credenciais" }, 401);

    const unlocked = await env.DB.prepare(
      `SELECT 1 FROM unlocks WHERE lead_id=? AND status='paid' LIMIT 1`
    ).bind(u.id).first();

    const chart = await env.DB.prepare(
      `SELECT chart_json FROM charts WHERE lead_id=? ORDER BY computed_at DESC LIMIT 1`
    ).bind(u.id).first();

    const token = await makeToken(env, u.id);
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
