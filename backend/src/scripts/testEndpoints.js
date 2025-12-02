import axios from "axios";
import { getAccessToken } from "../utils/xiboClient.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = "C:\\Users\\sales\\OneDrive\\Desktop\\Signage-Platform\\backend\\.env";
dotenv.config({ path: envPath });

const API_URL = "http://localhost:5000/api";
const REGION_ID = 12145;
const WIDGET_ID = 14229;

import fs from "fs";

// Helper to log to file
const logFile = path.resolve(__dirname, "../../test_results.txt");
function log(message) {
  console.log(message);
  fs.appendFileSync(logFile, message + "\n");
}

// Clear log file
fs.writeFileSync(logFile, "");

async function testEndpoints() {
  try {
    log("Getting access token...");
    const token = await getAccessToken();
    log("Token obtained.");

    // Test Region Preview
    log("\nTesting Region Preview...");
    try {
      const regionRes = await axios.get(`${API_URL}/regions/preview/${REGION_ID}`, {
        params: { width: 200, height: 200 },
        headers: { Authorization: `Bearer ${token}` }
      });
      log(`✅ Region Preview Status: ${regionRes.status}`);
      log(`   Content Type: ${regionRes.headers['content-type']}`);
      log(`   Data Length: ${JSON.stringify(regionRes.data).length}`);
    } catch (err) {
      log(`❌ Region Preview Failed: ${err.message}`);
      if (err.response) log(JSON.stringify(err.response.data, null, 2));
    }

    // Test Widget Resource
    log("\nTesting Widget Resource...");
    try {
      const widgetRes = await axios.get(`${API_URL}/widgets/resource/${REGION_ID}/${WIDGET_ID}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      log(`✅ Widget Resource Status: ${widgetRes.status}`);
      log(`   Content Type: ${widgetRes.headers['content-type']}`);
      log(`   X-Frame-Options: ${widgetRes.headers['x-frame-options']}`);
      log(`   Data Length: ${widgetRes.data.length}`);
    } catch (err) {
      log(`❌ Widget Resource Failed: ${err.message}`);
      if (err.response) log(JSON.stringify(err.response.data, null, 2));
    }

  } catch (error) {
    log(`Test failed: ${error.message}`);
  }
}

testEndpoints();
