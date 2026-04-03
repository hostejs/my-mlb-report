const fetch = require('node-fetch');

exports.handler = async (event) => {
    const date = event.queryStringParameters.date || new Date().toISOString().split('T')[0];
    const API_ROOT = "https://statsapi.mlb.com"; // Changed from /api/v1 to root to fix pathing

    try {
        // 1. Fetch Schedule
        const schedRes = await fetch(`${API_ROOT}/api/v1/schedule/games/?sportId=1&startDate=${date}&endDate=${date}&hydrate=probablePitcher,linescore,team`);
        const schedData = await schedRes.json();

        if (!schedData.dates?.[0]) return { statusCode: 200, body: JSON.stringify([]) };

        // 2. Map through games
        const games = await Promise.all(schedData.dates[0].games.map(async (game) => {
            // FIX: Content link is already /api/v1/game/ID/content
            const contentRes = await fetch(`${API_ROOT}${game.content.link}`);
            const content = await contentRes.json();

            // SPEC MATCH: Target the 'mlb' object as seen in your content.json
            const recap = content.editorial?.recap?.mlb || {};
            const preview = content.editorial?.preview || {};
            
            const headline = recap.headline || preview.headline || `${game.teams.away.team.name} @ ${game.teams.home.team.name}`;
            const rawBody = recap.body || recap.blurb || preview.body || "No narrative available.";

            return {
                id: game.gamePk,
                status: game.status.detailedState,
                venue: game.venue.name, // Added Venue
                teams: {
                    away: { 
                        name: game.teams.away.team.name, 
                        score: game.teams.away.score ?? 0,
                        record: `${game.teams.away.leagueRecord?.wins || 0}-${game.teams.away.leagueRecord?.losses || 0}`, // Added Records
                        pitcher: game.teams.away.probablePitcher?.fullName || "TBD"
                    },
                    home: { 
                        name: game.teams.home.team.name, 
                        score: game.teams.home.score ?? 0,
                        record: `${game.teams.home.leagueRecord?.wins || 0}-${game.teams.home.leagueRecord?.losses || 0}`, // Added Records
                        pitcher: game.teams.home.probablePitcher?.fullName || "TBD"
                    }
                },
                headline: headline,
                narrative: rawBody.replace(/<[^>]*>?/gm, '').replace(/\n\s*\n/g, '\n').trim()
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
