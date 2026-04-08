const axios = require('axios');

exports.handler = async (event) => {
  // teamId is required to know which side of the boxscore to prune
  const { gamePk, teamId } = event.queryStringParameters;
  const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;

  try {
    const response = await axios.get(url);
    const boxscore = response.data.liveData.boxscore;
    
    // Determine if the requested team is 'home' or 'away'
    const isHome = boxscore.teams.home.team.id.toString() === teamId;
    const teamData = isHome ? boxscore.teams.home : boxscore.teams.away;
    const players = teamData.players;

    // Minimalist mapping of player data
    const minimalPlayers = Object.values(players).map(p => {
      const isPitcher = p.position.abbreviation === 'P';
      const stats = p.seasonStats || {};
      
      const baseInfo = {
        fullName: p.person.fullName,
        jerseyNumber: p.jerseyNumber,
        position: p.position.abbreviation,
        // Game-specific notes requested
        note: p.stats?.note || "",
        summary: p.stats?.summary || ""
      };

      if (isPitcher) {
        const s = stats.pitching || {};
        baseInfo.pitching = {
          era: s.era,
          inningsPitched: s.inningsPitched,
          wins: s.wins,
          losses: s.losses,
          saves: s.saves,
          completeGames: s.completeGames,
          shutouts: s.shutouts,
          gamesPlayed: s.gamesPlayed,
          gamesStarted: s.gamesStarted,
          strikeOuts: s.strikeOuts,
          whip: s.whip,
          k9: s.strikeoutsPer9Inn
        };
      } else {
        const s = stats.batting || {};
        baseInfo.batting = {
          gamesPlayed: s.gamesPlayed,
          hits: s.hits,
          homeruns: s.homeRuns,
          avg: s.avg,
          rbi: s.rbi
        };
      }

      return baseInfo;
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamName: teamData.team.name,
        players: minimalPlayers        
      })
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.toString() }) 
    };
  }
};
