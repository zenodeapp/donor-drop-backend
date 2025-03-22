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
> For a quick reset, use the script [`clean-start.sh`](./clean-start.sh).
> 
> **IMPORTANT:** this will wipe the ENTIRE database.


### 4. Run scraper

> [!TIP]
>
> Use a separate systemctl service to run the scraper. See issue [#22](https://github.com/zenodeapp/donor-drop-backend/issues/22) for a template. 

```bash
node scraper.mjs
```

#### 4.1. Scraper options _(optional)_

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

  This will get all transactions that meet the conditions described in [A.1 Donation finality](#a1-donation-finality) **without doing any memo or tnam validation**. This is useful if we want to give the people that made a mistake during the donor drop the opportunity to link their tnams again. See [A.2 Rescue plan](#a2-rescue-plan) for a detailed description on how to approach that.

## Results

The results are built from three different categories:

- (1) List of _eligible users_
- (2) List of users who donated _after the cap got reached_
- (3) List of users who _initially weren't included due to mistakes made_, but got corrected using [A.2 Rescue plan](#a2-rescue-plan)

There are two ways one could export these results. Either [_by using the wizard_](#i-using-the-wizard-recommended) or [_by using PSQL_](#ii-using-psql).

### I. Using the wizard _(recommended)_

#### Command
The following command can be used to export the raw and final (merged) results in .csv, .json and .proposal.json-format:

```
node result.mjs
```

#### Arguments _(optional)_

- `--exclude-eligibles`: excludes eligible users
- `--exclude-above-cap`: excludes users who donated after the cap
- `--exclude-not-in-db`: excludes users who were initially not included
- `--min-eth-per-address x`: the minimum amount of ETH a participant is required to have donated
  - _default value_: `0.03`
- `--max-eth-per-address y`: the maximum amount of ETH a participant was allowed to donate
  - _default value_: `0.3`
- `--clean`: this will clean the ./output folder before exporting the results

#### Features
- Exports .csv, .json and .proposal.json files.
- Saves _raw_ exports from the views:
  - _private_result_eligible_addresses_finalized_in_db_ as  `_raw_eligibles` (1),
  - _private_result_above_cap_addresses_in_db_ as `_raw_above_cap` (2) and
  - _private_result_addresses_not_in_db_ as `_raw_not_in_db` (3).
- Merges the results together by grouping the results by _tnam address_. This makes sure each participant will only be included once in the .proposal.json file.
- Gives the user a heads up whenever a participant gets skipped due to a _missing tnam address_ or _signature hash_.
- Asks the user whether to _cap a tnam address' ETH amount_ if the resulting value _is higher than_ the set `--max-eth-per-address`.
- Asks the user whether to _exclude a tnam address_ if this participant's resulting donation amount _is lower than_ the set `--min-eth-per-address`.
  
### II. Using PSQL
This route requires more manual work as it will only get you the _raw_ .csv files (which are also exported when _using the wizard_). If for some reason you're unable to use `node` or you only have direct access to the SQL database, use these commands:
- _private_result_eligible_addresses_finalized_in_db_ as  `_raw_eligibles.csv` (1)

  ```sql
  copy(SELECT from_address AS eth_address, tnam AS nam_address, eligible_amount AS eth_amount, predicted_suggested_nam AS nam_amount FROM private_result_eligible_addresses_finalized_in_db) To '/var/lib/postgresql/_raw_eligibles.csv' With CSV DELIMITER ',' HEADER;
  ```

- _private_result_above_cap_addresses_in_db_ as `_raw_above_cap.csv` (2)

  ```sql
  copy(SELECT from_address AS eth_address, tnam AS nam_address, eligible_above_cap AS eth_amount, suggested_nam AS nam_amount FROM private_result_above_cap_addresses_in_db) To '/var/lib/postgresql/_raw_above_cap.csv' With CSV DELIMITER ',' HEADER;
  ```

- _private_result_addresses_not_in_db_ as `_raw_not_in_db.csv` (3)

  ```sql
  copy(SELECT from_address AS eth_address, tnam AS nam_address, total_eth AS eth_amount, suggested_nam AS nam_amount, sig_hash FROM private_result_addresses_not_in_db) To '/var/lib/postgresql/_raw_not_in_db.csv' With CSV DELIMITER ',' HEADER;
  ```

## Appendix

### A.1 Donation finality

By default the scraper will periodically check for transactions made to the address defined in your .env-file. It uses a combination of info gathered from the Etherscan and Infura API and only picks up the transactions that meet the following conditions:

- donation _x_ comes from block _n_, where _n_ >= `SCRAPER_START_BLOCK`.
- donation _x_ has transaction date _d_, where _d_ >= `SCRAPER_START_DATE` and _d_ <= `SCRAPER_END_DATE`. 
- donation _x_ has hex _h_ in the transaction's memo-field, where decode(_h_) = _a valid tnam-address_. The decode-method is quite robust and auto-corrects most of the common mistakes people make (e.g. multi-encoded hex string, forgetting the '0x' part, adding more characters than necessary).
- donation _x_ is not a failed transaction.

The scraper starts two schedulers: one that registers any transaction that passes the requirements above and the other that also considers block finality. 

> [!NOTE]
> 
> **Why _two schedulers_?**
> 
> A transaction is only certain once a block is completely finalized on-chain. This takes on average 15 to 20 minutes. Which is problematic if we want to show a tally in real-time. So, to solve this, we temporarily use the data from the scheduler that's unbothered by finalization _as an indication_, whereas the actual results get calculated using the data from the _finalized_-scheduler. The frontend makes sure to take both this real-time and finalized data into account and visualize them accordingly.

### A.2 Rescue plan

If there are people who messed up their donation, the following can be done:

1. Wait for approx. 30 minutes after the donor drop ended (to make sure all eth blocks are in a `finalized` state).
2. _(Optional)_ adjust the `SCRAPER_START_DATE`, `SCRAPER_END_DATE` and `SCRAPER_START_BLOCK` in your [.env](./.env.example)-file.
3. Run ```node scraper.mjs --all-etherscan-txs```.
4. Double-check the data this command gathered in the `etherscan_transactions_all`-table. It should contain every transaction done between `SCRAPER_START_DATE` and `SCRAPER_END_DATE`.
5. Switch the frontend to the [`with-link`](https://github.com/zenodeapp/donor-drop-frontend/tree/with-link)-branch and re-deploy it.
6. Let people link their tnam addresses using the frontend (this form will only allow wallet addresses that failed to register a tnam address).
7. Keep track of the results by checking `unaccounted_addresses` and `private_result_addresses_not_in_db`.

### A.3 Testing _(likely outdated)_

The testing suite works as follows:

(If you have not already done so, please run `npm install` and set up docker-compose as described above)

The tests will be done against the database specified in the `.env` file. Ideally this would be done against a `.env.test` file, but for the purposes of this project, the `.env` file will be used.

To run the tests, use the following command:

```bash
npm test -- --detectOpenHandles --verbose
```

All tests should pass.
