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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const result = await pool.query('SELECT SUM(amount_eth) FROM donations WHERE timestamp > NOW() - INTERVAL \'1 day\'');
    res.status(200).json({ totalSum: result.rows[0].sum || 0 });
    }
else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
