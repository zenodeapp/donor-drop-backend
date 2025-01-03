import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
import { bech32m } from "bech32";

dotenv.config();

export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
});

export async function saveTransaction(tx) {
  const query = `
    INSERT INTO donations 
    (transaction_hash, from_address, amount_eth, namada_key, input_message, message, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (transaction_hash) DO NOTHING
    RETURNING *
  `;

  const message = await getTemporaryMessage(tx.from);

  const values = [
    tx.hash,
    tx.from,
    tx.value,
    extractNamadaKey(tx.decodedRawInput),
    tx.decodedRawInput,
    message || getRandomMessage(),
    new Date(tx.timestamp),
  ];

  return pool.query(query, values);
}

// New functions for block tracking
export async function markBlockAsScraped(blockNumber, transactionsFound = 0) {
  const query = `
    INSERT INTO scraped_blocks 
    (block_number, transactions_found, scraped_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (block_number) 
    DO UPDATE SET 
      transactions_found = $2,
      scraped_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return pool.query(query, [blockNumber, transactionsFound]);
}

export async function isBlockScraped(blockNumber) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM scraped_blocks WHERE block_number = $1
    ) as exists
  `;

  const result = await pool.query(query, [blockNumber]);
  return result.rows[0].exists;
}

export async function getLastScrapedBlock() {
  const query = `
    SELECT block_number 
    FROM scraped_blocks 
    ORDER BY block_number DESC 
    LIMIT 1
  `;

  const result = await pool.query(query);
  return result.rows[0]?.block_number || 0; // Return 0 if no blocks have been scraped
}

export function extractNamadaKey(message) {
  try {
    // Find all potential Namada addresses in the message
    const matches = message.matchAll(/tnam[a-zA-Z0-9]+/g);
    if (!matches) return "";

    // Try each match until we find a valid one
    for (const match of matches) {
      const address = match[0];

      // Attempt to decode the address as bech32
      try {
        const decoded = bech32m.decode(address);
        // Check if it's a Namada address (prefix should be 'tnam')
        if (decoded.prefix === "tnam") {
          // If we got here, it's a valid bech32 Namada address
          return address;
        }
      } catch (e) {
        // If bech32 decode fails, continue to next match
        continue;
      }
    }

    // If no valid address found, return empty string
    return "";
  } catch (error) {
    console.error("Error extracting Namada key:", error);
    return "";
  }
}

// Add a utility function to get block scraping stats
export async function getBlockScrapingStats(blockNumber) {
  const query = `
    SELECT 
      block_number,
      transactions_found,
      scraped_at
    FROM scraped_blocks 
    WHERE block_number = $1
  `;

  const result = await pool.query(query, [blockNumber]);
  return result.rows[0];
}

// Optional: Add a function to get recent scraping activity
export async function getRecentScrapingActivity(limit = 10) {
  const query = `
    SELECT 
      block_number,
      transactions_found,
      scraped_at
    FROM scraped_blocks 
    ORDER BY scraped_at DESC 
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
  return result.rows;
}

const donationMessages = [
  "Spreading some love!",
  "Here's to making a difference!",
  "Good vibes only ✨",
  "Because kindness is priceless",
  "Changing the world, one donation at a time 🌍",
  "Crypto for a cause!",
  "Every bit counts 💪",
  "Let's make magic happen 💫",
  "Because we're all in this together!",
  "Doing my part for the future 🌱",
  "You're doing great things, keep it up!",
  "Planting seeds for a better tomorrow 🌳",
  "A little goes a long way 💚",
  "Powering up positive change ⚡️",
  "Supporting the dreamers, the doers, the change-makers!",
  "Every donation tells a story 📖",
  "It's the thought that counts, but I'm donating anyway!",
  "Good karma coming your way ✨",
  "This one's for the greater good!",
  "Here's to creating something beautiful together 💖",
  "A donation today, a better world tomorrow!",
];

function getRandomMessage() {
  const randomIndex = Math.floor(Math.random() * donationMessages.length);
  return donationMessages[randomIndex];
}

// Gets a non-expired message from the temporary_messages table
export async function getTemporaryMessage(from) {
  const query = `
  SELECT message 
  FROM temporary_messages 
  WHERE lower(from_address) = lower($1) 
  AND created_at > NOW() - INTERVAL '10 minutes'
`;
  const result = await pool.query(query, [from]);

  if (result.rows.length > 0) {
    return result.rows[0].message;
  }

  return undefined;
}
