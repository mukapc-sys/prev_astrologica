import { json, onRequestOptions } from "./_shared.js";
import { hashPassword, makeToken } from "./_auth.js";
export { onRequestOptions };

// POST /api/signup  { nome, email, telefone, senha, birth_date, birth_time, has_time, birth_city, lat, lon, chart_json }
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (!b.email || !b.senha || !b.nome || !b.birth_date)
      return json({ error: "dados incompletos" }, 400);

    const exists = await env.DB.prepare(`SELECT id FROM leads WHERE email=?`).bind(b.email).first();
    if (exists) return json({ error: "email_ja_existe" }, 409);

    const { hash, salt } = await hashPassword(b.senha);
    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO leads (id,nome,email,telefone,password_hash,salt,birth_date,birth_time,has_time,birth_city,lat,lon)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      id, b.nome, b.email, b.telefone || null, hash, salt,
      b.birth_date, b.birth_time || null, b.has_time ? 1 : 0,
      b.birth_city || null, b.lat ?? null, b.lon ?? null
    ).run();

    if (b.chart_json) {
      await env.DB.prepare(`INSERT INTO charts (id,lead_id,chart_json) VALUES (?,?,?)`)
        .bind(crypto.randomUUID(), id, JSON.stringify(b.chart_json)).run();
    }

    const token = await makeToken(env, id);
    return json({ token, lead_id: id, nome: b.nome });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
