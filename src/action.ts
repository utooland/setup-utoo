import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { addPath, info, warning } from "@actions/core";
import { isFeatureAvailable, restoreCache } from "@actions/cache";
import { getExecOutput } from "@actions/exec";
import { saveState } from "@actions/core";
import { retry } from "./utils";

export type Input = {
  version?: string;
  registry?: string;
  cacheUtoo?: boolean;
  cacheStore?: boolean;
};

export type Output = {
  version: string;
  utooPath: string;
  cacheHit: boolean;
};

export type CacheState = {
  utooCacheEnabled: boolean;
  storeCacheEnabled: boolean;
  cacheHit: boolean;
  utooPath: string;
  npmCacheDir: string;
  version: string;
  registry: string;
};

export default async (options: Input): Promise<Output> => {
  const version = options.version || "latest";
  const registry = options.registry || "https://registry.npmjs.org/";
  const utooCacheEnabled = isUtooCacheEnabled(options);
  const storeCacheEnabled = options.cacheStore !== false && isFeatureAvailable();

  // Setup npm cache and bin directories
  const npmCacheDir = join(homedir(), ".cache", "nm");
  const binPath = join(homedir(), ".npm", "bin");
  
  try {
    mkdirSync(binPath, { recursive: true });
    mkdirSync(npmCacheDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
  
  addPath(binPath);

  const exe = (name: string) =>
    process.platform === "win32" ? `${name}.cmd` : name;
  const utooPath = join(binPath, exe("utoo"));
  const utPath = join(binPath, exe("ut"));

  let actualVersion: string | undefined;
  let cacheHit = false;

  // Handle npm store cache
  if (storeCacheEnabled) {
    const storeCacheKey = createHash("sha1")
      .update(`utoo-store-${registry}`)
      .digest("base64");
    
    const storeCacheRestored = await restoreCache([npmCacheDir], storeCacheKey);
    if (storeCacheRestored) {
      info(`Restored npm cache from store cache`);
    }
  }

  // Handle utoo installation cache
  if (utooCacheEnabled) {
    const utooCacheKey = createHash("sha1")
      .update(`utoo-${version}-${registry}`)
      .digest("base64");

    const cacheRestored = await restoreCache([binPath], utooCacheKey);
    if (cacheRestored && existsSync(utooPath)) {
      actualVersion = await getUtooVersion(utooPath);
      if (actualVersion) {
        cacheHit = true;
        info(`Using a cached version of Utoo: ${actualVersion}`);
      } else {
        warning(
          `Found a cached version of Utoo but it appears to be corrupted`
        );
      }
    }
  }

  if (!cacheHit) {
    info(`Installing Utoo version ${version} from ${registry}`);
    actualVersion = await retry(
      async () => await installUtoo(version, registry, binPath, npmCacheDir),
      3
    );
  }

  if (!actualVersion) {
    throw new Error(
      "Failed to install Utoo or get its version. Please try again."
    );
  }

  const cacheState: CacheState = {
    utooCacheEnabled,
    storeCacheEnabled,
    cacheHit,
    utooPath,
    npmCacheDir,
    version: actualVersion,
    registry,
  };

  saveState("cache", JSON.stringify(cacheState));

  return {
    version: actualVersion,
    utooPath,
    cacheHit,
  };
};

async function installUtoo(
  version: string,
  registry: string,
  binPath: string,
  npmCacheDir: string
): Promise<string | undefined> {
  const packageName = version === "latest" ? "utoo" : `utoo@${version}`;
  
  // Install utoo globally using npm with custom cache directory
  const { exitCode, stderr } = await getExecOutput(
    "npm",
    [
      "install",
      "-g",
      packageName,
      `--registry=${registry}`,
      `--prefix=${binPath.replace(/[/\\]bin$/, "")}`,
      `--cache=${npmCacheDir}`,
    ],
    {
      ignoreReturnCode: true,
    }
  );

  if (exitCode !== 0) {
    throw new Error(`Failed to install utoo: ${stderr}`);
  }

  // Check multiple possible paths for the executable
  const possiblePaths = [
    join(binPath, process.platform === "win32" ? "utoo.cmd" : "utoo"),
    join(binPath, "utoo"),
    join(binPath, "utoo.cmd"),
  ];

  for (const path of possiblePaths) {
    const version = await getUtooVersion(path);
    if (version) {
      return version;
    }
  }

  throw new Error("Utoo was installed but the executable could not be found or verified");
}

function isUtooCacheEnabled(options: Input): boolean {
  const { version, cacheUtoo } = options;
  if (!cacheUtoo) {
    return false;
  }
  if (!version || /latest/i.test(version)) {
    return false;
  }
  return isFeatureAvailable();
}

async function getUtooVersion(exe: string): Promise<string | undefined> {
  try {
    // Check if the file exists first
    if (!existsSync(exe)) {
      return undefined;
    }

    const result = await getExecOutput(exe, ["--version"], {
      ignoreReturnCode: true,
      silent: true,
    });
    
    if (result.exitCode === 0 && result.stdout.trim()) {
      // Extract version number from output like "utoo 1.0.0" or just "1.0.0"
      const match = result.stdout.trim().match(/(\d+\.\d+\.\d+(?:-[^\s]+)?)/);
      return match ? match[1] : result.stdout.trim();
    }
  } catch (error) {
    // If version check fails, utoo might not be properly installed
  }
  
  return undefined;
}