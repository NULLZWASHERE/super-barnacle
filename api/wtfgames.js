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

  console.log(`Solving PoW | Difficulty: ${difficulty}`);

  let nonce = 0;
  const maxAttempts = 8000000;

  while (nonce < maxAttempts) {
    const formats = [
      `${challenge}${nonce}`,
      `${challenge}:${nonce}`,
      `${challenge}${timestamp}${nonce}`,
      `${challenge}:${timestamp}:${nonce}`,
    ];

    for (const input of formats) {
      const hash = await sha256(input);
      if (hash.startsWith("0".repeat(difficulty))) {
        console.log(`✅ Solved! Nonce: ${nonce}`);

        // Create the exact format the frontend uses
        const solutionObj = {
          challenge: challenge,
          nonce: nonce,
          timestamp: Date.now()   // Use current timestamp
        };

        const solutionBase64 = Buffer.from(JSON.stringify(solutionObj)).toString('base64');

        return { solutionBase64 };
      }
    }

    nonce++;
    if (nonce % 200000 === 0) {
      await new Promise(r => setTimeout(r, 1));
    }
  }

  throw new Error("PoW solve failed");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  const COOKIE = "server_name_session=8e0dd38f9462b98f3c721be61df5a5aa; key=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MzU3MSIsInVzZXJ0eXBlIjoiZ3Vlc3QiLCJqdGkiOiIxa2dpS1dBY1Jmb1MzV1FyVUdDZ2IiLCJpYXQiOjE3ODAwNzA2NDUsImV4cCI6MTc4MjY2MjY0NX0.uQplBLT2Xp403iir1Us4VkJAVSJQH8RpHD8Wh2XwSMg";

  try {
    const url = "https://aureus.wtf/dashboard/gamesjson?page=1&pageSize=120";

    const baseHeaders = {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "sec-ch-ua": "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "Cookie": COOKIE,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "Referer": "https://aureus.wtf/dashboard/games/",
    };

    // First attempt
    let response = await fetch(url, { headers: baseHeaders });
    let data = await response.json().catch(() => ({}));

    if (data.requiresPow === true) {
      console.log("🔐 PoW challenge received. Solving...");

      const { solutionBase64 } = await solvePow(data.challenge);

      // Send using the exact header format from browser
      const headersWithPow = {
        ...baseHeaders,
        "x-pow-solution": solutionBase64
      };

      response = await fetch(url, { headers: headersWithPow });
      data = await response.json().catch(() => ({}));
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
