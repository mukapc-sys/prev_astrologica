import { json, onRequestOptions } from "./_shared.js";
export { onRequestOptions };

// POST /api/checkout  { lead_id, email, nome }
// Cria um pagamento PIX (checkout transparente) no Mercado Pago
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    if (!b.lead_id || !b.email) return json({ error: "dados incompletos" }, 400);

    const amount = Number(env.PRECO || 47);
    const origin = new URL(request.url).origin;
    const nome = (b.nome || "Cliente").trim();
    const [first, ...rest] = nome.split(" ");

    const payment = {
      transaction_amount: amount,
      description: "Previsão Astrológica Completa",
      payment_method_id: "pix",
      payer: { email: b.email, first_name: first, last_name: rest.join(" ") || first },
      notification_url: `${origin}/api/webhook`,
      external_reference: b.lead_id,
    };

    const r = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify(payment),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: "mercadopago", detail: data }, 502);

    const td = data.point_of_interaction?.transaction_data || {};

    await env.DB.prepare(
      `INSERT INTO unlocks (id,lead_id,payment_id,status,amount,pix_qr,pix_copia_cola,external_ref)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(
      crypto.randomUUID(), b.lead_id, String(data.id), "pending",
      amount, td.qr_code_base64 || null, td.qr_code || null, b.lead_id
    ).run();

    return json({
      payment_id: data.id,
      status: data.status,
      qr_base64: td.qr_code_base64 || null,
      copia_cola: td.qr_code || null,
      ticket_url: td.ticket_url || null,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
