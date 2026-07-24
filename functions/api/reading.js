import { json, onRequestOptions } from "./_shared.js";
export { onRequestOptions };

const SYSTEM = `Você é uma astróloga brasileira experiente e acolhedora. Você lê o mapa da pessoa cruzando o mapa de nascimento com os astros de hoje. Escreva em português do Brasil impecável, com gramática e concordância corretas (atenção a gênero e número, por exemplo: "a sua Lua", "o seu Sol").

Fale de forma SIMPLES e explicada, como quem conversa com um amigo de uns 45 anos que gosta de astrologia mas não entende os termos técnicos. Sempre que citar um termo (trânsito, casa, aspecto, retrógrado, regente), explique em poucas palavras o que ele significa na vida real da pessoa. Nada de jargão solto nem frases confusas.

Você fala de tendências, ciclos e orientações para reflexão e escolha consciente, sem promessas determinísticas de fatos ou datas exatas. Sem markdown, sem listas, sem títulos. Nunca use travessão (—) no texto; prefira vírgula, ponto ou dois-pontos.

REGRA DE OURO, feito sob medida: nunca escreva algo genérico que caberia em qualquer pessoa do mesmo signo. Use os detalhes exclusivos deste mapa (graus, casas, aspectos, planetas retrógrados, regente, temperamento) cruzados com os astros de hoje, e cite ao menos dois desses detalhes, sempre traduzidos em linguagem do dia a dia, não em jargão.`;

const PAGAS = ["financeira", "relacional", "profissional"];

// POST /api/reading  { lead_id, area, prompt }
export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json();
    const area = b.area;
    if (!b.prompt) return json({ error: "prompt ausente" }, 400);

    // Horóscopo semanal: 1 por semana (domingo→sábado). Reabrir na mesma semana devolve o mesmo.
    if (area === "weekly") {
      const wk = weekStartBR();
      if (b.lead_id) {
        const cached = await env.DB.prepare(
          `SELECT content FROM horoscopes WHERE lead_id=? AND week_start=?`
        ).bind(b.lead_id, wk).first();
        if (cached) return json({ content: cached.content, cached: true });
      }
      const content = await callLLM(env, SYSTEM, b.prompt);
      if (b.lead_id) {
        await env.DB.prepare(
          `INSERT INTO horoscopes (id,lead_id,week_start,content) VALUES (?,?,?,?)
           ON CONFLICT(lead_id,week_start) DO UPDATE SET content=excluded.content`
        ).bind(crypto.randomUUID(), b.lead_id, wk, content).run();
      }
      return json({ content });
    }

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
// Início da semana (domingo) no fuso do Brasil (UTC-3), no formato YYYY-MM-DD
function weekStartBR() {
  const nowBR = new Date(Date.now() - 3 * 3600 * 1000);
  const day = nowBR.getUTCDay(); // 0 = domingo
  const sunday = new Date(nowBR);
  sunday.setUTCDate(nowBR.getUTCDate() - day);
  return sunday.toISOString().slice(0, 10);
}

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
