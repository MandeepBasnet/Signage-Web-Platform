import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function trigger() {
  try {
    // 1. Login
    console.log('Logging in as mandeep_basnet...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'mandeep_basnet',
      password: 'mandeep123'
    });
    const token = loginRes.data.token;
    console.log('Login successful.');

    // 2. Fetch Displays
    console.log('Fetching displays...');
    await axios.get(`${API_URL}/displays`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Fetch request sent.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

trigger();
