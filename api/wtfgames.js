// api/games.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Hardcoded cookies from your Netscape file
    const cookies = [
      'user_id=6a19c1376d1460cfc5b9124b',
      'session_token=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI2YTE5YzEzNzZkMTQ2MGNmYzViOTEyNGIiLCJyb2xlIjoiRnJlZSIsInVzZXJuYW1lIjoicmVkd2luZyIsImVtYWlsIjoiZGVjYXBzdG9wQGdtYWlsLmNvbSIsInRhZyI6IjcxODciLCJpYXQiOjE3ODAwNzI3NTksImV4cCI6MTc4MDY3NzU1OX0.-KCVWedL_-unlX3qAYx7kxwc43msQkerEcla9UyIUZk',
      '__cf_bm=2xlw9ziDNC5EM9acQGyM7tJqco7p_1BrrgPiUZ5QgP0-1780072758.2590444-1.0.1.1-UsOnbwqJTREvTII2_QFUMJl6JLZaJKjiwYhBwXoJhMkYvd4lG.oYhVihL0aO7gkjgRlxG0kkCXEI0FlgbhGLrgMVOkUA8VrmcDyF.SK0mAe5eih3BT_s7Mc2CsObczvX'
    ].join('; ');

    const targetUrl = "https://serverside.gg/api/games?page=1&limit=30&search=&sortBy=players&sortOrder=desc&plan=all&showLocked=false&_=" + Date.now();

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9,es;q=0.8,ru;q=0.7',
        'authorization': `Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiI2YTE5YzEzNzZkMTQ2MGNmYzViOTEyNGIiLCJyb2xlIjoiRnJlZSIsInVzZXJuYW1lIjoicmVkd2luZyIsImVtYWlsIjoiZGVjYXBzdG9wQGdtYWlsLmNvbSIsInRhZyI6IjcxODciLCJpYXQiOjE3ODAwNzI3NTksImV4cCI6MTc4MDY3NzU1OX0.-KCVWedL_-unlX3qAYx7kxwc43msQkerEcla9UyIUZk`,
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'Cookie': cookies
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: 'Failed to fetch from serverside.gg',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();

    // Transform data to match what your frontend expects
    const transformed = {
      success: true,
      games: (data.games || []).map(game => ({
        name: game.name || "Unknown Game",
        placeId: game.placeId,
        thumbnail: game.thumbUrl || "",
        totalPlayers: game.playerCount || 0,
        currentPlayers: game.playerCount || 0,
        maxPlayers: game.maxPlayers || 0,
        visits: 0, // not provided by this API
        creator: "Unknown", // API doesn't provide creator
        jobIds: (game.servers || []).reduce((acc, server) => {
          if (server.jobId) acc[server.jobId] = server;
          return acc;
        }, {})
      })),
      total: data.total || 0,
      totalPlayers: data.totalPlayers || 0
    };

    return res.status(200).json(transformed);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
