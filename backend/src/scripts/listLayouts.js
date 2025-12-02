import { xiboRequest } from "../utils/xiboClient.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = "C:\\Users\\sales\\OneDrive\\Desktop\\Signage-Platform\\backend\\.env";
console.log("Loading .env from:", envPath);
dotenv.config({ path: envPath });

console.log("XIBO_API_URL:", process.env.XIBO_API_URL);
console.log("XIBO_CLIENT_ID:", process.env.XIBO_CLIENT_ID);

async function listLayouts() {
  try {
    console.log("Fetching layouts from Xibo...");
    const response = await xiboRequest("/layout", "GET");
    
    let layouts = [];
    if (Array.isArray(response)) {
      layouts = response;
    } else if (Array.isArray(response?.data)) {
      layouts = response.data;
    } else if (response?.data) {
      layouts = [response.data];
    }

    console.log(`Found ${layouts.length} layouts.`);
    
    console.log("First 10 layouts:");
    layouts.slice(0, 10).forEach(l => {
        console.log(`ID: ${l.layoutId}, Name: ${l.layout}`);
    });

    const bella = layouts.find(l => l.layout.toLowerCase().includes("bella"));
    if (bella) {
        console.log("\nFound 'bella' layout:", bella.layoutId, bella.layout);
    }

  } catch (error) {
    console.error("Error fetching layouts:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

listLayouts();
