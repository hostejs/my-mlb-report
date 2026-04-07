const axios = require('axios');

exports.handler = async (event) => {
  const { gamePk } = event.queryStringParameters;
  const url = `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`;
  
  try {
    const response = await axios.get(url);
    const liveData = response.data.liveData;
    
    // We return the relevant nodes to minimize frontend parsing
    return {
      statusCode: 200,
      body: JSON.stringify({
        boxscore: liveData.boxscore,
        plays: liveData.plays // For the "summary/note" requested
      })
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
