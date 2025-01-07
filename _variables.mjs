import dotenv from "dotenv";
dotenv.config();

const ADDRESS = process.env.SCRAPER_ADDRESS;

const START_BLOCK = process.env.SCRAPER_START_BLOCK || "0";

const START_DATE = new Date(
  process.env.SCRAPER_START_DATE || "2024-12-27T15:00:00Z"
);

const END_DATE = new Date(
  process.env.SCRAPER_END_DATE || "2025-01-09T15:00:00Z"
);

const API_KEY = process.env.ETHERSCAN_API_KEY;
const BASE_URL = process.env.ETHERSCAN_BASE_URL || 'https://api-sepolia.etherscan.io/api';

export { ADDRESS, START_BLOCK, START_DATE, END_DATE, API_KEY, BASE_URL };
