const axios = require('axios');

exports.handler = async (event) => {
  try {
    // 1. Get Today's Games (or a specific date)
    const date = event.queryStringParameters.date || new Date().toISOString().split('T')[0];
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date=${date}`;
    const scheduleRes = await axios.get(scheduleUrl);
    
    const games = scheduleRes.data.dates[0]?.games || [];

    const simplifiedGames = await Promise.all(games.map(async (game) => {
      // 2. Fetch the Live Feed for each game to get specific player data
      const liveUrl = `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`;
      const liveRes = await axios.get(liveUrl);
      const liveData = liveRes.data;

      // 3. Consolidate and compress down to ONLY what is needed
      return {
        gamePk: game.gamePk,
        venue: liveData.gameData.venue.name, //
        status: liveData.gameData.status.detailedState, //
        teams: {
          away: {
            name: liveData.gameData.teams.away.name,
            record: liveData.gameData.teams.away.record.leagueRecord, //
            probable: liveData.gameData.probables?.away?.fullName || "TBD"
          },
          home: {
            name: liveData.gameData.teams.home.name,
            record: liveData.gameData.teams.home.record.leagueRecord, //
            probable: liveData.gameData.probables?.home?.fullName || "TBD"
          }
        },
        // Extract "Good Players" (e.g., top hitters based on season stats)
        notablePlayers: extractTopPerformers(liveData.liveData.boxscore.teams)
      };
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(simplifiedGames),
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};

// Helper to filter "Good Players" so the frontend stays light
function extractTopPerformers(boxTeams) {
  const allPlayers = [
    ...Object.values(boxTeams.away.players),
    ...Object.values(boxTeams.home.players)
  ];
  
  return allPlayers
    .filter(p => p.seasonStats?.batting?.avg > ".280" || p.seasonStats?.batting?.homeRuns > 15)
    .map(p => ({
      name: p.person.fullName,
      pos: p.position.abbreviation,
      avg: p.seasonStats.batting.avg
    }))
    .slice(0, 3); // Return only top 3 to keep response size down
}
