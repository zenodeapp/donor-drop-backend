import { mkdir, rm, writeFile } from "fs/promises";
import { pool } from "./lib/db.mjs";
import { askUser, createCsvContent } from "./helpers.mjs";

// Arguments
// TODO: issue #15 will make the args --min-eth-per-address and --max-eth-per-address obsolete.
const clean = process.argv.includes("--clean");
const excludeEligibles = process.argv.includes("--exclude-eligibles");
const excludeAboveCap = process.argv.includes("--exclude-above-cap");
const excludeNotInDb = process.argv.includes("--exclude-not-in-db");
const minEthPerAddress = process.argv.includes("--min-eth-per-address")
  ? parseFloat(process.argv[process.argv.indexOf("--min-eth-per-address") + 1])
  : 0.03;
const maxEthPerAddress = process.argv.includes("--max-eth-per-address")
  ? parseFloat(process.argv[process.argv.indexOf("--max-eth-per-address") + 1])
  : 0.3;

// Queries
const queries = {};

if (!excludeEligibles)
  queries.eligibles = `SELECT from_address AS eth_address, tnam AS nam_address, eligible_amount AS eth_amount, suggested_nam AS nam_amount FROM private_result_eligible_addresses_finalized_in_db`;

if (!excludeAboveCap)
  queries.above_cap = `SELECT from_address AS eth_address, tnam AS nam_address, eligible_above_cap AS eth_amount, suggested_nam AS nam_amount FROM private_result_above_cap_addresses_in_db`;

if (!excludeNotInDb)
  queries.not_in_db = `SELECT from_address AS eth_address, tnam AS nam_address, total_eth AS eth_amount, suggested_nam AS nam_amount, sig_hash FROM private_result_addresses_not_in_db`;

const main = async () => {
  console.log();
  console.log(`Arguments:`);
  console.log(
    `--exclude-eligibles: ${excludeEligibles.toString()} [exclude eligible users]`
  );
  console.log(
    `--exclude-above-cap: ${excludeAboveCap.toString()} [exclude users who donated after the cap]`
  );
  console.log(
    `--exclude-not-in-db: ${excludeNotInDb.toString()} [exclude users who were initially not included]`
  );
  console.log(
    `--min-eth-per-address: ${minEthPerAddress.toString()} [default: 0.03]`
  );
  console.log(
    `--max-eth-per-address: ${maxEthPerAddress.toString()} [default: 0.3]`
  );
  console.log(
    `--clean: ${clean.toString()} [discards ./output before exporting results]`
  );
  console.log();
  console.log(
    `This will export the raw and final results in .csv, .json, and .proposal.json-format.`
  );

  // Prompt user whether to continue or not
  const answer = await askUser("Do you wish to continue?");
  if (!answer) {
    console.log("Operation cancelled.");
    process.exit(0); // Exit the script if the user does not confirm
  }

  console.log();

  // Remove ./output folder if --clean argument is set
  if (clean) {
    try {
      // Remove the entire 'output' folder and its contents
      await rm("./output", { recursive: true, force: true });
      console.log("🗑️   Removed ./output.");
    } catch (e) {
      console.error("🗑️   Error removing ./output :", error);
    }
  }

  // Ensure ./output directory exists
  await mkdir("./output", { recursive: true });

  console.log();

  // Create raw exports and collect all entries for later use
  console.log("💾  Saving raw results...");
  const allRows = [];
  await Promise.all(
    Object.entries(queries).map(async ([key, query]) => {
      const data = await createRawResult(query, `_raw_${key}`);

      if (data) allRows.push(...data);
    })
  );

  console.log();

  // Create final results
  console.log("💾  Saving final results...");
  const result = await createFinalResult(allRows);

  showFinalResult(result);

  // Close DB connection
  await pool.end();
};

// Exports raw data and returns the rows as an object for later use
const createRawResult = async (query, fileName) => {
  try {
    const result = await pool.query(query);

    if (!result.rows.length) {
      console.log(`No data found for ${fileName}.`);
      return [];
    }

    const columns = result.fields.map((field) => field.name);

    // raw .csv export
    const csvFilePath = `./output/${fileName}.csv`;
    await writeFile(
      csvFilePath,
      createCsvContent(columns, result.rows),
      "utf8"
    );
    console.log(`    Exported ${csvFilePath}.`);

    // raw .json export
    const jsonFilePath = `./output/${fileName}.json`;
    await writeFile(jsonFilePath, JSON.stringify(result.rows, null, 2), "utf8");
    console.log(`    Exported ${jsonFilePath}.`);

    return result.rows;
  } catch (error) {
    console.error(`    Error fetching ${fileName}:`, error);
    return [];
  }
};

