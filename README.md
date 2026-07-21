# Previsão Astrológica Completa

App PWA de previsão astrológica. Mapa natal real (cálculo astronômico próprio) cruzado com os trânsitos de hoje, leitura escrita por IA, conta com login e desbloqueio via PIX. Tudo na Cloudflare: Pages + Functions + D1 + Workers AI.

## Estrutura

```
/functions/api/   -> funções serverless (rotas /api/*)
  signup.js         cria conta (e-mail + senha, hash PBKDF2) no D1
  login.js          login, devolve token + perfil + status de desbloqueio
  reading.js        gera a leitura pela IA (Workers AI), trava conteúdo pago, cache
  checkout.js       cria o PIX no Mercado Pago
  payment-status.js polling do status do pagamento
  webhook.js        confirmação servidor-a-servidor do Mercado Pago
  _shared.js        helpers (respostas, CORS, Mercado Pago)
  _auth.js          hash de senha + token de sessão (Web Crypto)
/public/          -> o app (index.html), manifest, service worker, ícone
wrangler.toml     -> binding do D1, binding da IA e variáveis
schema-d1.sql     -> referência do banco (já aplicado)
```

## Deploy (tudo pelo navegador, sem terminal)

1. **Suba os arquivos no GitHub** — no repositório, "Add file" > "Upload files", arraste tudo, "Commit".
2. **Cloudflare > Workers & Pages > Create > Pages > Connect to Git** — escolha este repositório.
   - Framework preset: **None**
   - Build command: (vazio)
   - Build output directory: **public**
   - Save and Deploy.
3. **Ligue o banco D1** — no projeto Pages > Settings > **Functions** (ou Bindings) > D1 database bindings:
   - Variable name: `DB`  ·  Database: **previsao-astrologica**
4. **Ligue a IA** — em Bindings, adicione um **Workers AI** binding:
   - Variable name: `AI`
5. **Cole os segredos** — Settings > **Variables and Secrets** (marque *Encrypt*):
   - `MP_ACCESS_TOKEN` = seu Access Token do Mercado Pago
   - `SESSION_SECRET` = uma frase aleatória longa (qualquer coisa difícil de adivinhar)
   - As variáveis `PRECO`, `LLM_PROVIDER` e `LLM_MODEL` já vêm no `wrangler.toml`.
6. **Redeploy** (Deployments > Retry/Redeploy) para as bindings entrarem.
7. **Mercado Pago** — no painel de desenvolvedor, cadastre a URL de webhook:
   - `https://SEU-PROJETO.pages.dev/api/webhook`  (evento: pagamentos)
8. **Teste** — abra o `.pages.dev`, crie uma conta, gere o mapa e faça um PIX de teste. A liberação é automática quando o pagamento cai.

## Trocar a IA (opcional)

Padrão: Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`), sem chave externa.
Para usar um provedor externo (ex.: Gemini), no `wrangler.toml`:

```
LLM_PROVIDER = "external"
LLM_MODEL    = "gemini-2.5-flash"
LLM_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
```

e adicione o segredo `LLM_API_KEY` no painel.

## Preço

Ajuste `PRECO` no `wrangler.toml` (valor em reais).
