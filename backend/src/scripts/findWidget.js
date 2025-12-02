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

const API_URL = process.env.XIBO_API_URL;
const WIDGET_ID = 14229;

async function findWidget() {
  try {
    console.log("Getting access token...");
    const token = await getAccessToken();
    
    console.log(`Searching for widget ${WIDGET_ID}...`);
    
    // Try to find the playlist containing this widget
    // We don't have a direct "get widget" endpoint, so we search playlists?
    // That's inefficient.
    
    // Maybe we can use the /playlist/widget/data endpoint with GET?
    // It returned 405 (Method Not Allowed).
    
    // Let's try GET /playlist with embed=widgets
    const res = await axios.get(`${API_URL}/playlist`, {
      params: { embed: 'widgets' },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const playlists = res.data;
    console.log(`Fetched ${playlists.length} playlists.`);
    
    let foundWidget = null;
    for (const pl of playlists) {
      if (pl.widgets) {
        const w = pl.widgets.find(w => w.widgetId == WIDGET_ID);
        if (w) {
          foundWidget = w;
          console.log("Found widget in playlist:", pl.playlistId);
          break;
        }
      }
    }
    
    if (foundWidget) {
      console.log("Widget Details:", foundWidget);
    } else {
      console.log("Widget not found in fetched playlists.");
    }

  } catch (error) {
    console.error("Error:", error.message);
  }
}

findWidget();
