// @ts-nocheck
/**
 * Szili MI oktató proxy (OpenAI-kompatibilis /v1/chat)
 * - Házi feladat MEGOLDHATÓ, de kötelező a LÉPÉSRŐL-LÉPÉSRE magyarázat.
 * - Csak tanulási témák. Nincs személyes adat.
 * - Kimenet: { choices: [{ message: { role: "assistant", content: "..."} }] }
 *
 * NINCS külső import (@vercel/node), így nem kell csomagot telepíteni.
 */

const PROVIDER = (process.env.PROVIDER || "openrouter").toLowerCase();
const API_KEY = process.env.API_KEY || "";
const MODEL =
  process.env.MODEL ||
  (PROVIDER === "openrouter" ? "openai/gpt-4o-mini" : "gpt-4o-mini");

// Rendszerprompt – magyarázatkényszer
const SYSTEM_PROMPT = [
  "Te egy magyar, gyerekbarát tanulási asszisztens vagy.",
  "Csak tanulással foglalkozz (matematika, nyelvtan, történelem, fizika, kémia, biológia, földrajz).",
  "Ne kérj/kezelj személyes adatot. Maradj a tananyagnál.",
  "Házi feladatnál: MEGOLDHATOD, de mindig adj részletes, lépésről-lépésre MAGYARÁZATOT.",
  "Soha ne adj puszta végeredményt magyarázat nélkül.",
  "Stílus: rövid bekezdések, pontokba szedett lépések, a végén 1-2 önellenőrző kérdés.",
  "Ha a téma nem oktatási, udvariasan terelj vissza a tanuláshoz.",
].join("\n");

// Gyanús szavak kiszűrésére egy egyszerű szűrő
function isEducational(messages: any[]): boolean {
  const text = messages.map((m) => m?.content || "").join(" ").toLowerCase();
  const bad = [
    "bitcoin",
    "kripto",
    "társkeres",
    "porn",
    "fegyver",
    "drog",
    "kábítósz",
    "szerencsejáték",
  ];
  return !bad.some((k) => text.includes(k));
}

// Szolgáltatói végpont + kötelező headerek
function providerEndpoint() {
  if (PROVIDER === "openai") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      headers: { Authorization: `Bearer ${API_KEY}` },
    };
  }
  if (PROVIDER === "groq") {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: { Authorization: `Bearer ${API_KEY}` },
    };
  }
  // openrouter (alap)
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "HTTP-Referer": "https://tansegito-ai-proxy.vercel.app",
      "X-Title": "Sulianyúz – Szili MI oktató proxy",
    },
  };
}

// Egyszerű CORS headerek
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === "OPTIONS") {
      res.status(204);
      Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v as string));
      return res.end();
    }

    if (req.method !== "POST") {
      res.status(405);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.end(JSON.stringify({ error: "Use POST /v1/chat" }));
    }

    if (!API_KEY) {
      res.status(500);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.end(JSON.stringify({ error: "Missing API_KEY on server" }));
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const userMessages = Array.isArray(body.messages) ? body.messages : [];
    const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...userMessages];

    // Oktatási szűrő
    if (!isEducational(userMessages)) {
      res.status(200);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content:
                  "Erről nem beszélhetek. Tanuljunk inkább! Adj egy példát valamelyik tantárgyból, és lépésről lépésre magyarázok. 🙂",
              },
            },
          ],
        })
      );
    }

    // Ha „csak eredményt” kér, egészítsük ki a promptot a magyarázatkényszerrel
    const last = userMessages[userMessages.length - 1];
    const enforceExplain =
      last &&
      typeof last.content === "string" &&
      /csak.+eredm|csak.+válasz|röviden|végeredmény/i.test(last.content);

    const patchedMessages = enforceExplain
      ? [
          messages[0],
          ...userMessages.slice(0, -1),
          {
            role: "user",
            content:
              String(last.content) +
              "\n\nFIGYELEM: Kizárólag lépésről-lépésre MAGYARÁZATTAL válaszolj. A puszta végeredmény nem elfogadható.",
          },
        ]
      : messages;

    const { url, headers } = providerEndpoint();
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        model: MODEL,
        messages: patchedMessages,
        temperature: 0.7,
      }),
    });

    const text = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v as string));
    return res.end(text);
  } catch (e: any) {
    res.status(500);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.end(
      JSON.stringify({
        error: "Proxy error",
        message: String(e?.message || e),
      })
    );
  }
}
