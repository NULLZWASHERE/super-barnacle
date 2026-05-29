export default async function handler(req, res) {
  try {
    // Hardcoded cookies
    const hardcodedCookies = [
      `server_name_session=8e0dd38f9462b98f3c721be61df5a5aa`,
      `key=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MzU3MSIsInVzZXJ0eXBlIjoiZ3Vlc3QiLCJqdGkiOiIxa2dpS1dBY1Jmb1MzV1FyVUdDZ2IiLCJpYXQiOjE3ODAwNzA2NDUsImV4cCI6MTc4MjY2MjY0NX0.uQplBLT2Xp403iir1Us4VkJAVSJQH8RpHD8Wh2XwSMg`
    ].join('; ');

    const url = "https://aureus.wtf/dashboard/gamesjson/?page=1&pageSize=120";

    // First request - may get PoW challenge
    let response = await fetch(url, {
      method: "GET",
      headers: {
        "Cookie": hardcodedCookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://aureus.wtf",
      },
    });

    let text = await response.text();

    // Check if PoW is required
    if (response.status === 403 || text.includes("requiresPow")) {
      try {
        const data = JSON.parse(text);
        if (data.requiresPow && data.challenge) {
          console.log("🔐 PoW challenge received, solving...");

          const solved = await solvePoW(data.challenge);
          
          // Retry with PoW solution
          response = await fetch(url, {
            method: "GET",
            headers: {
              "Cookie": hardcodedCookies,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "application/json",
              "Referer": "https://aureus.wtf",
              "X-PoW-Solution": solved.solution,   // Most common header
              "X-Challenge": data.challenge,
            },
          });

          text = await response.text();
        }
      } catch (e) {
        console.error("PoW parsing error:", e);
      }
    }

    // Forward Set-Cookie if any
    if (response.headers.has("set-cookie")) {
      const setCookies = response.headers.raw()["set-cookie"];
      setCookies.forEach((cookie) => res.setHeader("Set-Cookie", cookie));
    }

    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Invalid JSON from aureus.wtf",
        raw: text.substring(0, 300)
      });
    }
  } catch (err) {
    console.error("wtfgames proxy error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

// ==================== PoW Solver ====================
async function solvePoW(challengeBase64) {
  const challenge = JSON.parse(Buffer.from(challengeBase64, 'base64').toString());

  const { challenge: hashToSolve, difficulty } = challenge;
  const maxAttempts = 500000; // Adjust if needed

  console.log(`Solving PoW with difficulty ${difficulty}...`);

  for (let nonce = 0; nonce < maxAttempts; nonce++) {
    const input = `${hashToSolve}${nonce}`;
    const hash = await sha256(input);

    if (hash.startsWith('0'.repeat(difficulty))) {
      console.log(`✅ PoW solved! Nonce: ${nonce}`);
      return { solution: nonce.toString() };
    }
  }

  throw new Error("PoW solving failed - too hard or max attempts reached");
}

// Simple SHA256 helper
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
