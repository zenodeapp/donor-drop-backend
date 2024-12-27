CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    amount_eth DECIMAL(20,18) NOT NULL,
    namada_key VARCHAR(66) NOT NULL,
    input_message VARCHAR,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scraped_blocks (
    id SERIAL PRIMARY KEY,
    block_number BIGINT UNIQUE NOT NULL,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transactions_found INTEGER DEFAULT 0
);

-- Create an index for faster block number lookups
CREATE INDEX idx_block_number ON scraped_blocks(block_number);

-- You can add more tables or initial data here
-- For example:
-- INSERT INTO donations (transaction_hash, from_address, amount_eth, timestamp)
-- VALUES ('0x123...', '0xabc...', 1.5, '2024-03-20 10:00:00');