// Exports final results
const createFinalResult = async (data) => {
  // Helper function to group the participants by tnam-address and filter out invalid tnams.
  const aggregateByNamAddress = (_data) => {
    const reducedData = _data.reduce((acc, row) => {
      const { eth_address, eth_amount, nam_amount, sig_hash } = row;
      const nam_address = row.nam_address.toLowerCase();

      // Check for missing nam_address
      if (!nam_address || sig_hash === null) {
        console.log(`      ⏩  Skipped ${eth_address}`);
        switch (true) {
          case !nam_address && sig_hash === null:
            console.log(
              `          Reason: missing tnam address and signature hash.`
            );
            break;
          case !nam_address:
            console.log(`          Reason: missing tnam address.`);
            break;
          case sig_hash === null:
            console.log(`          Reason: missing signature hash.`);
            break;
          default:
        }

        return acc; // Skip this row if nam_address is missing or sig hash is null
      }

      if (!acc[nam_address]) {
        acc[nam_address] = {
          nam_address,
          eth_amount: 0,
          nam_amount: 0,
        };
      }

      acc[nam_address].eth_amount += parseFloat(eth_amount);
      acc[nam_address].nam_amount += parseFloat(nam_amount);

      return acc;
    }, {});

    return Object.values(reducedData);
  };

  // Helper function to (interactively) validate the eth amounts.
  const validateEthAmounts = async (_data) => {
    for (const row of _data) {
      const { nam_address } = row;

      const fixedEthAmount = row.eth_amount.toFixed(6);

      switch (true) {
        // participant exceeds max amount that's allowed to donate
        case fixedEthAmount > maxEthPerAddress:
          console.log(`      ❔  About ${nam_address}`);
          const capParticipant = await askUser(
            `Issue: ${fixedEthAmount}E exceeds ${maxEthPerAddress}E. Would you like to cap this participant to ${maxEthPerAddress}E?`,
            true,
            5
          );
          if (capParticipant) {
            console.log(
              `          Solution: ✏️  Capped to ${maxEthPerAddress}E.`
            );
            row.nam_amount = Math.round(
              (row.nam_amount / row.eth_amount) * maxEthPerAddress
            );
            row.eth_amount = maxEthPerAddress;
            continue;
          } else {
            console.log(`          Solution: 🔹  Kept on ${fixedEthAmount}E.`);
          }
          break;
        // participant is lower than the min amount that's allowed to donate
        case fixedEthAmount < minEthPerAddress:
          console.log(`      ❔  About ${nam_address}`);
          const excludeParticipant = await askUser(
            `Issue: ${fixedEthAmount}E is less than the min. required amount of ${minEthPerAddress}E. Would you like to exclude this participant?`,
            false,
            5
          );
          if (excludeParticipant) {
            console.log(`          Solution: ❌  Excluded ${nam_address}.`);
            // exclude this address from the array by marking the address as null
            row.nam_address = null;
            continue;
          } else {
            console.log(`          Solution: 🔹  Kept ${nam_address}.`);
          }
          break;
        default:
      }

      // Rounding prevents floating precision issues (TODO: to make this super precise we should consider using BigInts)
      row.nam_amount = Math.round(row.nam_amount);
      row.eth_amount = fixedEthAmount;
    }

    // Remove addresses that are marked as not having donated enough
    return _data.filter((row) => row.nam_address !== null);
  };

  if (!data.length) return;

  // Process data coming from the raw exports
  const filteredRows = await validateEthAmounts(aggregateByNamAddress(data));

  // Filename for end result files
  const fileName = `result_${[
    !excludeEligibles ? "eligibles" : "",
    !excludeAboveCap ? "above_cap" : "",
    !excludeNotInDb ? "not_in_db" : "",
  ]
    .filter((str) => str !== "")
    .join("+")}`;

  // .csv export
  const csvFilePath = `./output/${fileName}.csv`;
  await writeFile(
    csvFilePath,
    createCsvContent(["nam_address", "eth_amount", "nam_amount"], filteredRows),
    "utf8"
  );
  console.log(`    Exported ${csvFilePath}.`);

  // .json export
  const jsonFilePath = `./output/${fileName}.json`;
  await writeFile(jsonFilePath, JSON.stringify(filteredRows, null, 2), "utf8");
  console.log(`    Exported ${jsonFilePath}.`);

  // .proposal.json export
  const proposalJsonFilePath = `./output/${fileName}.proposal.json`;
  await writeFile(
    proposalJsonFilePath,
    JSON.stringify(
      filteredRows.map((row) => {
        return {
          Internal: {
            amount: Math.floor(row.nam_amount * 1e6).toString(),
            target: row.nam_address.toLowerCase().trim(),
          },
        };
      }),
      null,
      2
    ),
    "utf8"
  );
  console.log(`    Exported ${proposalJsonFilePath}.`);

  return filteredRows;
};

const showFinalResult = (data) => {
  console.log();
  console.log("🧮 Export finished successfully!");
  console.log(`    👤 ${data.length} participants`);

  let ethTotal = 0;
  let namTotal = 0;

  for (const row of data) {
    ethTotal += parseFloat(row.eth_amount);
    namTotal += row.nam_amount;
  }
  console.log(
    `    💰 ${ethTotal.toFixed(6)} ETH recognized (rounded by 6 decimals)`
  );
  console.log(`    👛 ${namTotal} NAM (rounded)`);
};

main().catch((error) => {
  console.error("Error occurred:", error);
  process.exit(1);
});
