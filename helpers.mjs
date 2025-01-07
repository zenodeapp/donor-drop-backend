const prettyTimestamp = () => (
  new Date().toISOString().replace('T', ' ').split('.')[0]);

const log = (...args) => {
  console.log(`[${prettyTimestamp()}]`, ...args);
}

const logError = (...args) => {
  console.error(`[${prettyTimestamp()}]`, ...args);
}


export { log, logError };