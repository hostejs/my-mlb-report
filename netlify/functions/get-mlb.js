const fetch = require('node-fetch');

exports.handler = async (event) => {
    const date = event.queryStringParameters.date || new Date().toISOString().split('T')[0];
    const API_ROOT = "https://statsapi.mlb.com"; 

    try {
        const schedRes = await fetch(`${API_ROOT}/api/v1/schedule/games/?sportId=1&startDate=${date}&endDate=${date}&hydrate=probablePitcher,team`);
        const schedData = await schedRes.json();

        if (!schedData.dates?.[0]) return { statusCode: 200, body: JSON.stringify([]) };

        const games = await Promise.all(schedData.dates[0].games.map(async (game) => {
            // 1. Fetch Narrative (JUST for the 1-sentence headline)
            const contentRes = await fetch(`${API_ROOT}${game.content.link}`);
            const content = await contentRes.json();
            const headline = content.editorial?.recap?.mlb?.headline || content.editorial?.preview?.headline || "Game in Progress";

            // 2. Fetch Live Feed (For the deep stats)
            const liveRes = await fetch(`${API_ROOT}/api/v1.1/game/${game.gamePk}/feed/live`);
            const live = await liveRes.json();

            // Helper to extract specific stats from the boxscore
            const parseRoster = (teamType) => {
                const players = live.liveData?.boxscore?.teams?.[teamType]?.players || {};
                return Object.values(players)
                    .filter(p => p.stats.batting.atBats > 0 || p.stats.pitching.inningsPitched > "0.0")
                    .map(p => {
                        const b = p.stats.batting;
                        const pi = p.stats.pitching;
                        const isPitcher = p.position.code === '1';

                        return {
                            name: p.person.fullName,
                            pos: p.position.abbreviation,
                            // Batter Stats: R, H, HR, RBI, AVG
                            ...( !isPitcher && {
                                stats: `R:${b.runs} H:${b.hits} HR:${b.homeRuns} RBI:${b.rbi} AVG:${b.avg}`
                            }),
                            // Pitcher Stats: W-L, K, IP, BB, ERA, SV
                            ...( isPitcher && {
                                stats: `W-L:${pi.wins}-${pi.losses} K:${pi.strikeouts} IP:${pi.inningsPitched} BB:${pi.baseOnBalls} ERA:${pi.era} SV:${pi.saves}`
                            })
                        };
                    });
            };

            return {
                id: game.gamePk,
                headline: headline, // Your "1-sentence" summary
                venue: game.venue.name,
                teams: {
                    away: { 
                        name: game.teams.away.team.name, 
                        score: game.teams.away.score || 0,
                        roster: parseRoster('away')
                    },
                    home: { 
                        name: game.teams.home.team.name, 
                        score: game.teams.home.score || 0,
                        roster: parseRoster('home')
                    }
                }
            };
        }));

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
            body: JSON.stringify(games)
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
