const axios = require('axios');

exports.handler = async (event) => {
  try {
    const selectedDate = event.queryStringParameters.date || new Date().toISOString().split('T')[0];
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date=${selectedDate}`;
    const scheduleRes = await axios.get(scheduleUrl);
    const games = scheduleRes.data.dates[0]?.games || [];

    const result = await Promise.all(games.map(async (game) => {
      try {
        const liveRes = await axios.get(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
        const liveData = liveRes.data;
        const box = liveData.liveData.boxscore.teams;
        const decisions = liveData.liveData.decisions || {};

        // Helper to get specific pitcher details for Win/Loss/Save
        const getDecisionPitcher = (id) => {
            if (!id) return null;
            // Search through both teams for the player
            const allPlayers = { ...box.away.players, ...box.home.players };
            const p = allPlayers[`ID${id}`];
            if (!p) return "Unknown";
            const s = p.seasonStats?.pitching || {};
            return `${p.person.fullName} (${s.wins || 0}-${s.losses || 0}, ${s.era || '-.--'})`;
        };

        return {
          gamePk: game.gamePk,
          venue: liveData.gameData.venue.name,
          status: liveData.gameData.status.detailedState,
          scores: {
            away: liveData.liveData.linescore.teams.away.runs || 0,
            home: liveData.liveData.linescore.teams.home.runs || 0
          },
          teams: {
            away: {
              name: liveData.gameData.teams.away.name,
              record: liveData.gameData.teams.away.record ? `${liveData.gameData.teams.away.record.wins}-${liveData.gameData.teams.away.record.losses}` : "0-0",
              decisionPitcher: getDecisionPitcher(decisions.winner?.id === liveData.gameData.teams.away.id ? decisions.winner.id : (decisions.loser?.id === liveData.gameData.teams.away.id ? decisions.loser.id : null)),
              isWinner: decisions.winner?.id === liveData.gameData.teams.away.id,
              isLoser: decisions.loser?.id === liveData.gameData.teams.away.id,
              save: decisions.save?.id && Object.keys(box.away.players).includes(`ID${decisions.save.id}`) ? getDecisionPitcher(decisions.save.id) : null
            },
            home: {
              name: liveData.gameData.teams.home.name,
              record: liveData.gameData.teams.home.record ? `${liveData.gameData.teams.home.record.wins}-${liveData.gameData.teams.home.record.losses}` : "0-0",
              decisionPitcher: getDecisionPitcher(decisions.winner?.id === liveData.gameData.teams.home.id ? decisions.winner.id : (decisions.loser?.id === liveData.gameData.teams.home.id ? decisions.loser.id : null)),
              isWinner: decisions.winner?.id === liveData.gameData.teams.home.id,
              isLoser: decisions.loser?.id === liveData.gameData.teams.home.id,
              save: decisions.save?.id && Object.keys(box.home.players).includes(`ID${decisions.save.id}`) ? getDecisionPitcher(decisions.save.id) : null
            }
          },
          // Keep raw for the diagnostic textarea
          raw: liveData 
        };
      } catch (e) { return null; }
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
