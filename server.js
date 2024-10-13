const puppeteer = require('puppeteer');
const express = require('express');
const fs = require('fs');
const app = express();

// File path where the coin value will be stored as HTML
const coinValueHtmlFile = '/var/www/html/coin_value.html';  // Assuming a default web root for Ubuntu

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
      <h1>Coin Value</h1>
      <p>${coinValue}</p>
    </body>
    </html>
  `;

  fs.writeFile(coinValueHtmlFile, htmlContent, 'utf8', (err) => {
    if (err) {
      console.error(`Failed to write file: ${err.message}`);
    } else {
      console.log(`Coin value saved to HTML file: ${coinValue}`);
    }
  });
};

// Main index route to show the server is running
app.get('/', (req, res) => {
  res.send(`
    <h1>Coin Value Proxy Server is Running!</h1>
    <p>Everything is working fine. Visit <a href="/get-coin-value">/get-coin-value</a> to fetch the current coin value.</p>
  `);
});

console.log('Starting server...');  // Initial log to confirm server is starting

app.get('/get-coin-value', async (req, res) => {
  try {
    console.log('Received request for coin value');  // Log when a request is received
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    console.log('Launched Puppeteer');  // Log Puppeteer launch
    const page = await browser.newPage();
    console.log('Opened a new page');  // Log page open
    await page.goto('https://tikfinity.zerody.one/widget/goal?cid=146&metric=coins');
    console.log('Navigated to the coin goal page');  // Log navigation

    // Wait for the goalText div to load
    await page.waitForSelector('.goalText');
    console.log('Found goalText element');  // Log when the element is found

    // Check and wait for the value to update from 'No Data Available'
    let coinValue = await page.$eval('.goalText', el => el.textContent.trim());
    let retries = 0;
    while (coinValue === 'No Data Available' && retries < 5) {  // Retry up to 5 times
      console.log('Coin value not available yet, retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));  // Wait for 1 second before checking again
      coinValue = await page.$eval('.goalText', el => el.textContent.trim());
      retries++;
    }

    console.log('Extracted coin value: ' + coinValue);  // Log the extracted value

    // Split the coin value to get the number before ' / '
    const coinAmount = coinValue.split(' / ')[0].trim();
    console.log('Coin amount before the slash: ' + coinAmount);  // Log the split coin amount

    await browser.close();
    console.log('Closed Puppeteer');  // Log when Puppeteer closes

    // Check if the value has changed, and only overwrite if it's different
    const lastSavedValue = getLastSavedCoinValue();
    if (lastSavedValue !== coinAmount) {
      console.log(`Coin value has changed from ${lastSavedValue} to ${coinAmount}`);
      saveCoinValueAsHtml(coinAmount);  // Save the new value as an HTML file
    } else {
      console.log(`Coin value has not changed (${coinAmount})`);
    }

    // Send the coin amount back as plain text
    res.send(coinAmount);
    console.log('Sent response with coin amount');  // Log when response is sent
  } catch (error) {
    console.error('Error during scraping:', error);  // Log any error during the process
    res.status(500).json({ error: 'Failed to scrape coin value' });
  }
});

// Start the Express server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);  // Log when the server is running
});
