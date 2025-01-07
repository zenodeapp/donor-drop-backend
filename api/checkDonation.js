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

async function findCutoffData() {
  const query = 'SELECT cutoff_timestamp, cutoff_id FROM donation_stats';
  
  try {
    const result = await pool.query(query);
    const row = result.rows[0];
    
    if (!row) {
      return {
        cutoff_timestamp: null,
        cutoff_id: null
      };
    }

    return {
      cutoff_timestamp: row.cutoff_timestamp,
      cutoff_id: row.cutoff_id
    };
  } catch (error) {
    console.error('Error finding cutoff data:', error);
    throw error;
  }
}

async function checkEthAddress(ethAddress, cutoffData) {
  const query = `
    WITH address_eligibility AS (
      -- First calculate eligibility per address
      SELECT from_address,
        CASE 
          WHEN SUM(amount_eth) >= 0.03 
          THEN LEAST(SUM(amount_eth), 0.3)
          ELSE 0 
        END as address_eligible
      FROM donations 
      WHERE block_number <= $2 AND tx_index < $3
      GROUP BY from_address
    ),
    total_before_cutoff AS (
      -- Then sum up all eligible amounts
      SELECT SUM(address_eligible) as total_eligible_eth
      FROM address_eligibility
    ),
    address_before_cutoff AS (
      -- Calculate THIS address's eligible amount before cutoff
      SELECT 
        CASE 
          WHEN SUM(amount_eth) >= 0.03 
          THEN LEAST(SUM(amount_eth), 0.3)
          ELSE 0
        END as address_eligible_eth
      FROM donations 
      WHERE from_address = $1 AND block_number <= $2 AND tx_index < $3
    ),
    cutoff_tx AS (
      -- Get the cutoff transaction if it exists
      SELECT amount_eth
      FROM donations
      WHERE from_address = $1 AND block_number = $2 AND tx_index = $3
    ),
    address_total AS (
      SELECT 
        COALESCE(SUM(amount_eth), 0) as total_eth,
        COALESCE(
          CASE 
            WHEN EXISTS (SELECT 1 FROM cutoff_tx) THEN
              (SELECT address_eligible_eth FROM address_before_cutoff) + 
              (27.0 - (SELECT total_eligible_eth FROM total_before_cutoff))
            ELSE
              (SELECT address_eligible_eth FROM address_before_cutoff)
          END,
          0
        ) as eligible_eth
      FROM donations 
      WHERE from_address = $1
    )
    SELECT total_eth, eligible_eth FROM address_total
  `;

  const result = await pool.query(query, [ethAddress.toLowerCase(), cutoffData.cutoff_id || 'infinity']);
  
  return {
    total: parseFloat(result.rows[0].total_eth),
    eligible: parseFloat(result.rows[0].eligible_eth)
  };
}

async function checkNamadaAddress(namadaAddress, cutoffData) {
  const query = `
    WITH address_eligibility AS (
      -- First calculate eligibility per address
      SELECT from_address,
        CASE 
          WHEN SUM(amount_eth) >= 0.03 
          THEN LEAST(SUM(amount_eth), 0.3)
          ELSE 0 
        END as address_eligible
      FROM donations 
      WHERE id < $2
      GROUP BY from_address
    ),
    total_before_cutoff AS (
      -- Then sum up all eligible amounts
      SELECT SUM(address_eligible) as total_eligible_eth
      FROM address_eligibility
    ),
    address_before_cutoff AS (
      -- Calculate THIS address's eligible amount before cutoff
      SELECT 
        CASE 
          WHEN SUM(amount_eth) >= 0.03 
          THEN LEAST(SUM(amount_eth), 0.3)
          ELSE 0
        END as address_eligible_eth
      FROM donations 
      WHERE namada_key = $1 AND id < $2
    ),
    cutoff_tx AS (
      -- Get the cutoff transaction if it exists
      SELECT amount_eth
      FROM donations
      WHERE namada_key = $1 AND id = $2
    ),
    address_total AS (
      SELECT 
        COALESCE(SUM(amount_eth), 0) as total_eth,
        COALESCE(
          CASE 
            WHEN EXISTS (SELECT 1 FROM cutoff_tx) THEN
              (SELECT address_eligible_eth FROM address_before_cutoff) + 
              (27.0 - (SELECT total_eligible_eth FROM total_before_cutoff))
            ELSE
              (SELECT address_eligible_eth FROM address_before_cutoff)
          END,
          0
        ) as eligible_eth
      FROM donations 
      WHERE namada_key = $1
    )
    SELECT total_eth, eligible_eth FROM address_total
  `;

  const result = await pool.query(query, [namadaAddress, cutoffData.cutoff_id || 'infinity']);
  
  return {
    total: parseFloat(result.rows[0].total_eth),
    eligible: parseFloat(result.rows[0].eligible_eth)
  };
}

async function checkDonation(ethAddress = null, namAddress = null) {
  try {
    const cutoffData = await findCutoffData();

    // Check addresses based on what was provided
    const [ethResult, namResult] = await Promise.all([
      ethAddress ? checkEthAddress(ethAddress, cutoffData) : null,
      namAddress ? checkNamadaAddress(namAddress, cutoffData) : null
    ]);

    const { cutoffTimestamp } = cutoffData;
    return {
      ...(ethAddress && { ethAddress: ethResult }),
      ...(namAddress && { namadaAddress: namResult }),
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
    
    // Validate that at least one address is provided
    if (!ethAddress && !namadaAddress) {
      return res.status(400).json({ 
        message: 'At least one address (ETH or Namada) must be provided' 
      });
    }

    try {
      const result = await checkDonation(
        ethAddress || null, 
        namadaAddress || null
      );
      res.status(200).json(result);
    } catch (error) {
      console.error('API error:', error);
      res.status(500).json({ message: 'Error checking donations' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}