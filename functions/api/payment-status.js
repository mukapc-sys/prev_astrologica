import { json, onRequestOptions, mpGetPayment, marcarPago } from "./_shared.js";
export { onRequestOptions };

// GET /api/payment-status?payment_id=123
// O app faz polling aqui enquanto o PIX está pendente.
export async function onRequestGet({ request, env }) {
  try {
    const pid = new URL(request.url).searchParams.get("payment_id");
    if (!pid) return json({ error: "payment_id ausente" }, 400);

    const data = await mpGetPayment(env, pid);
    const status = data.status || "unknown"; // pending | approved | rejected | cancelled...

    if (status === "approved") await marcarPago(env, pid);

    return json({ status });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
