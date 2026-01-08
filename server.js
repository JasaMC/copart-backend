import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";  // <-- popravljen import

const app = express();
app.use(express.json());

const APIFY_TOKEN = "TVOJ_APIFY_API_KLJUČ";

app.post("/analyze", async (req, res) => {
  try {
    const { copartUrl } = req.body;

    const apifyUrl =
      `https://api.apify.com/v2/acts/parseforge~copart-public-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

    const copartRes = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startUrls: [{ url: copartUrl }] })
    });

    const copartData = (await copartRes.json())[0];
    if (!copartData) {
      return res.json({ error: "Copart podatkov ni bilo mogoče dobiti" });
    }

    const { make, model, year, estimatedRetailValue, currentBid } = copartData;

    // Avto.net search
    const searchUrl =
      `https://www.avto.net/Ads/results.asp?znamka=${make}&model=${model}&letnikOd=${year}&letnikDo=${year}`;

    const avtoRes = await fetch(searchUrl);
    const html = await avtoRes.text();
    const $ = cheerio.load(html);

    let prices = [];
    $(".ResultsAdPrice").each((i, el) => {
      const p = parseInt($(el).text().replace(/\D/g, ""));
      if (p) prices.push(p);
    });

    const avgSI =
      prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b) / prices.length)
        : null;

    const transport = 1200;
    const homologacija = 450;
    const registracija = 300;
    const ddv = currentBid * 0.22;
    const repair = 2500;

    const total = currentBid + transport + homologacija + registracija + ddv + repair;
    const profit = avgSI !== null ? avgSI - total : null;

    res.json({
      copart: { make, model, year, estimatedRetailValue, currentBid },
      slovenia: { avgPrice: avgSI, listings: prices.length },
      totalCosts: total,
      profit
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.listen(3000, () => console.log("Server running"));

