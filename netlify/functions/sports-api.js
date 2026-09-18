// netlify/functions/sports-api.js

export const handler = async (event) => {
  // 1. Safely parse incoming query parameters first
  const queryParams = event.queryStringParameters || {};
  const { type, ids, startDate, endDate, season, sport, dates } = queryParams;

  console.log("Received request params:", JSON.stringify(queryParams));
  
  let targetUrl = '';

  // Route the request to the correct upstream API
  switch (type) {
    case 'mlb-teams':
      targetUrl = 'https://statsapi.mlb.com/api/v1/teams?sportId=1';
      break;
    case 'mlb-schedule':
      targetUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=probablePitcher&startDate=${startDate}&endDate=${endDate}`;
      break;
    case 'mlb-pitcher-stats':
      targetUrl = `https://statsapi.mlb.com/api/v1/people?personIds=${ids}&hydrate=stats(group=[pitching],type=[byDateRange],startDate=${startDate},endDate=${endDate},season=${season})`;
      break;
    case 'espn-scoreboard':
      if (sport === 'football/nfl') {
        targetUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
      } else {
        targetUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}/scoreboard?dates=${dates}`;
      }
      break;
    default:
      console.warn(`[400] Invalid or missing type parameter: "${type}"`);
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Invalid or missing API type parameter' }) 
      };
  }

  try {
    const response = await fetch(targetUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Upstream API failed (${response.status} ${response.statusText}):`, errorText);
      return {
        statusCode: response.status, 
        body: JSON.stringify({ error: `Upstream error: ${response.statusText}` }) 
      };
    }
    
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*', // Allows your front-end to request this data
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error("Unhandled execution error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
