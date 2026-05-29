// /api/games.js

export default async function handler(req, res) {
  try {
    const response = await fetch(
      "https://aureus.wtf/dashboard/gamesjson/?page=1&pageSize=120",
      {
        method: "GET",
        headers: {
          "accept": "*/*",
          "accept-language": "en-US,en;q=0.9,es;q=0.8,ru;q=0.7",
          "cache-control": "no-cache",
          "pragma": "no-cache",
          "priority": "u=1, i",
          "sec-ch-ua":
            "\"Chromium\";v=\"148\", \"Google Chrome\";v=\"148\", \"Not/A)Brand\";v=\"99\"",
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": "\"Chrome OS\"",
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",

          // update this if it expires
          "x-pow-solution":
            "eyJjaGFsbGVuZ2UiOiIzMmFiMzE0MTcyOTEzMDBkZjAyYWViZmUzOGExZDFmNTRiZDNlYTA0NDUwZGI4MTMzMTVmZWMwZjA1YWM0OTVjIiwibm9uY2UiOjk0MDg3LCJ0aW1lc3RhbXAiOjE3ODAwNzA4MzQyNjZ9"
        },
        referrer: "https://aureus.wtf/dashboard/games/",
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        success: false,
        error: "Invalid JSON returned",
        raw: text
      });
    }

    // optional cleanup / formatting
    const formatted = data.map((game) => ({
      Name: game.Name,
      plrs: game.plrs,
      thumbnail: game.thumbnail,
      maxPlayers: game.maxPlayers,
      creator: game.creator,
      id: game.id,
      jobids: game.jobids || {},
      lastLogged: game.lastLogged,
      Fake: game.Fake,
      jobidsArray: Object.keys(game.jobids || {}),
      premium: game.premium
    }));

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=30");

    return res.status(200).json(formatted);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
