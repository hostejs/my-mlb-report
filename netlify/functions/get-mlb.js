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

        const processPlayers = (playersObj) => {
          return Object.values(playersObj).map(p => {
            const isPitcher = p.position.code === '1';
            const s = isPitcher ? p.seasonStats?.pitching : p.seasonStats?.hitting;
            const g = p.stats?.[isPitcher ? 'pitching' : 'hitting'] || {};

            const base = {
              fullName: p.person.fullName,
              position: p.position.abbreviation,
              jerseyNumber: p.jerseyNumber,
              gameNote: g.note || "",
              gameSummary: g.summary || ""
            };

            if (isPitcher) {
              base.pitchingStats = {
                gamesPlayed: s?.gamesPlayed || 0,
                gamesStarted: s?.gamesStarted || 0,
                strikeOuts: s?.strikeOuts || 0,
                era: s?.era || "-.--",
                inningsPitched: s?.inningsPitched || "0.0",
                wins: s?.wins || 0,
                losses: s?.losses || 0,
                saves: s?.saves || 0,
                gamesPitched: s?.gamesPitched || 0,
                completeGames: s?.completeGames || 0,
                shutouts: s?.shutouts || 0,
                strikeoutWalkRatio: s?.strikeoutWalkRatio || "-.--",
                strikeoutsPer9Inn: s?.strikeoutsPer9Inn || "-.--",
                runsScoredPer9: s?.runsScoredPer9 || "-.--"
              };
            } else {
              base.hittingStats = {
                gamesPlayed: s?.gamesPlayed || 0,
                hits: s?.hits || 0,
                runs: s?.runs || 0,
                homeRuns: s?.homeRuns || 0,
                avg: s?.avg || ".000",
                slg: s?.slg || ".000",
                rbi: s?.rbi || 0
              };
            }
            return base;
          });
        };

        const getPitcherLabel = (id) => {
          if (!id) return null;
          const p = { ...box.away.players, ...box.home.players }[`ID${id}`];
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
              win: decisions.winner?.id === liveData.gameData.teams.away.id ? getPitcherLabel(decisions.winner.id) : null,
              loss: decisions.loser?.id === liveData.gameData.teams.away.id ? getPitcherLabel(decisions.loser.id) : null,
              save: decisions.save?.id && box.away.players[`ID${decisions.save.id}`] ? getPitcherLabel(decisions.save.id) : null,
              players: processPlayers(box.away.players)
            },
            home: {
              name: liveData.gameData.teams.home.name,
              record: liveData.gameData.teams.home.record ? `${liveData.gameData.teams.home.record.wins}-${liveData.gameData.teams.home.record.losses}` : "0-0",
              win: decisions.winner?.id === liveData.gameData.teams.home.id ? getPitcherLabel(decisions.winner.id) : null,
              loss: decisions.loser?.id === liveData.gameData.teams.home.id ? getPitcherLabel(decisions.loser.id) : null,
              save: decisions.save?.id && box.home.players[`ID${decisions.save.id}`] ? getPitcherLabel(decisions.save.id) : null,
              players: processPlayers(box.home.players)
            }
          }
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
