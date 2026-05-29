export default async function handler(req, res) {
  try {
    const hardcodedCookies = [
      `server_name_session=8e0dd38f9462b98f3c721be61df5a5aa`,
      `key=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MzU3MSIsInVzZXJ0eXBlIjoiZ3Vlc3QiLCJqdGkiOiIxa2dpS1dBY1Jmb1MzV1FyVUdDZ2IiLCJpYXQiOjE3ODAwNzA2NDUsImV4cCI6MTc4MjY2MjY0NX0.uQplBLT2Xp403iir1Us4VkJAVSJQH8RpHD8Wh2XwSMg`
    ].join('; ');

    const url = "https://aureus.wtf/dashboard/gamesjson/?page=1&pageSize=120";

    const baseHeaders = {
      "Cookie": hardcodedCookies,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://aureus.wtf",
    };

    let response = await fetch(url, { method: "GET", headers: baseHeaders });
    let text = await response.text();

    // === PoW Handling ===
    if (response.status === 403 || text.includes("requiresPow")) {
      try {
        const data = JSON.parse(text);
        if (data.requiresPow && data.challenge) {
          console.log("🔐 PoW challenge received. Solving...");

          const solution = await solvePoW(data.challenge);

          // Try multiple header combinations
          const attempts = [
            { "X-PoW-Solution": solution },
            { "X-PoW": solution },
            { "pow": solution },
            { "X-Challenge-Solution": solution },
            { "X-PoW-Nonce": solution },
          ];

          for (const extraHeaders of attempts) {
            const headers = { ...baseHeaders, ...extraHeaders, "X-Challenge": data.challenge };

            response = await fetch(url, { method: "GET", headers });
            text = await response.text();

            if (response.status !== 403 && !text.includes("Invalid PoW")) {
              console.log("✅ PoW accepted with header:", Object.keys(extraHeaders)[0]);
              break;
            }
          }
        }
      } catch (e) {
        console.error("PoW error:", e);
      }
    }

    // Forward Set-Cookie
    if (response.headers.has("set-cookie")) {
      response.headers.raw()["set-cookie"].forEach(c => res.setHeader("Set-Cookie", c));
    }

    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Invalid JSON",
        raw: text.substring(0, 500)
      });
    }
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ==================== IMPROVED PoW SOLVER ====================
async function solvePoW(challengeBase64) {
  const decoded = JSON.parse(Buffer.from(challengeBase64, 'base64').toString());
  const { challenge, difficulty = 4 } = decoded;

  console.log(`Solving difficulty ${difficulty}...`);

  const maxAttempts = 2000000;

  for (let nonce = 0; nonce < maxAttempts; nonce++) {
    // Try different common input formats
    const formats = [
      `${challenge}${nonce}`,
      `${challenge}:${nonce}`,
      `${challenge}${nonce}${decoded.timestamp || ''}`,
      `${challenge}:${nonce}:${decoded.timestamp || ''}`,
    ];

    for (const input of formats) {
      const hash = await sha256(input);
      if (hash.startsWith('0'.repeat(difficulty))) {
        console.log(`✅ Solved! Nonce: ${nonce} | Format used: ${input.includes(':') ? 'with colon' : 'plain'}`);
        return nonce.toString();
      }
    }
  }

  throw new Error("Failed to solve PoW");
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
