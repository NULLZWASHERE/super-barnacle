// api/wtfgames.js
import crypto from 'crypto';

async function sha256(msg) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(msg)
  );
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Improved PoW Solver
async function solvePow(challengeBase64) {
  const decoded = JSON.parse(Buffer.from(challengeBase64, 'base64').toString());
  const { challenge, difficulty = 4 } = decoded;

  console.log(`Solving PoW | Difficulty: ${difficulty}`);

  let nonce = 0;
  const maxAttempts = 3000000;

  while (nonce < maxAttempts) {
    // Try multiple common formats
    const formats = [
      challenge + nonce,
      challenge + ":" + nonce,
      challenge + nonce + decoded.timestamp,
      challenge + ":" + nonce + ":" + decoded.timestamp,
    ];

    for (const input of formats) {
      const hash = await sha256(input);
      if (hash.startsWith("0".repeat(difficulty))) {
        console.log(`✅ PoW Solved! Nonce: ${nonce}`);
        return { nonce, method: input.includes(":") ? "colon" : "direct" };
      }
    }

    nonce++;
    if (nonce % 100000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 10)); // Prevent blocking
    }
  }

  throw new Error("PoW solving failed");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  // Your hardcoded cookies
  const COOKIE = [
    "server_name_session=8e0dd38f9462b98f3c721be61df5a5aa",
    "key=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MzU3MSIsInVzZXJ0eXBlIjoiZ3Vlc3QiLCJqdGkiOiIxa2dpS1dBY1Jmb1MzV1FyVUdDZ2IiLCJpYXQiOjE3ODAwNzA2NDUsImV4cCI6MTc4MjY2MjY0NX0.uQplBLT2Xp403iir1Us4VkJAVSJQH8RpHD8Wh2XwSMg"
  ].join("; ");

  try {
    const url = "https://aureus.wtf/dashboard/gamesjson/?page=1&pageSize=120";

    const baseHeaders = {
      "Cookie": COOKIE,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://aureus.wtf",
    };

    // First request
    let response = await fetch(url, { headers: baseHeaders });
    let data = await response.json().catch(() => null);

    if (!data || data.requiresPow === true) {
      console.log("🔐 PoW challenge received, solving...");

      const result = await solvePow(data.challenge);
      const nonce = result.nonce;

      // === Multiple Bypass Strategies ===
      const strategies = [
        // Query Parameter Strategies
        `${url}&nonce=${nonce}&challenge=${encodeURIComponent(data.challenge)}`,
        `${url}&pow=${nonce}`,
        `${url}&solution=${nonce}`,
        `${url}&pow_nonce=${nonce}`,

        // Header Strategies
        { "x-pow-nonce": nonce.toString(), "x-challenge": data.challenge },
        { "x-pow-solution": nonce.toString(), "x-challenge": data.challenge },
        { "x-pow": `${data.challenge}:${nonce}` },
        { "x-solution": nonce.toString() },
        { "pow-solution": nonce.toString() },
        { "x-pow-nonce": nonce.toString() },
      ];

      let success = false;
      let finalData = null;

      for (let strat of strategies) {
        let fetchUrl = url;
        let headers = { ...baseHeaders };

        if (typeof strat === "string") {
          fetchUrl = strat;
        } else {
          Object.assign(headers, strat);
        }

        response = await fetch(fetchUrl, { headers });
        try {
          finalData = await response.json();
        } catch {
          finalData = await response.text();
        }

        if (response.ok && finalData && !finalData.requiresPow) {
          success = true;
          console.log(`✅ PoW bypass successful with strategy: ${typeof strat === "string" ? "Query" : "Header"}`);
          break;
        }
      }

      if (!success) {
        return res.status(400).json({
          error: "All PoW bypass attempts failed",
          nonce,
          lastResponse: finalData
        });
      }

      data = finalData;
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
