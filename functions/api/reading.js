import { json, onRequestOptions } from "./_shared.js";
export { onRequestOptions };

const SYSTEM = `Você é uma astróloga brasileira experiente, com décadas de prática em astrologia tropical. Você lê mapas cruzando o mapa natal da pessoa com os trânsitos atuais dos planetas. Seu tom é acolhedor, maduro e específico — nunca genérico. Você SEMPRE ancora o que diz em posições e trânsitos reais fornecidos (cite signos, casas e aspectos concretos). Você fala de tendências, ciclos e orientações para reflexão e escolha consciente — nunca faz promessas determinísticas de fatos ou datas exatas. Escreve em português do Brasil, em prosa fluida, sem markdown, sem listas, sem títulos.

REGRA DE OURO — feito sob medida: nunca escreva nada que caberia em qualquer pessoa do mesmo signo solar. Cada leitura precisa ser inconfundivelmente DESTA pessoa. Para isso, use os detalhes exclusivos do mapa fornecido — os graus exatos, as casas, os aspectos natais, os planetas retrógrados, o regente do mapa, o temperamento por elemento e modalidade — e cruze-os com os trânsitos e o céu de hoje. Cite pelo menos dois fatores específicos do mapa em cada leitura. Se algo é marcante nesta pessoa (um retrógrado, um aspecto tenso, um elemento ausente, o regente numa casa forte), nomeie e trabalhe isso. Nada de frases de horóscopo de revista.`;

const PAGAS = ["financeira", "relacional", "profissional"];

// POST /api/reading  { lead_id, area, prompt }
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    const area = b.area;
    if (!b.prompt) return json({ error: "prompt ausente" }, 400);

    // Áreas pagas: exigem desbloqueio confirmado + cache por lead/área
    if (PAGAS.includes(area)) {
      if (!b.lead_id) return json({ error: "lead ausente" }, 400);
      const u = await env.DB.prepare(
        `SELECT status FROM unlocks WHERE lead_id=? AND status='paid' ORDER BY created_at DESC LIMIT 1`
      ).bind(b.lead_id).first();
      if (!u) return json({ error: "locked" }, 402);

      const cached = await env.DB.prepare(
        `SELECT content FROM readings WHERE lead_id=? AND area=? ORDER BY created_at DESC LIMIT 1`
      ).bind(b.lead_id, area).first();
      if (cached) return json({ content: cached.content, cached: true });
    }

    const content = await callLLM(env, SYSTEM, b.prompt);

    if (PAGAS.includes(area) && b.lead_id) {
      await env.DB.prepare(`INSERT INTO readings (id,lead_id,area,content) VALUES (?,?,?,?)`)
        .bind(crypto.randomUUID(), b.lead_id, area, content).run();
    }
    return json({ content });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}

// IA plugável:
//  - "workers-ai" (padrão): roda NA Cloudflare via binding env.AI, sem chave externa.
//  - "external": qualquer provedor compatível com OpenAI (Gemini, DeepSeek, GPT...).
async function callLLM(env, system, user) {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  if ((env.LLM_PROVIDER || "workers-ai") === "workers-ai") {
    const out = await env.AI.run(env.LLM_MODEL, { messages, max_tokens: 900, temperature: 0.85 });
    return (out.response || "").trim();
  }

  // Provedor externo (OpenAI-compatível) — usa LLM_ENDPOINT + segredo LLM_API_KEY
  const r = await fetch(env.LLM_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.LLM_MODEL, messages, max_tokens: 900, temperature: 0.85 }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(data));
  return (data.choices?.[0]?.message?.content || "").trim();
}
