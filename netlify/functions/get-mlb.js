const axios = require('axios');

exports.handler = async (event) => {
  try {
    const date = event.queryStringParameters.date || new Date().toISOString().split('T')[0];
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date=${date}`;
    const scheduleRes = await axios.get(scheduleUrl);
    const games = scheduleRes.data.dates[0]?.games || [];

    const result = await Promise.all(games.map(async (game) => {
      const liveRes = await axios.get(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
      const liveData = liveRes.data;
      const box = liveData.liveData.boxscore.teams;

      // Helper to grab deep stats for the AI dump
      const pullStats = (players) => Object.values(players).map(p => ({
        name: p.person.fullName,
        pos: p.position.abbreviation,
        stats: p.position.code === "1" ? 
          { era: p.seasonStats?.pitching?.era, whip: p.seasonStats?.pitching?.whip, w: p.seasonStats?.pitching?.wins, l: p.seasonStats?.pitching?.losses } :
          { avg: p.seasonStats?.batting?.avg, ops: p.seasonStats?.batting?.ops, hr: p.seasonStats?.batting?.homeRuns, rbi: p.seasonStats?.batting?.rbi }
      }));

      return {
        gamePk: game.gamePk,
        venue: liveData.gameData.venue.name,
        status: liveData.gameData.status.detailedState,
        teams: {
          away: {
            name: liveData.gameData.teams.away.name,
            record: liveData.gameData.teams.away.record ? 
              `${liveData.gameData.teams.away.record.wins}-${liveData.gameData.teams.away.record.losses}` : "0-0",
            probable: liveData.gameData.probables?.away?.fullName || "TBD",
            players: pullStats(box.away.players)
          },
          home: {
            name: liveData.gameData.teams.home.name,
            record: liveData.gameData.teams.home.record ? 
              `${liveData.gameData.teams.home.record.wins}-${liveData.gameData.teams.home.record.losses}` : "0-0",
            probable: liveData.gameData.probables?.home?.fullName || "TBD",
            players: pullStats(box.home.players)
          }
        },
        decisions: liveData.liveData.decisions || {} // Includes winner/loser for final games
      };
    }));

    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
