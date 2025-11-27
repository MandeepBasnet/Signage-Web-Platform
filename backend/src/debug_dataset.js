import axios from 'axios';
import qs from 'qs';

const API_URL = 'http://localhost:5000/api';

async function test() {
  try {
    // 1. Login
    console.log("Logging in...");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'mandeep_basnet', // Using credentials from previous context if available, or generic
      password: 'mandeep123'
    });
    const token = loginRes.data.token;
    console.log("Login successful. Token:", token ? "Yes" : "No");

    // 2. Get Datasets
    console.log("Fetching datasets...");
    try {
        const res = await axios.get(`${API_URL}/datasets`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Status:", res.status);
        console.log("Response Data Type:", typeof res.data);
        console.log("Response Data Keys:", Object.keys(res.data));
        if (res.data.data && Array.isArray(res.data.data)) {
            console.log("Number of datasets:", res.data.data.length);
            if (res.data.data.length > 0) {
                console.log("First dataset:", JSON.stringify(res.data.data[0], null, 2));
            }
        } else {
            console.log("Response Data (preview):", JSON.stringify(res.data, null, 2).substring(0, 500));
        }
    } catch (err) {
        console.error("Error fetching datasets:", err.response?.status, err.response?.data);
    }

  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
  }
}

test();
