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
    
    // Save utoo installation cache
    if (state.utooCacheEnabled && !state.cacheHit) {
      const utooCacheKey = createHash("sha1")
        .update(`utoo-${state.version}-${state.registry}`)
        .digest("base64");

      info(`Saving utoo cache with key: ${utooCacheKey}`);
      await saveCache([state.utooPath.replace(/[^/\\]*$/, "")], utooCacheKey);
      info("Utoo cache saved successfully");
    }

    // Save npm store cache
    if (state.storeCacheEnabled) {
      const storeCacheKey = createHash("sha1")
        .update(`utoo-store-${state.registry}`)
        .digest("base64");

      info(`Saving npm store cache with key: ${storeCacheKey}`);
      await saveCache([state.npmCacheDir], storeCacheKey);
      info("Npm store cache saved successfully");
    }

    if (!state.utooCacheEnabled && !state.storeCacheEnabled) {
      info("All caching is disabled");
    }
  } catch (error) {
    info(`Failed to save cache: ${error}`);
  }
}

run();