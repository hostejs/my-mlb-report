const axios = require('axios');

exports.handler = async (event, context) => {
  try {
    // Replace this with your actual live feed URL
    const API_URL = 'YOUR_LIVE_FEED_URL'; 
    const response = await axios.get(API_URL);
    const data = response.data;

    const gameData = data.gameData;
    const boxscoreTeams = data.liveData.boxscore.teams;

    // Helper to extract season stats instead of single game stats
    const extractSeasonStats = (playersObj) => {
      return Object.values(playersObj).map(p => {
        const stats = p.seasonStats || {};
        const isPitcher = p.position.code === "1";
        
        const playerEntry = {
          fullName: p.person.fullName,
          jerseyNumber: p.jerseyNumber,
          position: p.position.abbreviation,
          type: isPitcher ? "pitcher" : "batter"
        };

        if (isPitcher) {
          playerEntry.seasonStats = {
            wins: stats.pitching?.wins,
            losses: stats.pitching?.losses,
            era: stats.pitching?.era,
            inningsPitched: stats.pitching?.inningsPitched,
            strikeOuts: stats.pitching?.strikeOuts,
            baseOnBalls: stats.pitching?.baseOnBalls,
            whip: stats.pitching?.whip
          };
        } else {
          playerEntry.seasonStats = {
            avg: stats.batting?.avg,
            hits: stats.batting?.hits,
            runs: stats.batting?.runs,
            homeRuns: stats.batting?.homeRuns,
            rbi: stats.batting?.rbi,
            ops: stats.batting?.ops
          };
        }
        return playerEntry;
      }).filter(p => p.seasonStats && Object.values(p.seasonStats).some(v => v !== undefined));
    };

    const result = {
      gameInfo: {
        status: gameData.status.detailedState,
        venue: gameData.venue.name,
        gameCenterLink: `https://www.mlb.com/gameday/${data.gamePk}`,
        probables: {
          away: gameData.probables?.away?.fullName || "TBD",
          home: gameData.probables?.home?.fullName || "TBD"
        }
      },
      teams: {
        away: {
          name: gameData.teams.away.name,
          record: `${gameData.teams.away.record.wins}-${gameData.teams.away.record.losses}`,
          players: extractSeasonStats(boxscoreTeams.away.players)
        },
        home: {
          name: gameData.teams.home.name,
          record: `${gameData.teams.home.record.wins}-${gameData.teams.home.record.losses}`,
          players: extractSeasonStats(boxscoreTeams.home.players)
        }
      }
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
