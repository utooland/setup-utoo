import { createHash } from "node:crypto";
import { getState, info } from "@actions/core";
import { saveCache } from "@actions/cache";
import type { CacheState } from "./action";

async function run(): Promise<void> {
  try {
    const stateJson = getState("cache");
    if (!stateJson) {
      info("No cache state found");
      return;
    }

    const state: CacheState = JSON.parse(stateJson);
    
    if (!state.cacheEnabled) {
      info("Cache is disabled");
      return;
    }

    if (state.cacheHit) {
      info("Cache was hit, skipping save");
      return;
    }

    const cacheKey = createHash("sha1")
      .update(`utoo-${state.version}-${state.registry}`)
      .digest("base64");

    info(`Saving cache with key: ${cacheKey}`);
    await saveCache([state.utooPath.replace(/[^/\\]*$/, "")], cacheKey);
    info("Cache saved successfully");
  } catch (error) {
    info(`Failed to save cache: ${error}`);
  }
}

run();