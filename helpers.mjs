import readline from "readline";

const prettyTimestamp = () =>
  new Date().toISOString().replace("T", " ").split(".")[0];

const log = (...args) => {
  console.log(`[${prettyTimestamp()}]`, ...args);
};

const logError = (...args) => {
  console.error(`[${prettyTimestamp()}]`, ...args);
};

const askUser = (message, defaultYes = false, tabs = 0) => {
  const indent = " ".repeat(tabs * 2);

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = () => {
      rl.question(
        `${indent}${message} ${defaultYes ? "(Y/n)" : "(y/N)"} `,
        (answer) => {
          if (answer === "") {
            rl.close();
            resolve(defaultYes);
          } else if (answer.toLowerCase() === "y") {
            rl.close();
            resolve(true);
          } else if (answer.toLowerCase() === "n") {
            rl.close();
            resolve(false);
          } else {
            console.log(
              `${indent}❌ Invalid input. Please enter 'y' for Yes or 'n' for No.`
            );
            ask(); // Ask again without closing
          }
        }
      );
    };

    ask();
  });
};

const createCsvContent = (columns, rows) => {
  let result = columns.join(",") + "\n";
  rows.forEach((row) => {
    result += columns.map((col) => row[col] ?? "").join(",") + "\n";
  });

  return result;
};

export { log, logError, askUser, createCsvContent };
