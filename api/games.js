// api/games.js
import crypto from 'crypto';

async function sha256(msg) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function solvePow(challenge, difficulty) {
  let nonce = 0;
  const target = "0".repeat(difficulty);

  while (true) {
    // Most common formats for this kind of PoW
    const candidates = [
      challenge + nonce,                    // direct
      challenge + ":" + nonce,              // colon (very common)
      challenge + nonce.toString(),         // string
      `${challenge}:${nonce}:${Date.now()}`, // with timestamp
    ];

    for (const input of candidates) {
      const hash = await sha256(input);
      if (hash.startsWith(target)) {
        console.log(`✅ PoW Solved! Nonce: ${nonce} | Method: ${input.includes(':') ? 'colon' : 'direct'}`);
        return { nonce, solution: input };
      }
    }

    nonce++;

    // Prevent blocking the event loop
    if (nonce % 50000 === 0) {
      await new Promise(r => setTimeout(r, 5));
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  const COOKIE = "server_name_session=a2e03859d0873635e6f981e9c06c37ef; token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjI0MzI3LCJlbWFpbCI6InZhbGRhcnZ1c0BnbWFpbC5jb20iLCJyYW5rIjoidXNlciIsImlhdCI6MTc4MDA2OTE0NCwiZXhwIjoxNzgwNjczOTQ0fQ.Of25Rw9ayHY4qBI8Nd70LIgAFfnJJ30lrsrZ1HIJcSM";

  try {
    const baseUrl = "https://builderx.fun";

    // First request to get challenge
    let response = await fetch(`${baseUrl}/api/games`, {
      headers: {
        "accept": "*/*",
        "cookie": COOKIE,
        "referer": "https://builderx.fun/dashboard/games",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      }
    });

    let data = await response.json().catch(() => null);

    if (data?.requiresPow === true) {
      console.log("🔄 PoW Challenge received:", data.challenge, "| Difficulty:", data.difficulty);

      const { nonce, solution } = await solvePow(data.challenge, data.difficulty);

      // Try the most effective ways to send the solution
      const attempts = [
        // 1. Query parameters (most common)
        `${baseUrl}/api/games?nonce=${nonce}&challenge=${encodeURIComponent(data.challenge)}`,
        `${baseUrl}/api/games?pow=${encodeURIComponent(solution)}`,
        // 2. With original challenge + nonce
        `${baseUrl}/api/games?challenge=${encodeURIComponent(data.challenge)}&nonce=${nonce}`,
      ];

      let success = false;
      let finalData = null;

      for (const url of attempts) {
        response = await fetch(url, {
          headers: {
            "accept": "*/*",
            "cookie": COOKIE,
            "referer": "https://builderx.fun/dashboard/games",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "x-pow-nonce": nonce.toString(),
            "x-pow-challenge": data.challenge,
          }
        });

        try {
          finalData = await response.json();
        } catch {
          finalData = await response.text();
        }

        if (response.ok && finalData?.success !== false && !finalData?.requiresPow) {
          success = true;
          console.log("✅ PoW Accepted!");
          break;
        }
      }

      if (!success) {
        return res.status(400).json({
          error: "Failed to bypass PoW",
          nonce,
          lastResponse: finalData,
          challenge: data.challenge
        });
      }

      data = finalData;
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
