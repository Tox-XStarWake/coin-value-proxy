const puppeteer = require('puppeteer');
const express = require('express');
const app = express();

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
    while (coinValue === 'No Data Available' && retries < 10) {  // Retry up to 10 times
      console.log('Coin value not available yet, retrying...');
      await page.waitForTimeout(1000);  // Wait for 1 second before checking again
      coinValue = await page.$eval('.goalText', el => el.textContent.trim());
      retries++;
    }

    console.log('Extracted coin value: ' + coinValue);  // Log the extracted value
    await browser.close();
    console.log('Closed Puppeteer');  // Log when Puppeteer closes

    // Send the coin value back as a JSON response
    res.json({ coinValue });
    console.log('Sent response with coin value');  // Log when response is sent
  } catch (error) {
    console.error('Error during scraping:', error);  // Log any error during the process
    res.status(500).json({ error: 'Failed to scrape coin value' });
  }
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);  // Log when the server is running
});
