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

### 2. .env configuration
Create an .env file in the root. See [.env.example](.env.example) for an example.

### 3. Setup postgres

```bash
docker-compose up -d
```

> This will setup the correct postgres database running on POSTGRES_PORT (default port: 5434). The table created is specified in the `init-scripts/init.sql` file.
In order to view this, use a tool like `pgAdmin` or `dbeaver` to connect to the database using the credentials specified in the `.env` file.

### 4. Run scraper

> [!IMPORTANT]
>
> For now I'm using a separate systemctl service to run the scraper. See issue [#22](https://github.com/zenodeapp/donor-drop-backend/issues/22).

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
