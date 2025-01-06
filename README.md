# Donor Drop Backend

This was initially written by chimmykk and bengtlofgren. All credits go to them! I merely slim-sized it and added additional logic. It is licensed under the MIT-license (see [LICENSE](./LICENSE)).

# Overview

- Contains SQL database which can be setup via Docker
- Contains scraper which is dependent on the existence of this SQL database.

## Installation

### 1. Install dependencies
```
npm install
```

OR

```
yarn install
```

### 2. Add .env file containing the correct values for these keys
```env
ETHERSCAN_API_KEY='your_etherscan_api_key'
ETHERSCAN_BASE_URL='https://api.etherscan.io/api'

SCRAPER_PORT=3001
SCRAPER_ADDRESS='ethereum_address'
SCRAPER_START_BLOCK='1'
SCRAPER_START_DATE='2024-12-27T15:00:00Z'
SCRAPER_END_DATE='2025-01-09T15:00:00Z'

POSTGRES_USER='postgres'
POSTGRES_PASSWORD='admin1234'
POSTGRES_HOST='localhost'
POSTGRES_PORT=5434
POSTGRES_DB='postgres'
```

> Make sure that the POSTGRES_PORT matches the port in `./docker-compose.yml`

### 3. Setup postgres

```bash
docker-compose up -d
```

> This will setup the correct postgres database running on POSTGRES_PORT (default port: 5434). The table created is specified in the `init-scripts/init.sql` file.
In order to view this, use a tool like `pgAdmin` or `dbeaver` to connect to the database using the credentials specified in the `.env` file.

### 4. Run scraper

```bash
node scraper.mjs
```

## Testing
 
The testing suite works as follows:

(If you have not already done so, please run `npm install` and set up docker-compose as described above)

The tests will be done against the database specified in the `.env` file. Ideally this would be done against a `.env.test` file, but for the purposes of this project, the `.env` file will be used.

To run the tests, use the following command:

```bash
npm test -- --detectOpenHandles --verbose
```

All tests should pass.
