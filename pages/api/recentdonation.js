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
    const result = await pool.query('SELECT * FROM donations ORDER BY timestamp DESC LIMIT 1');
    const row = result.rows[0];
    res.status(200).json({ tx_hash: row[1], from_address: row[2], amount_eth: row[3], namada_key: row[4], input_message: row[5], timestamp: row[6] });
    }
else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
