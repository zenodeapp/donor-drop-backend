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

-- Add index for timestamp-based queries
CREATE INDEX idx_donations_timestamp ON donations(timestamp);

CREATE INDEX idx_donations_address_timestamp ON donations(from_address, timestamp, amount_eth);

CREATE TABLE IF NOT EXISTS scraped_blocks (
    id SERIAL PRIMARY KEY,
    block_number BIGINT UNIQUE NOT NULL,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transactions_found INTEGER DEFAULT 0
);

-- Create an index for faster block number lookups
CREATE INDEX idx_block_number ON scraped_blocks(block_number);

CREATE VIEW donation_stats AS
WITH donor_totals AS (
    SELECT 
        from_address,
        LEAST(SUM(amount_eth), 0.3) as capped_total
    FROM donations
    GROUP BY from_address
    HAVING SUM(amount_eth) >= 0.03
),
running_totals AS (
    SELECT 
        d.timestamp,
        SUM(dt.capped_total) OVER (ORDER BY d.timestamp) as cumulative_sum,
        SUM(dt.capped_total) OVER () as total_sum
    FROM donations d
    INNER JOIN donor_totals dt ON d.from_address = dt.from_address
    GROUP BY d.timestamp, dt.capped_total
)
SELECT 
    COALESCE(total_sum, 0) as eligible_total_eth,
    CASE 
        WHEN MAX(cumulative_sum) >= 27 THEN (
            SELECT timestamp 
            FROM running_totals rt2 
            WHERE rt2.cumulative_sum >= 27 
            ORDER BY rt2.timestamp ASC 
            LIMIT 1
        )
        ELSE NULL
    END as cutoff_timestamp
FROM running_totals;

-- You can add more tables or initial data here
-- For example:
-- INSERT INTO donations (transaction_hash, from_address, amount_eth, timestamp)
-- VALUES ('0x123...', '0xabc...', 1.5, '2024-03-20 10:00:00');
