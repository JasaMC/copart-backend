import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ----- serve index.html -----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ----- analyze route -----
app.post("/analyze", async (req, res) => {
  try {
    const { copartUrl, vin } = req.body;
    if (!vin || vin.length < 11) {
      return res.status(400).json({ error: "VIN je obvezen" });
    }

    // --- VIN check ---
    const vinRes = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
    );
    const vinJson = await vinRes.json();
    const get = (name) =>
      vinJson.Results.find((r) => r.Variable === name)?.Value || null;

    const vehicle = {
      vin,
      year: get("Model Year"),
      make: get("Make"),
      model: get("Model"),
      engine: get("Engine Model"),
    };

    // --- Avto.net povprečne cene ---
    let prices = [];
    if (vehicle.make && vehicle.model && vehicle.year) {
      const avtoUrl = `https://www.avto.net/Ads/results.asp?znamka=${vehicle.make}&model=${vehicle.model}&letnikOd=${vehicle.year}&letnikDo=${vehicle.year}`;
      const avtoRes = await fetch(avtoUrl);
      const html = await avtoRes.text();
      const $ = cheerio.load(html);
      $(".ResultsAdPrice").each((i, el) => {
        const p = parseInt($(el).text().replace(/\D/g, ""));
        if (p) prices.push(p);
      });
    }

    const avgPrice =
      prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        : null;

    // --- Stroški ---
    const bid = 4000; // lahko slider kasneje
    const transport = 1200;
    const homologacija = 450;
    const registracija = 300;
    const repair = 2500;
    const ddv = bid * 0.22;
    const totalCosts = bid + transport + homologacija + registracija + repair + ddv;
    const profit = avgPrice !== null ? avgPrice - totalCosts : null;

    res.json({
      vehicle,
      slovenia: { avgPrice, listings: prices.length },
      costs: { bid, transport, homologacija, registracija, repair, ddv, totalCosts },
      profit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Napaka na strežniku" });
  }
});

// ----- start server -----
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
