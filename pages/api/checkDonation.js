import dotenv from 'dotenv';
import { Pool } from 'pg';
dotenv.config();

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: 'localhost',
    port: 5434,
    database: process.env.POSTGRES_DB
  });

async function findCutoffTimestamp() {
  const query = 'SELECT cutoff_timestamp FROM donation_stats';
  
  try {
    const result = await pool.query(query);
    return result.rows[0]?.cutoff_timestamp || null;
  } catch (error) {
    console.error('Error finding cutoff timestamp:', error);
    throw error;
  }
}

async function checkDonation(ethAddress, namAddress) {
  try {
    // Query to get both total and eligible donations by ETH address

    const cutoffTimestamp = await findCutoffTimestamp();
    // Query to get both total and eligible donations by ETH address
    const ethQuery = `
      WITH address_total AS (
        SELECT 
          COALESCE(SUM(amount_eth), 0) as total_eth,
          CASE 
            WHEN SUM(CASE WHEN timestamp <= $2 THEN amount_eth ELSE 0 END) >= 0.03 
            THEN LEAST(SUM(CASE WHEN timestamp <= $2 THEN amount_eth ELSE 0 END), 0.3)
            ELSE 0
          END as eligible_eth
        FROM donations 
        WHERE from_address = $1
      )
      SELECT total_eth, eligible_eth FROM address_total
    `;

    // Query to get both total and eligible donations by Namada address
    const namQuery = `
      WITH address_total AS (
        SELECT 
          COALESCE(SUM(amount_eth), 0) as total_eth,
          CASE 
            WHEN SUM(CASE WHEN timestamp <= $2 THEN amount_eth ELSE 0 END) >= 0.03 
            THEN LEAST(SUM(CASE WHEN timestamp <= $2 THEN amount_eth ELSE 0 END), 0.3)
            ELSE 0
          END as eligible_eth
        FROM donations 
        WHERE namada_key = $1
      )
      SELECT total_eth, eligible_eth FROM address_total
    `;

    // Execute both queries in parallel with cutoff timestamp
    const [ethResult, namResult] = await Promise.all([
      pool.query(ethQuery, [ethAddress.toLowerCase(), cutoffTimestamp || 'infinity']),
      pool.query(namQuery, [namAddress, cutoffTimestamp || 'infinity'])
    ]);

    return {
      ethAddress: {
        total: parseFloat(ethResult.rows[0].total_eth),
        eligible: parseFloat(ethResult.rows[0].eligible_eth)
      },
      namadaAddress: {
        total: parseFloat(namResult.rows[0].total_eth),
        eligible: parseFloat(namResult.rows[0].eligible_eth)
      },
      cutoffTimestamp: cutoffTimestamp
    };
  } catch (error) {
    console.error('Error checking donations:', error);
    throw error;
  }
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { ethAddress, namadaAddress } = req.body;
        try {
          const { ethAddressTotal, namAddressTotal } = await checkDonation(ethAddress, namadaAddress);
          res.status(200).json({ ethAddressTotal, namAddressTotal });
        } catch (error) {
          res.status(500).json({ message: 'Error checking donations' });
        }
      } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
      }
}