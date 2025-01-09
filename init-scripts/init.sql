CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    amount_eth DECIMAL(20,18) NOT NULL,
    namada_key VARCHAR(66) NOT NULL,
    input_message VARCHAR,
    message VARCHAR(100) NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    block_number BIGINT NOT NULL,
    tx_index INTEGER NOT NULL
);

-- Add index for timestamp-based queries
CREATE INDEX idx_donations_timestamp ON donations(timestamp);

CREATE INDEX idx_donations_address_timestamp ON donations(from_address, timestamp, amount_eth);

CREATE TABLE IF NOT EXISTS donations_finalized (
    id SERIAL PRIMARY KEY,
    transaction_hash VARCHAR(66) UNIQUE NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    amount_eth DECIMAL(20,18) NOT NULL,
    namada_key VARCHAR(66) NOT NULL,
    input_message VARCHAR,
    message VARCHAR(100) NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    block_number BIGINT NOT NULL,
    tx_index INTEGER NOT NULL
);

-- Add index for timestamp-based queries
CREATE INDEX idx_donations_finalized_timestamp ON donations_finalized(timestamp);

CREATE INDEX idx_donations_finalized_address_timestamp ON donations_finalized(from_address, timestamp, amount_eth);

CREATE TABLE IF NOT EXISTS scraped_blocks (
    id SERIAL PRIMARY KEY,
    block_number BIGINT UNIQUE NOT NULL,
    scraped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    transactions_found INTEGER DEFAULT 0
);

-- Create an index for faster block number lookups
CREATE INDEX idx_block_number ON scraped_blocks(block_number);

CREATE TABLE IF NOT EXISTS scraped_blocks_finalized (
    id SERIAL PRIMARY KEY,
    block_number BIGINT UNIQUE NOT NULL,
    scraped_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    transactions_found INTEGER DEFAULT 0
);

-- Create an index for faster block number lookups
CREATE INDEX idx_block_number_finalized ON scraped_blocks_finalized(block_number);

CREATE OR REPLACE VIEW combined_donations AS
WITH last_finalized_block AS (
    SELECT COALESCE(MAX(block_number), 0) as block_height
    FROM scraped_blocks_finalized
)
SELECT *
FROM donations_finalized 
WHERE block_number <= (SELECT block_height FROM last_finalized_block)
UNION
SELECT *
FROM donations 
WHERE block_number > (SELECT block_height FROM last_finalized_block);

DROP VIEW IF EXISTS donation_stats;

CREATE VIEW donation_stats AS
WITH running_address_totals AS (
    -- Calculate running totals per address in transaction order
    SELECT 
        id,
        from_address,
        amount_eth,
        block_number,
        tx_index,
        SUM(amount_eth) OVER (
            PARTITION BY from_address
            ORDER BY block_number, tx_index
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as address_total
    FROM donations
),
eligible_amounts AS (
    -- Calculate eligible amount for each transaction
    SELECT 
        id,
        block_number,
        tx_index,
        CASE 
            WHEN address_total >= 0.03 THEN 
                LEAST(amount_eth, 0.3)
            ELSE 0
        END as eligible_amount
    FROM running_address_totals
),
running_totals AS (
    -- Calculate running sum of eligible amounts in strict transaction order
    SELECT 
        id,
        block_number,
        tx_index,
        eligible_amount,
        SUM(eligible_amount) OVER (
            ORDER BY block_number, tx_index
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_total
    FROM eligible_amounts
)
SELECT
    LEAST(
        (SELECT MAX(running_total) FROM running_totals),
        27.0
    ) as eligible_total_eth,
    cutoff.block_number as cutoff_block,
    cutoff.tx_index as cutoff_tx_index
FROM (
    SELECT *
    FROM running_totals
    WHERE running_total >= 27
    ORDER BY block_number, tx_index
    LIMIT 1
) cutoff;

DROP VIEW IF EXISTS donation_stats_finalized;

CREATE VIEW donation_stats_finalized AS
WITH running_address_totals AS (
    -- Calculate running totals per address in transaction order
    SELECT 
        id,
        from_address,
        amount_eth,
        block_number,
        tx_index,
        SUM(amount_eth) OVER (
            PARTITION BY from_address
            ORDER BY block_number, tx_index
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as address_total
    FROM donations_finalized
),
eligible_amounts AS (
    -- Calculate eligible amount for each transaction
    SELECT 
        id,
        block_number,
        tx_index,
        CASE 
            WHEN address_total >= 0.03 THEN 
                LEAST(amount_eth, 0.3)
            ELSE 0
        END as eligible_amount
    FROM running_address_totals
),
running_totals AS (
    -- Calculate running sum of eligible amounts in strict transaction order
    SELECT 
        id,
        block_number,
        tx_index,
        eligible_amount,
        SUM(eligible_amount) OVER (
            ORDER BY block_number, tx_index
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) as running_total
    FROM eligible_amounts
)
SELECT
    LEAST(
        (SELECT MAX(running_total) FROM running_totals),
        27.0
    ) as eligible_total_eth,
    cutoff.block_number as cutoff_block,
    cutoff.tx_index as cutoff_tx_index
FROM (
    SELECT *
    FROM running_totals
    WHERE running_total >= 27
    ORDER BY block_number, tx_index
    LIMIT 1
) cutoff;


-- You can add more tables or initial data here
-- For example:
-- INSERT INTO donations (transaction_hash, from_address, amount_eth, timestamp)
-- VALUES ('0x123...', '0xabc...', 1.5, '2024-03-20 10:00:00');

CREATE TABLE IF NOT EXISTS temporary_messages (
    from_address VARCHAR(42) PRIMARY KEY,
    message VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create the function to delete messages older than 10 minutes
CREATE OR REPLACE FUNCTION delete_old_messages()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM temporary_messages
    WHERE created_at < NOW() - INTERVAL '10 minutes';
    RETURN NULL; -- No row needs to be returned
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to call the function after insert or update
CREATE TRIGGER expire_messages
AFTER INSERT OR UPDATE ON temporary_messages
FOR EACH ROW
EXECUTE FUNCTION delete_old_messages();
