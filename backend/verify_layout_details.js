import axios from 'axios';

const API_URL = 'http://localhost:5000/api';
const USERNAME = 'mandeep_basnet';
const PASSWORD = 'mandeep123';
const LAYOUT_ID = 761; // "bella vita"

async function verifyLayoutDetails() {
    try {
        console.log(`Logging in as ${USERNAME}...`);
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: USERNAME,
            password: PASSWORD
        });

        const token = loginResponse.data.token;
        console.log('Login successful.');

        console.log(`Fetching details for Layout ${LAYOUT_ID}...`);
        const response = await axios.get(`${API_URL}/layouts/${LAYOUT_ID}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const layout = response.data.layout;
        console.log(`Layout Fetched: ${layout.layout} (${layout.width}x${layout.height})`);
        
        if (layout.regions && layout.regions.length > 0) {
            console.log(`Regions Found: ${layout.regions.length}`);
            layout.regions.forEach(region => {
                console.log(` - Region ${region.regionId}: ${region.width}x${region.height} at (${region.left}, ${region.top})`);
                if (region.widgets && region.widgets.length > 0) {
                    console.log(`   Widgets: ${region.widgets.length}`);
                    region.widgets.forEach(w => console.log(`    * ${w.moduleName} - ${w.name || 'Untitled'}`));
                } else {
                    console.log(`   No widgets.`);
                }
            });
        } else {
            console.log('No regions found.');
        }

    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

verifyLayoutDetails();
