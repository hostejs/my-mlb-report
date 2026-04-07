const axios = require('axios');

exports.handler = async (event) => {
  const { startDate, endDate } = event.queryStringParameters;
  const url = `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&startDate=${startDate}&endDate=${endDate}`;
  
  try {
    const response = await axios.get(url);
    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return { statusCode: 500, body: error.toString() };
  }
};
