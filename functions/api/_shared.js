// Helpers compartilhados pelas funções
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// Responde preflight OPTIONS automaticamente
export const onRequestOptions = () => new Response(null, { headers: CORS });

// Consulta um pagamento no Mercado Pago e devolve o JSON
export async function mpGetPayment(env, paymentId) {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` },
  });
  return r.json();
}

// Marca o desbloqueio como pago (idempotente)
export async function marcarPago(env, paymentId) {
  await env.DB.prepare(
    `UPDATE unlocks SET status='paid', paid_at=datetime('now') WHERE payment_id=? AND status!='paid'`
  ).bind(String(paymentId)).run();
}
