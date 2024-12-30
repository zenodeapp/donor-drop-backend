const { bech32m } = require('bech32');

// Copied from lib/db.js TODO: fix this to use the actual function
function extractNamadaKey(message) {
    try {
      // Find all potential Namada addresses in the message
      const matches = message.matchAll(/tnam[a-zA-Z0-9]+/g);
      if (!matches) return '';
      
      // Try each match until we find a valid one
      for (const match of matches) {
        const address = match[0];
        
        // Attempt to decode the address as bech32
        try {
          const decoded = bech32m.decode(address);
          // Check if it's a Namada address (prefix should be 'tnam')
          if (decoded.prefix === 'tnam') {
            // If we got here, it's a valid bech32 Namada address
            return address;
          }
        } catch (e) {
          // If bech32 decode fails, continue to next match
          continue;
        }
      }
      
      // If no valid address found, return empty string
      return '';
    } catch (error) {
      console.error('Error extracting Namada key:', error);
      return '';
    }
}

// Generate 100 additional test transactions
const additionalTransactions = Array.from({ length: 100 }, (_, i) => {
    const minutes = Math.floor(i / 60);
    const seconds = i % 60;
    return {
        transaction_hash: `test-tx-${9 + i}`,
        from_address: `0xedge42${String(i)}`,
        amount_eth: '15.0',
        input_message: 'Send to tnam1qp027ekpx7yqkzwm0rwj9uf7rh9qy95aygrd07me',
        namada_key: null,
        timestamp: `2024-01-01 19:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
});

const testData = {
    donations: [
      {
        transaction_hash: 'test-tx-1',
        from_address: '0xdbc69e6731975d3aa710d9e2ba85ce14131b6454',
        amount_eth: '0.06',
        input_message: 'My Namada address is tnam1qp00fewmknqdcu2gwl5zf4qvxn75qm332ypy79xg please',
        namada_key: null,
        timestamp: '2024-01-01 10:00:00'
      },
      {
        transaction_hash: 'test-tx-2',
        from_address: '0x354b5ac5ffa7a3cdcb7c811b6ebb44df5c3173d6',
        amount_eth: '0.02',
        input_message: 'Send to tnam1qp027ekpx7yqkzwm0rwj9uf7rh9qy95aygrd07me',
        namada_key: null,
        timestamp: '2024-01-01 11:00:00'
      },
      {
        transaction_hash: 'test-tx-3',
        from_address: '0xdbc69e6731975d3aa710d9e2ba85ce14131b6454',
        amount_eth: '0.3',
        input_message: 'my tnam123 is tnam1qp03nsz7sn83h9s9cxjmge0a5t7ktzh6gc8dha0q is my address',
        namada_key: null,
        timestamp: '2024-01-01 12:00:00'
      },
      {
        transaction_hash: 'test-tx-4',
        from_address: '0xtest3',
        amount_eth: '0.02',
        input_message: 'Invalid address tnam1invalid',
        namada_key: null,
        timestamp: '2024-01-01 13:00:00'
      },
      {
        transaction_hash: 'test-tx-5',
        from_address: '0xedge1',
        amount_eth: '15.0',
        input_message: 'tnam1qpedge1111111111111111111111111111111111',
        namada_key: null,
        timestamp: '2024-01-01 13:00:00'
      },
      {
        transaction_hash: 'test-tx-6',
        from_address: '0xedge2',
        amount_eth: '15.0',
        input_message: 'tnam1qpedge2222222222222222222222222222222222',
        namada_key: null,
        timestamp: '2024-01-01 14:00:00'
      },
      {
        transaction_hash: 'test-tx-7',
        from_address: '0xedge3',
        amount_eth: '0.029',
        input_message: 'tnam1qpedge3333333333333333333333333333333333',
        namada_key: null,
        timestamp: '2024-01-01 15:00:00'
      },
      {
        transaction_hash: 'test-tx-8',
        from_address: '0xedge3',
        amount_eth: '0.031',
        input_message: 'tnam1qpedge3333333333333333333333333333333333',
        namada_key: null,
        timestamp: '2024-01-01 16:00:00'
      },
      ...additionalTransactions,
      {
        transaction_hash: 'test-tx-1000',
        from_address: '0xedge3',
        amount_eth: '0.031',
        input_message: 'my NAMADA address is tnam1qp058af2my7kk2hz36kdfwcm9cqfzlsjacl8ep92 is my tnam address',
        namada_key: null,
        timestamp: '2024-01-02 01:00:00'}
    ]
  };

  // Add test data for scraped blocks
const scrapedBlocksData = [
    {
      block_number: 1000000,
      transactions_found: 5,
      scraped_at: '2024-01-01 10:00:00'
    },
    {
      block_number: 1000001,
      transactions_found: 3,
      scraped_at: '2024-01-01 11:00:00'
    },
    {
      block_number: 1000002,
      transactions_found: 0,
      scraped_at: '2024-01-01 12:00:00'
    }
  ];

  
  async function seedTestData(pool) {
    // Clear existing test data
    await pool.query("DELETE FROM donations WHERE transaction_hash LIKE 'test-%'");
    
    // Insert test data with extracted namada keys
    for (const donation of testData.donations) {
      // Extract namada key from input message
      const namadaKey = extractNamadaKey(donation.input_message);
      
      // If the extracted key is empty, skip the insert
        if (!namadaKey) {
            console.log(`Skipping donation with invalid Namada key: ${donation.input_message}`);
            continue;
        }

      await pool.query(`
        INSERT INTO donations (
          transaction_hash, 
          from_address, 
          amount_eth, 
          input_message,
          namada_key,
          timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        donation.transaction_hash,
        donation.from_address,
        donation.amount_eth,
        donation.input_message,
        namadaKey || '', // Use extracted key or null if not found
        donation.timestamp
      ]);
    }
  }

  async function seedScrapedBlockData(pool) {
    // Clear existing test data
    await pool.query("DELETE FROM scraped_blocks WHERE block_number >= 1000000");
    
    // Insert test data for scraped blocks
    for (const block of scrapedBlocksData) {
      await pool.query(`
        INSERT INTO scraped_blocks (block_number, transactions_found, scraped_at)
        VALUES ($1, $2, $3)
      `, [block.block_number, block.transactions_found, block.scraped_at]);
    }
  }
  
  module.exports = {
    seedTestData,
    seedScrapedBlockData
  };