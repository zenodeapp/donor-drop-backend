# Donor Drop Backend

This was initially written by chimmykk and bengtlofgren. It has been optimized, bug-fixed, and enhanced with additional logic to meet the requirements of the donor drop campaign and the official frontend. This project is licensed under the MIT-license (see [LICENSE](./LICENSE)).

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

### 2. .env configuration
Create an .env file in the root. See [.env.example](.env.example) for an example.

### 3. Setup postgres

Before continuing, read the comments in the [docker-compose.yml](./docker-compose.yml) file and configure this properly.

```bash
docker-compose up -d
```

This will setup the correct postgres database running on `POSTGRES_PORT` (default port: 5434). The tables and views that will get created are specified in the [init-scripts/init.sql](./init-scripts/init.sql) file.

For easy access to the database, you could use a tool like `pgAdmin` or `dbeaver` using the credentials specified in your .env file.

> [!NOTE]
>
> For a quick reset you could use the script [`clean-start.sh`](./clean-start.sh).
> 
> **IMPORTANT:** this will wipe the ENTIRE database.


### 4. Run scraper

```bash
node scraper.mjs
```

> [!IMPORTANT]
>
> For now you could use a separate systemctl service to run the scraper. See issue [#22](https://github.com/zenodeapp/donor-drop-backend/issues/22) for a template.

#### 4.1. Scraper options

There are currently two flags one could run the scraper with:

- `--once`

  ```
  node scraper.mjs --once
  ```

  This will only let the scraper do a single run. Useful if you just want to fetch data once, without letting it check Etherscan/Infura every n-seconds.


- `--all-etherscan-txs`

  ```
  node scraper.mjs --all-etherscan-txs
  ```
  
  > This flag will act as if `--once` is set as well.

  This will get all transactions made in the given timeframe (defined in the [.env](./.env.example)-file) **without doing any tnam validation**. This is useful if we want to give the people made mistakes during the donor drop the opportunity to link their tnams again. See [A.1 Rescue plan](https://github.com/zenodeapp/donor-drop-backend/edit/main/README.md#a1-rescue-plan) for a detailed description on how to approach that.

  > The resulting list of transactions will populate the `etherscan_transactions_all`-table instead of the usual `donations`-tables.

## Results

- List of perfect users (the TOTAL SUM of these will equal the target ETH amount or less if the target was not reached):

  ```sql
  copy(SELECT from_address, tnam, eligible_amount as eth, suggested_nam FROM private_result_eligible_addresses_finalized_in_db) To '/var/lib/postgresql/private_result_eligible_addresses_finalized_in_db.csv' With CSV DELIMITER ',' HEADER;
  ```

- List of users who donated after the cap got reached:

  ```sql
  copy(SELECT from_address, tnam, eligible_above_cap as eth, suggested_nam FROM private_result_above_cap_addresses_in_db) To '/var/lib/postgresql/private_result_above_cap_addresses_in_db.csv' With CSV DELIMITER ',' HEADER;
  ```

- List of users who were initially not included due to mistakes, but got corrected using [A.1 Rescue plan](https://github.com/zenodeapp/donor-drop-backend/edit/main/README.md#a1-rescue-plan):

  ```sql
  copy(SELECT from_address, tnam, sig_hash, total_eth as eth, suggested_nam FROM private_result_addresses_not_in_db) To '/var/lib/postgresql/private_result_addresses_not_in_db.csv' With CSV DELIMITER ',' HEADER;
  ```

## Appendix

### A.1 Rescue plan

If there are people who messed up their donation, the following can be done:

1. Wait for approx. 30 minutes after the donor drop ended (to make sure all eth blocks are in a `finalized` state).
2. Run ```node scraper.mjs --all-etherscan-txs```.
3. Double-check the data this command gathered in the `etherscan_transactions_all`-table. It should contain every transaction done between `SCRAPER_START_DATE` and `SCRAPER_END_DATE` (see: [.env](./.env.example)).
4. Switch the frontend to the [`with-link`](https://github.com/zenodeapp/donor-drop-frontend/tree/with-link)-branch and re-deploy it.
5. Let people link their tnam addresses using the frontend (this will only allow ethereum addresses that made a mistake during their donation).
6. Keep track of the results by checking `unaccounted_addresses` or `private_result_addresses_not_in_db`.

### A.2 Testing

The testing suite works as follows:

(If you have not already done so, please run `npm install` and set up docker-compose as described above)

The tests will be done against the database specified in the `.env` file. Ideally this would be done against a `.env.test` file, but for the purposes of this project, the `.env` file will be used.

To run the tests, use the following command:

```bash
npm test -- --detectOpenHandles --verbose
```

All tests should pass.
