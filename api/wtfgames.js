export default async function handler(req, res) {
  try {
    const hardcodedCookies = [
      `server_name_session=8e0dd38f9462b98f3c721be61df5a5aa`,
      `key=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MzU3MSIsInVzZXJ0eXBlIjoiZ3Vlc3QiLCJqdGkiOiIxa2dpS1dBY1Jmb1MzV1FyVUdDZ2IiLCJpYXQiOjE3ODAwNzA2NDUsImV4cCI6MTc4MjY2MjY0NX0.uQplBLT2Xp403iir1Us4VkJAVSJQH8RpHD8Wh2XwSMg`
    ].join('; ');

    const url = "https://aureus.wtf/dashboard/gamesjson/?page=1&pageSize=120";

    const headers = {
      "Cookie": hardcodedCookies,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Referer": "https://aureus.wtf",
    };

    let response = await fetch(url, { method: "GET", headers });
    let text = await response.text();

    // Handle PoW Challenge
    if (response.status === 403 || text.includes("requiresPow")) {
      try {
        const data = JSON.parse(text);
        if (data.requiresPow && data.challenge) {
          console.log("🔐 PoW required, solving...");

          const solution = await solvePoW(data.challenge);

          // Try multiple common header formats
          const powHeaders = {
            ...headers,
            "X-PoW-Solution": solution,
            "X-PoW": solution,
            "X-Challenge": data.challenge,
            "pow-solution": solution,
          };

          response = await fetch(url, { 
            method: "GET", 
            headers: powHeaders 
          });
          text = await response.text();
        }
      } catch (e) {
        console.error("PoW handling error:", e);
      }
    }

    // Forward cookies
    if (response.headers.has("set-cookie")) {
      response.headers.raw()["set-cookie"].forEach(cookie => {
        res.setHeader("Set-Cookie", cookie);
      });
    }

    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Invalid JSON from server",
        raw: text.substring(0, 400)
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

  console.log(`Solving PoW → Difficulty: ${difficulty}`);

  const maxAttempts = 1000000;

  for (let nonce = 0; nonce < maxAttempts; nonce++) {
    const input = `${challenge}${nonce}`;
    const hash = await sha256(input);

    if (hash.startsWith('0'.repeat(difficulty))) {
      console.log(`✅ PoW Solved! Nonce: ${nonce}`);
      return nonce.toString();
    }

    // Progress log every 100k attempts
    if (nonce % 100000 === 0 && nonce > 0) {
      console.log(`Still solving... ${nonce} attempts`);
    }
  }

  throw new Error("Could not solve PoW within attempt limit");
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
