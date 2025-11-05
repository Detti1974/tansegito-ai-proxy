# Tansegítő – Szili MI oktató proxy

## Deploy (Vercel)
1) New Project → Import from Git → ezt a repo-t válaszd.
2) Environment Variables:
   - PROVIDER = openrouter            # vagy openai / groq
   - API_KEY  = ***                   # a választott szolgáltató API-kulcsa
   - MODEL    = openai/gpt-4o-mini    # opcionális, provider-függő
3) Deploy.

A végpont: https://<sajat-proxy>.vercel.app/v1/chat

## Kliens (app)
POST /v1/chat
{
  "messages": [
    { "role": "system", "content": "(elhagyható – a szerver úgyis hozzáadja a Szili promptot)" },
    { "role": "user", "content": "Magyarázd el lépésről-lépésre: 3x + 5 = 11" }
  ]
}

Válasz OpenAI formátumban érkezik: `choices[0].message.content`
