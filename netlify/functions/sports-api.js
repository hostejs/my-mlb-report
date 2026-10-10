// netlify/functions/sports-api.js

export const handler = async (event) => {
  const queryParams = event.queryStringParameters || {};
  const { type, ids, startDate, endDate, espnDate } = queryParams;

  console.log("Received request params:", JSON.stringify(queryParams));

  let targetUrl = "";
  let scoreboardPath = "";

  switch (type) {
    case "mlb-teams":
      targetUrl = "https://statsapi.mlb.com/api/v1/teams?sportId=1";
      break;

    case "mlb-schedule":
      targetUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${startDate}&endDate=${endDate}`;
      break;

    case "mlb-pitcher-stats":
      targetUrl = `https://statsapi.mlb.com/api/v1/people?personIds=${ids}&hydrate=stats(group=[pitching],type=[gameLog],startDate=${startDate},endDate=${endDate})`;
      break;

    case "nfl":
      targetUrl =
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
      break;

    case "mlb":
      scoreboardPath = "baseball/mlb";
      break;

    case "nhl":
      scoreboardPath = "hockey/nhl";
      break;

    case "nba":
      scoreboardPath = "basketball/nba";
      break;

    default:
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Invalid or missing API type parameter"
        })
      };
  }

  try {
    if (scoreboardPath) {

      const dateStrings = [
        `dates=${espnDate}`,
        ''
      ];

      const results = await Promise.all(
        dateStrings.map(async (dateString) => {
          const url =
            `https://site.api.espn.com/apis/site/v2/sports/${scoreboardPath}/scoreboard?${dateString}`;

          const response = await fetch(url);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `ESPN request failed for ${dateString} ` +
              `(${response.status} ${response.statusText}): ${errorText}`
            );
          }

          return response.json();
        })
      );

      const [yesterdayData, todayData] = results;
      const eventById = new Map();

      for (const data of results) {
        for (const game of (
          Array.isArray(data.events) ? data.events : []
        )) {
          if (game && game.id != null) {
            eventById.set(String(game.id), game);
          }
        }
      }

      const events = [...eventById.values()].sort((a, b) => {
        const aTime = Date.parse(a.date || "") || 0;
        const bTime = Date.parse(b.date || "") || 0;
        return aTime - bTime;
      });

      const data = {
        ...(todayData || yesterdayData),
        events,
        dayRange: {
          yesterday: dateStrings[0],
          today: dateStrings[1]
        }
      };

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      };
    }

    const response = await fetch(targetUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Upstream API failed (${response.status} ${response.statusText}):`,
        errorText
      );

      return {
        statusCode: response.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: `Upstream error: ${response.statusText}`
        })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Unhandled execution error:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};
