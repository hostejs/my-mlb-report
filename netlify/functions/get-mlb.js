const axios = require('axios');

exports.handler = async (event) => {
  try {
    // Get date from query string (YYYY-MM-DD) or default to today
    const selectedDate = event.queryStringParameters.date || new Date().toISOString().split('T')[0];
    
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date=${selectedDate}`;
    const scheduleRes = await axios.get(scheduleUrl);
    const games = scheduleRes.data.dates[0]?.games || [];

    const result = await Promise.all(games.map(async (game) => {
      try {
        const liveRes = await axios.get(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
        const liveData = liveRes.data;
        const box = liveData.liveData.boxscore.teams;

        const pullStats = (players) => Object.values(players).map(p => {
            const isP = p.position.code === "1";
            const s = p.seasonStats || {};
            return {
                name: p.person.fullName,
                pos: p.position.abbreviation,
                isPitcher: isP,
                displayStat: isP ? `ERA: ${s.pitching?.era || '-.--'}` : `AVG: ${s.batting?.avg || '.000'}`,
                // Full stats for the AI Dump
                raw: s 
            };
        });

        // Helper to get Pitcher Name + Season Record
        const getPitcherInfo = (type, side) => {
            const person = liveData.gameData.probables?.[side];
            if (!person) return "TBD";
            // Attempt to find the pitcher in the boxscore to get their season W-L
            const playerObj = Object.values(box[side].players).find(p => p.person.id === person.id);
            const record = playerObj?.seasonStats?.pitching ? 
                `(${playerObj.seasonStats.pitching.wins}-${playerObj.seasonStats.pitching.losses}, ${playerObj.seasonStats.pitching.era})` : "";
            return `${person.fullName} ${record}`;
        };

        return {
          gamePk: game.gamePk,
          venue: liveData.gameData.venue.name,
          status: liveData.gameData.status.detailedState,
          teams: {
            away: {
              name: liveData.gameData.teams.away.name,
              record: liveData.gameData.teams.away.record ? `${liveData.gameData.teams.away.record.wins}-${liveData.gameData.teams.away.record.losses}` : "0-0",
              probable: getPitcherInfo('probable', 'away'),
              players: pullStats(box.away.players)
            },
            home: {
              name: liveData.gameData.teams.home.name,
              record: liveData.gameData.teams.home.record ? `${liveData.gameData.teams.home.record.wins}-${liveData.gameData.teams.home.record.losses}` : "0-0",
              probable: getPitcherInfo('probable', 'home'),
              players: pullStats(box.home.players)
            }
          },
          decisions: liveData.liveData.decisions || {}
        };
      } catch (e) { return null; } // Skip broken game feeds
    }));

    return { 
        statusCode: 200, 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.filter(g => g !== null)) 
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
