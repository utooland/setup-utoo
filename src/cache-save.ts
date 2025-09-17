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

    // Save npm store cache
    if (state.storeCacheEnabled) {
      const storeCacheKey = `utoo-store-${state.registry}`;

      info(`Saving npm store cache with key: ${storeCacheKey}`);
      await saveCache([state.npmCacheDir], storeCacheKey);
      info("Npm store cache saved successfully");
    }

    if (!state.storeCacheEnabled) {
      info("caching store is disabled");
    }
  } catch (error) {
    info(`Failed to save cache: ${error}`);
  }
}

run();
