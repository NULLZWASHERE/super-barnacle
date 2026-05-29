export default async function handler(req, res) {
  try {
    // Hardcoded cookies (from your Netscape cookie file)
    const hardcodedCookies = [
      `server_name_session=8e0dd38f9462b98f3c721be61df5a5aa`,
      `key=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI0MzU3MSIsInVzZXJ0eXBlIjoiZ3Vlc3QiLCJqdGkiOiIxa2dpS1dBY1Jmb1MzV1FyVUdDZ2IiLCJpYXQiOjE3ODAwNzA2NDUsImV4cCI6MTc4MjY2MjY0NX0.uQplBLT2Xp403iir1Us4VkJAVSJQH8RpHD8Wh2XwSMg`
    ].join('; ');

    const response = await fetch("https://aureus.wtf/dashboard/gamesjson/?page=1&pageSize=120", {
      method: "GET",
      headers: {
        "Cookie": hardcodedCookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Referer": "https://aureus.wtf",
      },
    });

    // Forward any Set-Cookie headers from the backend
    if (response.headers.has("set-cookie")) {
      const setCookies = response.headers.raw()["set-cookie"];
      setCookies.forEach((cookie) => {
        res.setHeader("Set-Cookie", cookie);
      });
    }

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return res.status(response.status).json(data);
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: "Invalid JSON returned from aureus.wtf",
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
