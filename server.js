const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const { OBSWebSocket } = require('obs-websocket-js');  // Updated import for OBSWebSocket
const app = express();

const obs = new OBSWebSocket();
const COIN_THRESHOLD = 2500;
const coinValueHtmlFile = '/var/www/html/coin_value.html'; 

// Helper function to read the last saved coin value from the HTML file
const getLastSavedCoinValue = () => {
  if (fs.existsSync(coinValueHtmlFile)) {
    const match = fs.readFileSync(coinValueHtmlFile, 'utf8').match(/<p>(\d+)<\/p>/);
    
    // Check if the value exists and is a valid number
    if (match && !isNaN(match[1])) {
      return parseInt(match[1], 10); // Return as a number
    }
  }

  // If the file is missing or the value is invalid, return 0 and overwrite it
  console.log("Invalid or missing coin value, overwriting with 0.");
  saveCoinValueAsHtml(0);
  return 0;
};

// Helper function to save the coin value as an HTML file
const saveCoinValueAsHtml = (coinValue) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Coin Value</title>
    </head>
    <body>
      <p>${coinValue}</p>
    </body>
    </html>
  `;
  fs.writeFileSync(coinValueHtmlFile, htmlContent, 'utf8');
  console.log(`Coin value saved to HTML file: ${coinValue}`);
};

// Function to trigger OBS to unhide source
const triggerOBS = async () => {
  try {
    console.log("Connecting to OBS WebSocket...");
    await obs.connect('ws://ToxPC.xstarwake.com:4455', 'WakeCrew0BS'); // Updated connection method

    // Get the scene item ID for the source "Noise"
    const sceneItemResponse = await obs.call('GetSceneItemId', {
      sceneName: "Test Scene",  // Replace with your scene name
      sourceName: "Noise"       // Replace with your source name
    });

    const sceneItemId = sceneItemResponse.sceneItemId;
    console.log(`Scene item ID for 'Noise': ${sceneItemId}`);

    // Enable the source
    await obs.call('SetSceneItemEnabled', {
      sceneName: "Test Scene",  // Replace with your scene name
      sceneItemId: sceneItemId,
      sceneItemEnabled: true,  // Unhide the source
    });

    console.log("Source unhidden, waiting 5 seconds...");
    setTimeout(async () => {
      // Disable the source after 5 seconds
      await obs.call('SetSceneItemEnabled', {
        sceneName: "Test Scene",  // Replace with your scene name
        sceneItemId: sceneItemId,
        sceneItemEnabled: false,  // Rehide the source
      });
      console.log("Source rehidden after 5 seconds.");
      await obs.disconnect();  // Disconnect from OBS WebSocket after operation
    }, 5000);
  } catch (error) {
    if (error.code === 300) {
      console.error("OBS WebSocket Error: Bad request. Please check scene and source names.", error);
    } else {
      console.error("Error triggering OBS:", error);
    }
  }
};

// Main index route to show the server is running
app.get('/', (req, res) => {
  res.send(`
    <h1>Coin Value Proxy Server is Running!</h1>
    <p>Everything is working fine. Visit <a href="/get-coin-value">/get-coin-value</a> to fetch the current coin value.</p>
  `);
});

// Route to get coin value and manage the threshold
app.get('/get-coin-value', async (req, res) => {
  try {
    console.log('Received request for coin value');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto('https://tikfinity.zerody.one/widget/goal?cid=146&metric=coins');
    await page.waitForSelector('.goalText');

    let coinValue = await page.$eval('.goalText', el => el.textContent.trim());
    let retries = 0;
    while (coinValue === 'No Data Available' && retries < 10) {
      console.log('Coin value not available yet, retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      coinValue = await page.$eval('.goalText', el => el.textContent.trim());
      retries++;
    }

    const coinAmount = parseInt(coinValue.split(' / ')[0].trim(), 10);
    await browser.close();

    const lastSavedValue = getLastSavedCoinValue();

    if (coinAmount >= COIN_THRESHOLD) {
      console.log("Coin value reached 2500, triggering OBS and resetting value.");
      triggerOBS();
      saveCoinValueAsHtml('0');
    } else if (lastSavedValue !== coinAmount) {
      saveCoinValueAsHtml(coinAmount);
    } else {
      console.log(`Coin value has not changed (${coinAmount})`);
    }

    res.send(`${coinAmount}`);
  } catch (error) {
    console.error('Error during scraping:', error);
    res.status(500).json({ error: 'Failed to scrape coin value' });
  }
});

// Route to manually test the OBS trigger
app.get('/testOBS', async (req, res) => {
  console.log('Received request to manually trigger OBS');
  await triggerOBS();
  res.send('OBS trigger test initiated');
});

// Start the Express server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
