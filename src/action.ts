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
  noCache?: boolean;
};

export type Output = {
  version: string;
  utooPath: string;
  cacheHit: boolean;
};

export type CacheState = {
  cacheEnabled: boolean;
  cacheHit: boolean;
  utooPath: string;
  version: string;
  registry: string;
};

export default async (options: Input): Promise<Output> => {
  const version = options.version || "latest";
  const registry = options.registry || "https://registry.npmjs.org/";
  const cacheEnabled = isCacheEnabled(options);

  // Setup npm cache and bin directories
  const npmCacheDir = join(homedir(), ".npm");
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

  if (cacheEnabled) {
    const cacheKey = createHash("sha1")
      .update(`utoo-${version}-${registry}`)
      .digest("base64");

    const cacheRestored = await restoreCache([binPath], cacheKey);
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
      async () => await installUtoo(version, registry, binPath),
      3
    );
  }

  if (!actualVersion) {
    throw new Error(
      "Failed to install Utoo or get its version. Please try again."
    );
  }

  const cacheState: CacheState = {
    cacheEnabled,
    cacheHit,
    utooPath,
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
  binPath: string
): Promise<string | undefined> {
  const packageName = version === "latest" ? "utoo" : `utoo@${version}`;
  
  // Install utoo globally using npm
  const { exitCode, stderr } = await getExecOutput(
    "npm",
    [
      "install",
      "-g",
      packageName,
      `--registry=${registry}`,
      `--prefix=${binPath.replace(/bin$/, "")}`,
    ],
    {
      ignoreReturnCode: true,
    }
  );

  if (exitCode !== 0) {
    throw new Error(`Failed to install utoo: ${stderr}`);
  }

  const utooPath = join(binPath, process.platform === "win32" ? "utoo.cmd" : "utoo");
  return await getUtooVersion(utooPath);
}

function isCacheEnabled(options: Input): boolean {
  const { version, noCache } = options;
  if (noCache) {
    return false;
  }
  if (!version || /latest/i.test(version)) {
    return false;
  }
  return isFeatureAvailable();
}

async function getUtooVersion(exe: string): Promise<string | undefined> {
  try {
    const result = await getExecOutput(exe, ["--version"], {
      ignoreReturnCode: true,
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