import { createServer } from "http";
import { initialize } from "./lib/init.mjs";

const PORT = process.env.SCRAPER_PORT || 3000;

createServer(async (req, res) => {
  res.statusCode = 200;
  res.end();
}).listen(PORT, async (err) => {
  if (err) {
    console.error("Error starting scraper:", err);
    return;
  }
  console.log(`> Scraper running on http://localhost:${PORT}`);

  // Initialize server
  try {
    await initialize();
  } catch (error) {
    console.error("Failed to initialize scraper:", error);
  }
});
