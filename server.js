const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const app = express();
const port = 3000;

// Enable CORS for all routes
app.use(cors());

let rawCoinValue = 0;
let lastUpdated = new Date();

// Function to scrape the coin value
async function scrapeCoinValue() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('https://tikfinity.zerody.one/widget/goal?cid=146&metric=coins');
    await page.waitForSelector('.goalText');

    let coinValue = await page.$eval('.goalText', el => el.textContent.trim());

    // Retry mechanism for unavailable data
    let retries = 0;
    while (coinValue === 'No Data Available' && retries < 10) {
      console.log('Coin value not available yet, retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      coinValue = await page.$eval('.goalText', el => el.textContent.trim());
      retries++;
    }

    // Extract the number, remove commas, and verify it's a number
    const coinAmountString = coinValue.split(' / ')[0].replace(/,/g, '').trim();
    const coinAmount = parseInt(coinAmountString, 10);
    
    if (isNaN(coinAmount)) {
      console.error('Scraped value is not a valid number:', coinAmountString);
      return;
    }

    // Save to the rawCoinValue variable
    rawCoinValue = coinAmount;
    lastUpdated = new Date();
    console.log(`Coin Value updated: ${rawCoinValue}`);

  } catch (error) {
    console.error('Error scraping coin value:', error);
  } finally {
    await browser.close();
  }
}

// New route for the home page
app.get('/', (req, res) => {
  res.send(`
    <h1>Coin Value Proxy Server is Running!</h1>
    <p>Everything is working fine. Visit <a href="/raw_coin_value">/raw_coin_value</a> to fetch the current coin value.</p>
    <p>Or visit <a href="/coin_count">/coin_count</a> to check the remainder.</p>
    <p>Or visit <a href="/necklace_count">/necklace_count</a> to see the necklace count.</p>
  `);
});

// Endpoint to serve the raw coin value
app.get('/raw_coin_value', (req, res) => {
  res.json({ rawCoinValue, lastUpdated });
});

// Endpoint to serve the remainder (coin_count)
app.get('/coin_count', (req, res) => {
  const remainder = rawCoinValue % 2500;
  res.json({ coinCount: remainder });
});

// Endpoint to serve the divisible count (necklace_count)
app.get('/necklace_count', (req, res) => {
  const necklaceCount = Math.floor(rawCoinValue / 2500);
  res.json({ necklaceCount });
});

// Timer to scrape the coin value every 5 seconds
setInterval(scrapeCoinValue, 5000);

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
