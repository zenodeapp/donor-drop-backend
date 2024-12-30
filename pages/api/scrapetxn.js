import { pool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const query = `
      SELECT 
        transaction_hash,
        from_address,
        amount_eth,
        namada_key,
        input_message,
        timestamp
      FROM donations
      ORDER BY timestamp DESC
      LIMIT 100
    `;

    const result = await pool.query(query);
    
    return res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ 
      error: 'Error fetching transactions', 
      details: error.message 
    });
  }
}
