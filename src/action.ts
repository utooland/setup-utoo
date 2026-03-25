import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { addPath, info, warning } from "@actions/core";
import { isFeatureAvailable, restoreCache } from "@actions/cache";
import { getExecOutput } from "@actions/exec";
import { saveState } from "@actions/core";
import { retry } from "./utils";

const NPMMIRROR_REGISTRY = "https://registry.npmmirror.com";

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
  utooCachePaths: string[];
  version: string;
  resolvedVersion: string;
  registry: string;
};

export default async (options: Input): Promise<Output> => {
  const version = options.version || "latest";
  const registry = options.registry || "https://registry.npmjs.org/";
  const utooCacheEnabled = isUtooCacheEnabled(options);
  const storeCacheEnabled = options.cacheStore === true && isFeatureAvailable();

  // Setup npm cache and bin directories
  const StoreCacheDir = join(homedir(), ".cache", "nm");
  const binPath = join(homedir(), ".npm", "bin");
  const npmLibDir = join(homedir(), ".npm", "lib", "node_modules", "utoo");

  // Define specific paths to cache for Utoo
  const utooCachePaths = [
    join(binPath, "utoo"),
    join(binPath, "ut"),
    join(binPath, "utx"),
    npmLibDir,
  ];

  try {
    mkdirSync(binPath, { recursive: true });
    mkdirSync(StoreCacheDir, { recursive: true });
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }

  addPath(binPath);

  const utooPath = join(binPath, "utoo");

  let actualVersion: string | undefined;
  let cacheHit = false;

  // Resolve version to actual version number for cache key
  let resolvedVersion = version;
  if (utooCacheEnabled) {
    resolvedVersion = await resolveVersion(version, registry);
  }

  // Handle Utoo binary cache
  if (utooCacheEnabled) {
    const utooCacheKey = `utoo-binary-${resolvedVersion}-${process.platform}-${process.arch}`;

    info(`Attempting to restore Utoo binary cache with key: ${utooCacheKey}`);
    const utooCacheRestored = await restoreCache(utooCachePaths, utooCacheKey);

    if (utooCacheRestored) {
      info(`Restored Utoo binary from cache`);

      // Verify the cached utoo is working by checking package.json
      actualVersion = await getUtooVersion(binPath);

      if (actualVersion) {
        info(`Using cached Utoo version ${actualVersion}`);
        cacheHit = true;
      } else {
        info(`Cached Utoo binary is invalid, will reinstall`);
      }
    }
  }

  // Handle npm store cache
  if (storeCacheEnabled && !cacheHit) {
    const storeCacheKey = `utoo-store-${registry}`;

    const storeCacheRestored = await restoreCache([StoreCacheDir], storeCacheKey);
    if (storeCacheRestored) {
      info(`Restored npm cache from store cache`);
    }
  }

  // Install Utoo if not restored from cache
  if (!cacheHit) {
    info(`Installing Utoo version ${version} from ${registry}`);
    actualVersion = await retry(
      async () => await installUtoo(version, registry, binPath),
      3
    );

    if (!actualVersion) {
      throw new Error(
        "Failed to install Utoo or get its version. Please try again."
      );
    }
  }

  const cacheState: CacheState = {
    utooCacheEnabled,
    storeCacheEnabled,
    cacheHit,
    utooPath,
    npmCacheDir: StoreCacheDir,
    utooCachePaths,
    version: actualVersion,
    resolvedVersion,
    registry,
  };

  saveState("cache", JSON.stringify(cacheState));

  if (!registry.includes(NPMMIRROR_REGISTRY)) {
    await setRegistry(registry);
  }

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
    ],
    {
      ignoreReturnCode: true,
    }
  );

  if (exitCode !== 0) {
    throw new Error(`Failed to install utoo: ${stderr}`);
  }

  // Verify installation by reading package.json
  const installedVersion = await getUtooVersion(binPath);
  if (installedVersion) {
    return installedVersion;
  }

  throw new Error("Utoo was installed but package.json could not be found or read");
}

function isUtooCacheEnabled(options: Input): boolean {
  const { cacheUtoo } = options;
  if (!cacheUtoo) {
    return false;
  }
  return isFeatureAvailable();
}

async function setRegistry(registry: string): Promise<void> {
  try {
    const { exitCode, stderr } = await getExecOutput("ut", [
      "config",
      "set",
      "registry",
      registry,
      '--global',
    ]);

    if (exitCode !== 0) {
      warning(`Failed to set npm registry: ${stderr}`);
    }
  } catch (error) {
    // warning(`Failed to set npm registry: ${error.message}`);
  }
}

async function getUtooVersion(binPath: string): Promise<string | undefined> {
  const prefixDir = binPath.replace(/[/\\]bin$/, "");

  // npm global layout differs by platform:
  //   Unix:    {prefix}/lib/node_modules/utoo/package.json
  //   Windows: {prefix}/node_modules/utoo/package.json
  const candidates = [
    join(prefixDir, "lib", "node_modules", "utoo", "package.json"),
    join(prefixDir, "node_modules", "utoo", "package.json"),
  ];

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;

      const fs = await import("node:fs/promises");
      const content = await fs.readFile(candidate, "utf-8");
      const packageJson = JSON.parse(content);

      if (packageJson.version) return packageJson.version;
    } catch {
      continue;
    }
  }

  return undefined;
}

async function resolveVersion(
  version: string,
  registry: string
): Promise<string> {
  // If it's already a specific version (e.g., "1.0.0"), return as-is
  if (/^\d+\.\d+\.\d+/.test(version)) {
    return version;
  }

  // For "latest" or version ranges, fetch from registry
  try {
    info(`Resolving version "${version}" from registry...`);

    const manifestUrl = `${registry.replace(/\/$/, '')}/utoo/${version}`;
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      warning(`Failed to fetch version manifest: ${response.statusText}`);
      return version; // Fallback to original version string
    }

    const manifest = await response.json();
    const resolvedVersion = manifest.version;

    if (resolvedVersion) {
      info(`Resolved "${version}" to "${resolvedVersion}"`);
      return resolvedVersion;
    }
  } catch (error) {
    warning(`Failed to resolve version: ${error}`);
  }

  return version; // Fallback to original version string
}
