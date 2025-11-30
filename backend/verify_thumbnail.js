import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_URL = 'http://localhost:5000/api';
const USERNAME = 'mandeep_basnet';
const PASSWORD = 'mandeep123';
const LAYOUT_ID = 761; // "bella vita"

async function verifyThumbnail() {
    try {
        console.log(`Logging in as ${USERNAME}...`);
        const loginResponse = await axios.post(`${API_URL}/auth/login`, {
            username: USERNAME,
            password: PASSWORD
        });

        const token = loginResponse.data.token;
        console.log('Login successful.');

        console.log(`Fetching thumbnail for Layout ${LAYOUT_ID}...`);
        const response = await axios.get(`${API_URL}/layouts/${LAYOUT_ID}/thumbnail`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer'
        });

        console.log(`Response Status: ${response.status}`);
        console.log(`Content-Type: ${response.headers['content-type']}`);
        console.log(`Content-Length: ${response.data.length} bytes`);

        if (response.status === 200 && response.data.length > 0) {
            const outputPath = path.join(process.cwd(), `thumbnail_${LAYOUT_ID}.png`);
            fs.writeFileSync(outputPath, response.data);
            console.log(`Thumbnail saved to: ${outputPath}`);
        } else {
            console.error('Failed to fetch thumbnail or empty response.');
        }

    } catch (error) {
        console.error('Error:', error.response ? {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data.toString() // Convert buffer to string if possible, or just log status
        } : error.message);
    }
}

verifyThumbnail();
