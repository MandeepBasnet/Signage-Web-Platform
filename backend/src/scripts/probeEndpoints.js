import axios from "axios";
import { getAccessToken } from "../utils/xiboClient.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = "C:\\Users\\sales\\OneDrive\\Desktop\\Signage-Platform\\backend\\.env";
dotenv.config({ path: envPath });

const API_URL = process.env.XIBO_API_URL;
const REGION_ID = 12145;
const WIDGET_ID = 14229;

// Helper to log to file
const logFile = path.resolve(__dirname, "../../probe_results.txt");
function log(message) {
  console.log(message);
  fs.appendFileSync(logFile, message + "\n");
}
fs.writeFileSync(logFile, "");

async function probe() {
  try {
    log("Getting access token...");
    const token = await getAccessToken();
    log("Token obtained.");

    log(`Using Xibo API URL: ${API_URL}`);

    const endpoints = [
      `/clock`, // Known working endpoint
      `/about`, // Known working endpoint
      `/region/preview/${REGION_ID}`,
      `/region/${REGION_ID}/preview`,
      `/layout/region/preview/${REGION_ID}`,
      `/playlist/widget/resource/${REGION_ID}/${WIDGET_ID}`,
      `/widget/preview/${WIDGET_ID}`,
      `/playlist/widget/${WIDGET_ID}/preview`,
      `/playlist/widget/data/${WIDGET_ID}`
    ];

    for (const endpoint of endpoints) {
      log(`\nProbing: ${endpoint}`);
      try {
        const res = await axios.get(`${API_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        log(`✅ STATUS: ${res.status}`);
        log(`   Type: ${res.headers['content-type']}`);
      } catch (err) {
        log(`❌ STATUS: ${err.response?.status || err.message}`);
        if (err.response?.data) {
             log(`   Error Data: ${JSON.stringify(err.response.data)}`);
        }
      }
    }

  } catch (error) {
    log(`Probe failed: ${error.message}`);
  }
}

probe();
