const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const axios = require('axios');  // Use axios to make HTTP requests to OBS
const app = express();

const OBS_URL = 'http://ToxPC.xstarwake.com:4455'; // The OBS WebSocket server URL
const OBS_PASSWORD = 'WakeCrew0BS'; // The OBS WebSocket password
const COIN_THRESHOLD = 2500;
const coinValueHtmlFile = '/var/www/html/coin_value.html'; 

// Helper function to read the last saved coin value from the HTML file
const getLastSavedCoinValue = () => {
  if (fs.existsSync(coinValueHtmlFile)) {
    return fs.readFileSync(coinValueHtmlFile, 'utf8').match(/<p>(\d+)<\/p>/)[1];
  }
  return null;
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
    console.log("Triggering OBS scene...");
    // You need to authenticate and send requests to the OBS WebSocket API.
    await axios.post(`${OBS_URL}/trigger`, {
      password: OBS_PASSWORD,
      requestType: "SetSceneItemEnabled",
      sceneName: "Test Scene",
      sourceName: "Noise",
      visible: true,
    });

    console.log("OBS Source unhidden, waiting 5 seconds...");

    setTimeout(async () => {
      await axios.post(`${OBS_URL}/trigger`, {
        password: OBS_PASSWORD,
        requestType: "SetSceneItemEnabled",
        sceneName: "Test Scene",
        sourceName: "Noise",
        visible: false,
      });
      console.log("OBS Source rehidden after 5 seconds.");
    }, 5000);
  } catch (error) {
    console.error("Error triggering OBS:", error);
  }
};

// Route to manually trigger OBS using /testOBS
app.get('/testOBS', async (req, res) => {
  try {
    console.log('Received request to manually trigger OBS');
    await triggerOBS();  // Call the triggerOBS function
    res.send('OBS trigger has been manually activated.');
  } catch (error) {
    console.error('Error during manual OBS trigger:', error);
    res.status(500).send('Failed to trigger OBS.');
  }
});

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
    while (coinValue === 'No Data Available' && retries < 5) {
      console.log('Coin value not available yet, retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      coinValue = await page.$eval('.goalText', el => el.textContent.trim());
      retries++;
    }

    const coinAmount = parseInt(coinValue.split(' / ')[0].trim(), 10);
    await browser.close();

    const lastSavedValue = parseInt(getLastSavedCoinValue(), 10);

    if (coinAmount >= COIN_THRESHOLD) {
      console.log("Coin value reached 2500, triggering OBS and resetting value.");
      triggerOBS();
      saveCoinValueAsHtml('0');
    } else if (lastSavedValue !== coinAmount) {
      saveCoinValueAsHtml(coinAmount);
    } else {
      console.log(`Coin value has not changed (${coinAmount})`);
    }

    res.send(`${coinAmount} / 2500`);
  } catch (error) {
    console.error('Error during scraping:', error);
    res.status(500).json({ error: 'Failed to scrape coin value' });
  }
});

// Start the Express server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
