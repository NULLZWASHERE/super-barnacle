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

async function solvePow(challengeBase64) {
  const decoded = JSON.parse(Buffer.from(challengeBase64, 'base64').toString());
  const { challenge, difficulty = 4, timestamp } = decoded;

  console.log(`Solving PoW | Diff: ${difficulty}`);

  let nonce = 0;
  const maxAttempts = 8000000;

  while (nonce < maxAttempts) {
    const formats = [
      `${challenge}${nonce}`,
      `${challenge}:${nonce}`,
      `${challenge}${timestamp}${nonce}`,
      `${challenge}:${timestamp}:${nonce}`,
      `${challenge}${nonce}${timestamp}`,
      `${challenge}:${nonce}:${timestamp}`,
    ];

    for (const input of formats) {
      const hash = await sha256(input);
      if (hash.startsWith("0".repeat(difficulty))) {
        console.log(`✅ Solved with nonce: ${nonce}`);
        return { nonce: nonce.toString(), timestamp, challenge };
      }
    }

    nonce++;
    if (nonce % 200000 === 0) {
      await new Promise(r => setTimeout(r, 1));
    }
  }

  throw new Error("Could not solve PoW");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  const COOKIE = "server_name_session=8e0dd38f9462b98f3c721be61df5a5aa; key=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MzU3MSIsInVzZXJ0eXBlIjoiZ3Vlc3QiLCJqdGkiOiIxa2dpS1dBY1Jmb1MzV1FyVUdDZ2IiLCJpYXQiOjE3ODAwNzA2NDUsImV4cCI6MTc4MjY2MjY0NX0.uQplBLT2Xp403iir1Us4VkJAVSJQH8RpHD8Wh2XwSMg";

  try {
    const baseUrl = "https://aureus.wtf/dashboard/gamesjson/?page=1&pageSize=120";

    const baseHeaders = {
      "Cookie": COOKIE,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://aureus.wtf/dashboard/games",
      "Origin": "https://aureus.wtf",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
    };

    let response = await fetch(baseUrl, { headers: baseHeaders });
    let data = await response.json().catch(() => ({}));

    if (data.requiresPow === true) {
      console.log("🔐 PoW detected, solving...");
      const solved = await solvePow(data.challenge);
      const { nonce, challenge } = solved;

      const strategies = [
        // Query params - most likely
        `${baseUrl}&pow=${nonce}`,
        `${baseUrl}&nonce=${nonce}`,
        `${baseUrl}&solution=${nonce}`,
        `${baseUrl}&pow_nonce=${nonce}&challenge=${encodeURIComponent(challenge)}`,
        `${baseUrl}&pow=${challenge}:${nonce}`,

        // Headers
        { "x-pow-nonce": nonce, "x-challenge": challenge },
        { "x-pow-solution": nonce, "x-challenge": challenge },
        { "x-pow": `${challenge}:${nonce}` },
        { "x-solution": nonce },
        { "pow-solution": nonce },
        { "x-pow": nonce },
        { "x-pow-nonce": nonce },
      ];

      let success = false;
      let finalData = null;

      for (let strat of strategies) {
        let url = baseUrl;
        let headers = { ...baseHeaders };

        if (typeof strat === "string") {
          url = strat;
        } else {
          Object.assign(headers, strat);
        }

        response = await fetch(url, { headers });
        try {
          finalData = await response.json();
        } catch {
          finalData = await response.text();
        }

        if (response.ok && finalData && !finalData.requiresPow) {
          success = true;
          console.log("✅ SUCCESS with strategy!");
          break;
        }
      }

      if (!success) {
        return res.status(400).json({
          error: "All strategies failed again",
          nonce,
          lastResponse: finalData
        });
      }

      data = finalData;
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
