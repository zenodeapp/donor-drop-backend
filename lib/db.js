import { Pool } from 'pg';
import dotenv from 'dotenv';
import { bech32m } from 'bech32';

dotenv.config();

export const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: 'localhost',
  port: 5434,
  database: process.env.POSTGRES_DB
});

export async function saveTransaction(tx) {
  const query = `
    INSERT INTO donations 
    (transaction_hash, from_address, amount_eth, namada_key, input_message, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (transaction_hash) DO NOTHING
    RETURNING *
  `;

  const values = [
    tx.hash,
    tx.from,
    tx.value,
    extractNamadaKey(tx.decodedRawInput),
    tx.decodedRawInput,
    new Date(tx.timestamp)
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

function extractNamadaKey(message) {
  try {
    // First find potential Namada address in the message
    const match = message.match(/tnam[a-zA-Z0-9]+/);
    if (!match) return '';
    
    const address = match[0];

    // Attempt to decode the address as bech32
    try {
      const decoded = bech32m.decode(address);
      
      // Check if it's a Namada address (prefix should be 'tnam')
      if (decoded.prefix !== 'tnam') {
        return '';
      }

      // If we got here, it's a valid bech32 Namada address
      return address;
    } catch (e) {
      // If bech32 decode fails, it's not a valid address
      return '';
    }
  } catch (error) {
    console.error('Error extracting Namada key:', error);
    return '';
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
