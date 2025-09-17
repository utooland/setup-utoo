import { tmpdir } from "node:os";
import { getInput, setOutput, setFailed, getBooleanInput } from "@actions/core";
import runAction from "./action.js";

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TEMP = tmpdir();
}

runAction({
  version: getInput("utoo-version") || "latest",
  registry: getInput("registry") || "https://registry.npmjs.org/",
  cacheUtoo: getBooleanInput("cache-utoo") !== false, // Default true
  cacheStore: getBooleanInput("cache-store") !== false, // Default true
})
  .then(({ version, utooPath, cacheHit }) => {
    setOutput("utoo-version", version);
    setOutput("utoo-path", utooPath);
    setOutput("cache-hit", cacheHit);
    process.exit(0);
  })
  .catch((error) => {
    setFailed(error);
    process.exit(1);
  });