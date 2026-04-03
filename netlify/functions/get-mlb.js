const fetch = require('node-fetch');

exports.handler = async (event) => {
    const date = event.queryStringParameters.date;
    const API_BASE = "https://statsapi.mlb.com/api/v1";

    try {
        // 1. Fetch Schedule with Linescore
        const schedRes = await fetch(`${API_BASE}/schedule/games/?sportId=1&startDate=${date}&endDate=${date}&hydrate=probablePitcher,linescore,team`);
        const schedData = await schedRes.json();

        if (!schedData.dates?.[0]) return { statusCode: 200, body: JSON.stringify([]) };

        // 2. Process all games concurrently
        const games = await Promise.all(schedData.dates[0].games.map(async (game) => {
            const contentRes = await fetch(`${API_BASE}${game.content.link}`);
            const content = await contentRes.json();

            // PATH SPEC: Based on your uploaded content.json
            const recap = content.editorial?.recap?.mlb || {};
            const preview = content.editorial?.preview || {};
            
            // Priority: Recap Headline -> Preview Headline -> Default
            const headline = recap.headline || preview.headline || `${game.teams.away.team.name} @ ${game.teams.home.team.name}`;
            
            // Priority: Recap Body -> Recap Blurb -> Preview Body
            const rawBody = recap.body || recap.blurb || preview.body || "No detailed narrative available.";

            return {
                id: game.gamePk,
                status: game.status.detailedState,
                teams: {
                    away: { 
                        name: game.teams.away.team.name, 
                        score: game.teams.away.score ?? 0,
                        pitcher: game.teams.away.probablePitcher?.fullName || "TBD"
                    },
                    home: { 
                        name: game.teams.home.team.name, 
                        score: game.teams.home.score ?? 0,
                        pitcher: game.teams.home.probablePitcher?.fullName || "TBD"
                    }
                },
                headline: headline,
                // Strip HTML tags and clean up whitespace
                narrative: rawBody.replace(/<[^>]*>?/gm, '').replace(/\n\s*\n/g, '\n').trim()
            };
        }));

        return {
            statusCode: 200,
            headers: { 
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json" 
            },
            body: JSON.stringify(games)
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
