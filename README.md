# NAMADA DONOR DROP

## Overview

Namda Donor Drop, claim/verify donation

### Demo

**[Watch the video demo here](https://vimeo.com/1041464145?share=copy)**

## Installation

`npm install`

## Setup Instructions

### 0 Edit the `.env` file, populating all the fields as required

### 1 Setup the postgres database using `docker-compose`

```bash
docker-compose up -d
```

This will setup the correct postgres database running on port 5434. The table created is specified in the `init-scripts/init.sql` file.
In order to view this, use a tool like `pgAdmin` or `dbeaver` to connect to the database using the credentials specified in the `.env` file.

### 3 **Get the JSON Key File**

Place the JSON key file in the project directory.  

### 4 **Run the Application**

```bash
npm run dev
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