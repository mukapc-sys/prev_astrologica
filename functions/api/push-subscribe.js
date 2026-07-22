import { json, onRequestOptions } from "./_shared.js";
import { uidFrom } from "./_auth.js";
export { onRequestOptions };

// POST /api/push-subscribe  { subscription }
// Salva a inscrição de push do aparelho, ligada ao lead (se logado).
export async function onRequestPost({ request, env }) {
  try {
    const uid = await uidFrom(request, env);      // pode ser null
    const b = await request.json();
    const sub = b.subscription || b;
    if (!sub || !sub.endpoint) return json({ error: "subscription inválida" }, 400);
    const keys = sub.keys || {};

    await env.DB.prepare(
      `INSERT INTO push_subs (id,lead_id,endpoint,p256dh,auth) VALUES (?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET lead_id=excluded.lead_id, p256dh=excluded.p256dh, auth=excluded.auth`
    ).bind(crypto.randomUUID(), uid || null, sub.endpoint, keys.p256dh || null, keys.auth || null).run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
