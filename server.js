import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/analyze", async (req, res) => {
  try {
    const { copartUrl } = req.body;

    // --- COPART.DE FETCH ---
    const copartRes = await fetch(copartUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const html = await copartRes.text();
    const $ = cheerio.load(html);

    // Poskusi pobrat osnovne podatke
    const title = $("title").text();

    let year = title.match(/\b(19|20)\d{2}\b/)?.[0] || null;
    let makeModel = title.replace(year, "").replace("Copart", "").trim();

    // Estimated Retail Value (če obstaja)
    let ervText = $("span:contains('Estimated Retail Value')")
      .next()
      .text()
      .replace(/\D/g, "");

    const estimatedRetailValue = ervText ? parseInt(ervText) : null;

    // Trenutna bid cena (če obstaja)
    let bidText = $("span:contains('Current Bid')")
      .next()
      .text()
      .replace(/\D/g, "");

    const currentBid = bidText ? parseInt(bidText) : 0;

    // --- AVTO.NET ---
    const searchUrl = `https://www.avto.net/Ads/results.asp?znamka=&model=&letnikOd=${year}&letnikDo=${year}`;
    const avtoRes = await fetch(searchUrl);
    const avtoHtml = await avtoRes.text();
    const $$ = cheerio.load(avtoHtml);

    let prices = [];
    $$(".ResultsAdPrice").each((i, el) => {
      const p = parseInt($$(el).text().replace(/\D/g, ""));
      if (p) prices.push(p);
    });

    const avgSI =
      prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b) / prices.length)
        : null;

    // --- STROŠKI ---
    const transport = 1200;
    const homologacija = 450;
    const registracija = 300;
    const ddv = currentBid * 0.22;
    const repair = 2500;

    const totalCosts =
      currentBid + transport + homologacija + registracija + ddv + repair;

    const profit = avgSI ? avgSI - totalCosts : null;

    res.json({
      copart: {
        title: title,
        year,
        estimatedRetailValue,
        currentBid
      },
      slovenia: {
        avgPrice: avgSI,
        listings: prices.length
      },
      costs: {
        transport,
        homologacija,
        registracija,
        ddv,
        repair,
        totalCosts
      },
      profit
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server running")
);
