import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from the .env file
dotenv.config();

// Create a connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: 'localhost',
  port: 5434,
  database: process.env.POSTGRES_DB
});

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { transaction_hash, from_address, amount_eth, namada_key, input_message, timestamp } = req.body;

    try {
      // Check if transaction hash already exists
      const checkQuery = 'SELECT transaction_hash FROM donations WHERE transaction_hash = $1';
      const checkResult = await pool.query(checkQuery, [transaction_hash]);

      if (checkResult.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Transaction hash already exists' 
        });
      }

      // Insert new donation
      const insertQuery = `
        INSERT INTO donations 
        (transaction_hash, from_address, amount_eth, namada_key, input_message, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const values = [
        transaction_hash,
        from_address,
        amount_eth,
        namada_key,
        input_message,
        new Date(timestamp)
      ];

      const result = await pool.query(insertQuery, values);
      
      return res.status(200).json({ 
        success: true, 
        data: result.rows[0] 
      });

    } catch (error) {
      console.error('Error saving to PostgreSQL:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save data',
        error: error.message 
      });
    }
  } else {
    return res.status(405).json({ 
      success: false, 
      message: `Method ${req.method} Not Allowed` 
    });
  }
}