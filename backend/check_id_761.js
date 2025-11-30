import { xiboRequest } from './src/utils/xiboClient.js';

async function checkId() {
    try {
        console.log("Checking ID 761 as LAYOUT...");
        try {
            const layout = await xiboRequest('/layout?layoutId=761', 'GET');
            console.log("Layout Response:", JSON.stringify(layout, null, 2));
        } catch (e) {
            console.log("Error fetching layout:", e.message);
        }

        console.log("\nChecking ID 761 as CAMPAIGN...");
        try {
            const campaign = await xiboRequest('/campaign?campaignId=761', 'GET');
            console.log("Campaign Response:", JSON.stringify(campaign, null, 2));
        } catch (e) {
            console.log("Error fetching campaign:", e.message);
        }

    } catch (error) {
        console.error("General Error:", error);
    }
}

checkId();
