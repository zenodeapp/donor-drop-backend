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

async function checkDonation(ethAddress, namAddress) {
    try {
      // Query to sum donations by ETH address
      const ethQuery = `
        SELECT COALESCE(SUM(amount_eth), 0) as total_eth
        FROM donations 
        WHERE from_address = $1
      `;
  
      // Query to sum donations by Namada address
      const namQuery = `
        SELECT COALESCE(SUM(amount_eth), 0) as total_eth
        FROM donations 
        WHERE namada_key = $1
      `;
  
      // Execute both queries in parallel
      const [ethResult, namResult] = await Promise.all([
        pool.query(ethQuery, [ethAddress.toLowerCase()]),
        pool.query(namQuery, [namAddress])
      ]);
  
      return {
        ethAddressTotal: parseFloat(ethResult.rows[0].total_eth),
        namAddressTotal: parseFloat(namResult.rows[0].total_eth)
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