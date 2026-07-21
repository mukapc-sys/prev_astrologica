import { mpGetPayment, marcarPago } from "./_shared.js";

// POST /api/webhook  -> notificação do Mercado Pago
// Sempre responde 200 rápido para o MP não reenviar em loop.
export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    let type = url.searchParams.get("type") || url.searchParams.get("topic");
    let pid = url.searchParams.get("data.id") || url.searchParams.get("id");

    if (!pid) {
      try {
        const body = await request.json();
        pid = body?.data?.id || body?.id;
        type = type || body?.type;
      } catch (_) {}
    }

    // Só nos interessa notificação de pagamento
    if (type && type !== "payment") return new Response("ok");

    if (pid) {
      const data = await mpGetPayment(env, pid);
      if (data.status === "approved") await marcarPago(env, pid);
    }
    return new Response("ok");
  } catch (e) {
    // Nunca falha para o MP — evita reenvios infinitos
    return new Response("ok");
  }
}

// MP às vezes valida a URL com GET
export const onRequestGet = () => new Response("ok");
