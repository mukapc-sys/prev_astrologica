// Autenticação: hash de senha (PBKDF2) + token de sessão assinado (HMAC).
// Tudo com Web Crypto — roda nativo nas Cloudflare Functions, sem dependência.
const enc = new TextEncoder();

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256
  );
  return { hash: bufToHex(new Uint8Array(bits)), salt: bufToHex(salt) };
}

export async function verifyPassword(password, saltHex, hashHex) {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEq(hash, hashHex);
}

export async function makeToken(env, uid) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 dias
  const payload = `${uid}.${exp}`;
  const sig = await hmac(env.SESSION_SECRET, payload);
  return btoa(payload) + "." + sig;
}

export async function verifyToken(env, token) {
  try {
    const [p64, sig] = token.split(".");
    const payload = atob(p64);
    const good = await hmac(env.SESSION_SECRET, payload);
    if (!timingSafeEq(sig, good)) return null;
    const [uid, exp] = payload.split(".");
    if (Date.now() > Number(exp)) return null;
    return uid;
  } catch (_) { return null; }
}

// Lê o Bearer token do request e devolve o uid (ou null)
export async function uidFrom(request, env) {
  const h = request.headers.get("Authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : null;
  return t ? verifyToken(env, t) : null;
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret || "dev-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return bufToHex(new Uint8Array(sig));
}
function bufToHex(b) { return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }
function hexToBuf(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
function timingSafeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
