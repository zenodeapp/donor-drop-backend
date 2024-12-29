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

DROP VIEW IF EXISTS donation_stats;

CREATE VIEW donation_stats AS
WITH donor_sums AS (
    SELECT
        from_address,
        LEAST(SUM(amount_eth), 0.3) AS capped_total,
        MIN(timestamp) AS earliest_timestamp
    FROM donations
    GROUP BY from_address
    HAVING SUM(amount_eth) >= 0.03          -- Only donors ≥ 0.03 ETH
),
ordered_sums AS (
    SELECT
        from_address,
        capped_total,
        earliest_timestamp,
        -- Compute running total in ascending order of first donation
        SUM(capped_total) OVER (
            ORDER BY earliest_timestamp
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS running_sum
    FROM donor_sums
)
SELECT
    -- Total of all capped contributions
    (SELECT SUM(capped_total) FROM donor_sums) AS eligible_total_eth,
    -- The first timestamp that makes the running sum >= 27 (or NULL if it never reaches 27)
    (
        SELECT earliest_timestamp
        FROM ordered_sums
        WHERE running_sum >= 27
        ORDER BY earliest_timestamp
        LIMIT 1
    ) AS cutoff_timestamp;


-- You can add more tables or initial data here
-- For example:
-- INSERT INTO donations (transaction_hash, from_address, amount_eth, timestamp)
-- VALUES ('0x123...', '0xabc...', 1.5, '2024-03-20 10:00:00');
