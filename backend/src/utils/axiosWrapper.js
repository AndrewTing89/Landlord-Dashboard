const axios = require('axios');

// Wrapper to catch and log Invalid URL errors
const axiosWrapper = {
  async get(url, config) {
    try {
      return await axios.get(url, config);
    } catch (error) {
      if (error.code === 'ERR_INVALID_URL') {
        console.error('[AXIOS GET] Invalid URL error:');
        console.error('- URL:', url);
        console.error('- Error:', error.message);
        console.error('- Stack:', new Error().stack);
      }
      throw error;
    }
  },
  
  async post(url, data, config) {
    try {
      return await axios.post(url, data, config);
    } catch (error) {
      if (error.code === 'ERR_INVALID_URL') {
        console.error('[AXIOS POST] Invalid URL error:');
        console.error('- URL:', url);
        console.error('- Error:', error.message);
        console.error('- Stack:', new Error().stack);
      }
      throw error;
    }
  }
};

module.exports = axiosWrapper;