import { xiboRequest } from "../utils/xiboClient.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = "C:\\Users\\sales\\OneDrive\\Desktop\\Signage-Platform\\backend\\.env";
dotenv.config({ path: envPath });

async function getLayoutDetails() {
  try {
    const layoutId = 3677;
    console.log(`Fetching details for layout ${layoutId}...`);
    
    // We need to use the same logic as layoutController to get regions/widgets
    // But for now, just raw Xibo request
    const response = await xiboRequest(
      `/layout?layoutId=${layoutId}&embed=regions,playlists,widgets`,
      "GET"
    );

    let layout = null;
    if (Array.isArray(response)) layout = response[0];
    else if (response.data && Array.isArray(response.data)) layout = response.data[0];
    else layout = response;

    if (!layout) {
      console.log("Layout not found");
      return;
    }

    console.log("Layout:", layout.layout);
    
    if (layout.regions && layout.regions.length > 0) {
      const region = layout.regions[0];
      console.log(`REGION_ID: ${region.regionId}`);
      
      const playlist = region.regionPlaylist || region.playlist;
      if (playlist && playlist.widgets && playlist.widgets.length > 0) {
        console.log(`WIDGET_ID: ${playlist.widgets[0].widgetId}`);
      } else {
        console.log("NO_WIDGETS");
      }
    } else {
      console.log("NO_REGIONS");
    }

  } catch (error) {
    console.error("Error:", error.message);
  }
}

getLayoutDetails();
