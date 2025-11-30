import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const USERNAME = 'mandeep_basnet';
const PASSWORD = 'mandeep123';

async function checkId() {
    try {
        console.log(`Logging in...`);
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: USERNAME,
            password: PASSWORD
        });
        const token = loginResponse.data.token;

        console.log('Checking ID 761 as Layout...');
        try {
            const layoutResponse = await axios.get(`${API_URL}/layouts/761`, { // Using my backend proxy if available, or direct Xibo if possible. 
                // My backend might not have a direct /layouts/{id} proxy.
                // Let's use the Xibo proxy endpoint if I built one, or just use the generic xiboRequest if I can access it.
                // Since I am external, I have to use the backend's API.
                // I don't think I have a generic proxy.
                // I'll use the /displays endpoint to see if I can infer anything, OR
                // I'll use the fact that I am running this on the server environment (conceptually).
                // Wait, I can use the `trigger_display_fetch.js` style to import the backend functions directly!
            });
        } catch (e) {
             // console.log("Failed as layout via proxy (expected if no route)");
        }
        
        // Actually, better to use the internal backend code to check Xibo directly.
    } catch (error) {
        console.error(error);
    }
}
// checkId();
