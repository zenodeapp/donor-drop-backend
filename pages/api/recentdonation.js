import { pool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    // Get timestamp from query parameter, default to 0 if not provided
    const afterTimestamp = req.query.timestamp || '1970-01-01T00:00:00.000Z';

    const query = `
      SELECT 
        transaction_hash,
        from_address,
        amount_eth,
        namada_key,
        input_message,
        timestamp
      FROM donations 
      WHERE timestamp > $1
      ORDER BY timestamp ASC
    `;

    const result = await pool.query(query, [afterTimestamp]);
    
    if (result.rows.length === 0) {
      return res.status(200).json({ donations: [] });
    }

    // Map the rows to a cleaner format
    const donations = result.rows.map(row => ({
      transactionHash: row.transaction_hash,
      fromAddress: row.from_address,
      amountEth: parseFloat(row.amount_eth),
      namadaKey: row.namada_key,
      message: row.input_message,
      timestamp: row.timestamp
    }));
    
    res.status(200).json({ donations });

  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
}
