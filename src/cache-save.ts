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

    // Save Utoo binary cache (only if not already cached)
    if (state.utooCacheEnabled && !state.cacheHit) {
      const utooCacheKey = `utoo-binary-${state.version}`;

      info(`Saving Utoo binary cache with key: ${utooCacheKey}`);
      info(`Cache paths: ${state.utooCachePaths.join(', ')}`);
      try {
        await saveCache(state.utooCachePaths, utooCacheKey);
        info("Utoo binary cache saved successfully");
      } catch (error) {
        info(`Failed to save Utoo binary cache: ${error}`);
      }
    }

    // Save npm store cache
    if (state.storeCacheEnabled) {
      const storeCacheKey = `utoo-store-${state.registry}`;

      info(`Saving npm store cache with key: ${storeCacheKey}`);
      try {
        await saveCache([state.npmCacheDir], storeCacheKey);
        info("Npm store cache saved successfully");
      } catch (error) {
        info(`Failed to save npm store cache: ${error}`);
      }
    }

    if (!state.utooCacheEnabled && !state.storeCacheEnabled) {
      info("All caching is disabled");
    }
  } catch (error) {
    info(`Failed to save cache: ${error}`);
  }
}

run();
