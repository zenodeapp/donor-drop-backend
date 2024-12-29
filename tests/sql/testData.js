const testData = {
    donations: [
      {
        transaction_hash: 'test-tx-1',
        from_address: '0xdbc69e6731975d3aa710d9e2ba85ce14131b6454',
        amount_eth: '0.06',
        namada_key: 'tnam1qp00fewmknqdcu2gwl5zf4qvxn75qm332ypy79xg',
        timestamp: '2024-01-01 10:00:00'
      },
      {
        transaction_hash: 'test-tx-2',
        from_address: '0x354b5ac5ffa7a3cdcb7c811b6ebb44df5c3173d6',
        amount_eth: '0.02',
        namada_key: 'tnam1qp027ekpx7yqkzwm0rwj9uf7rh9qy95aygrd07me',
        timestamp: '2024-01-01 11:00:00'
      },
      {
        transaction_hash: 'test-tx-3',
        from_address: '0xdbc69e6731975d3aa710d9e2ba85ce14131b6454',
        amount_eth: '0.3',
        namada_key: 'tnam1qp03nsz7sn83h9s9cxjmge0a5t7ktzh6gc8dha0q',
        timestamp: '2024-01-01 12:00:00'
      },
      {
        transaction_hash: 'test-tx-4',
        from_address: '0xtest3',
        amount_eth: '0.02',
        namada_key: 'ttnam1qp04nqz7sn83h9s9cxjmge0a5t7ktzh6gc8dha0q',
        timestamp: '2024-01-01 13:00:00'
      }
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
    
    // Insert test data
    for (const donation of testData.donations) {
      await pool.query(`
        INSERT INTO donations (
          transaction_hash, 
          from_address, 
          amount_eth, 
          namada_key, 
          timestamp
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        donation.transaction_hash,
        donation.from_address,
        donation.amount_eth,
        donation.namada_key,
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
    testData,
    seedTestData,
    scrapedBlocksData,
    seedScrapedBlockData
  };