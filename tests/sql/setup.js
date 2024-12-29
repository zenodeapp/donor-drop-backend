const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env' });

const { Pool } = require('pg');

const testPool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: 'localhost',
  port: process.env.POSTGRES_PORT || 5434,
  database: process.env.POSTGRES_DB
});

// Verify connection and schema
beforeAll(async () => {
  try {
    // Check if we can connect and the view exists
    const result = await testPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.views 
        WHERE table_name = 'donation_stats'
      );
    `);
    
    if (!result.rows[0].exists) {
      throw new Error('donation_stats view not found - ensure Docker container is running');
    }
    
    console.log('Successfully connected to test database with schema');
  } catch (error) {
    console.error('Database setup error:', error);
    throw error;
  }
});

module.exports = { testPool };
