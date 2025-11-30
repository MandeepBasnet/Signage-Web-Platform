import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function test() {
  try {
    console.log('1. Logging in as mandeep_basnet...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: 'mandeep_basnet',
      password: 'mandeep123'
    });

    const token = loginRes.data.token;
    const userId = loginRes.data.user.userId;
    console.log(`   Login successful. Token: ${token.substring(0, 20)}...`);
    console.log(`   User ID: ${userId}`);

    // console.log('\n2. Fetching User Info (/user/me)...');
    // const meRes = await axios.get(`${API_URL}/auth/login`, { ... }); 

    
    // Let's just update the display fetch to show full object
    console.log('\n2. Fetching Displays...');
    const displayRes = await axios.get(`${API_URL}/displays`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // The controller is currently filtering and returning 0.
    // I need to modify the controller to RETURN the raw data for debugging, 
    // OR I need to rely on the server logs I added.
    // The server logs showed "Sample display [0] permissions: { id: 226, ownerId: undefined, groupsWithPermissions: null }"
    // This confirms ownerId is undefined and groupsWithPermissions is null.
    
    // So I need to find out WHY they are missing.
    // Maybe I need to use 'permissions' instead of 'groupsWithPermissions'?
    // Or maybe 'ownerId' is not in the response?
    
    // I will try to fetch displays WITHOUT filtering in the controller to see the full object in the frontend/response.
    // But I can't easily change the controller back and forth.
    
    // I will modify the test script to call the XIBO API directly?
    // No, I can't access Xibo API directly from here (it's likely behind a firewall or I don't have credentials handy for the script, 
    // although I do have client_id/secret in .env which I can't see).
    
    // I will modify the controller to log the ENTIRE display object, not just selected fields.


  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

test();
