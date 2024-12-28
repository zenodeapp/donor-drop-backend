import dotenv from 'dotenv';
import { Pool } from 'pg';
dotenv.config();

const startDate = process.env.SCANNING_START_DATE;
const endDate = process.env.SCANNING_END_DATE;

const pool = new Pool({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: 'localhost',
    port: 5434,
    database: process.env.POSTGRES_DB
});

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const query = `
    WITH donor_totals AS (
        -- First get total per donor, capped at 0.3
        SELECT 
            from_address,
            LEAST(SUM(amount_eth), 0.3) as capped_total
        FROM donations
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY from_address
        HAVING SUM(amount_eth) >= 0.03  -- Only include donors who gave at least 0.03
    )
    SELECT COALESCE(SUM(capped_total), 0) as total_sum 
    FROM donor_totals
    `;

    try {
      const result = await pool.query(query, [startDate, endDate]);
      const totalSum = parseFloat(result.rows[0].total_sum);
      
      // Cap the final sum at 27 ETH
      const finalSum = totalSum > 27 ? 27 : totalSum;
      
      res.status(200).json({ totalSum: finalSum });
    } catch (error) {
      console.error('Error calculating sum:', error);
      res.status(500).json({ error: 'Failed to calculate total' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
