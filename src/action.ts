import { homedir, platform } from "node:os";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { addPath, info, warning } from "@actions/core";
import { isFeatureAvailable, restoreCache } from "@actions/cache";
import { getExecOutput } from "@actions/exec";
import { saveState } from "@actions/core";
import { retry } from "./utils";

const NPMMIRROR_REGISTRY = "https://registry.npmmirror.com";
const IS_WINDOWS = platform() === "win32";

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
  const prefixDir = join(homedir(), ".npm");
  const binPath = join(prefixDir, "bin");
  const npmLibDir = getNpmGlobalModulePath(prefixDir, "utoo");

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
  if (IS_WINDOWS) {
    // On Windows, npm global installs put binaries in <prefix>/ not <prefix>/bin/
    addPath(prefixDir);
  }

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
    const utooCacheKey = `utoo-binary-${resolvedVersion}`;

    info(`Attempting to restore Utoo binary cache with key: ${utooCacheKey}`);
    const utooCacheRestored = await restoreCache(utooCachePaths, utooCacheKey);

    if (utooCacheRestored) {
      info(`Restored Utoo binary from cache`);

      // Verify the cached utoo is working by checking package.json
      actualVersion = await getUtooVersion(prefixDir);

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
      async () => await installUtoo(version, registry, prefixDir),
      3
    );

    if (!actualVersion) {
      throw new Error(
        "Failed to install Utoo or get its version. Please try again."
      );
    }
  }

  // On Windows, fix up npm-generated shims that don't work:
  // - .ps1 shims use #!/bin/bash which PowerShell can't resolve
  // - bin/utoo is a PE binary without .exe extension
  // - bash can't execute PE binaries directly (needed for npm script execution)
  if (IS_WINDOWS) {
    fixWindowsShims(prefixDir);
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
  prefixDir: string,
): Promise<string | undefined> {
  const packageName = version === "latest" ? "utoo" : `utoo@${version}`;

  const { exitCode, stderr } = await getExecOutput(
    "npm",
    [
      "install",
      "-g",
      packageName,
      `--registry=${registry}`,
      `--prefix=${prefixDir}`,
    ],
    {
      ignoreReturnCode: true,
    }
  );

  if (exitCode !== 0) {
    throw new Error(`Failed to install utoo: ${stderr}`);
  }

  // On Windows, npm postinstall.sh (bash) may not run properly.
  // Manually run it with Git Bash or copy the native binary.
  if (IS_WINDOWS) {
    ensureNativeBinary(prefixDir);
  }

  const installedVersion = await getUtooVersion(prefixDir);
  if (installedVersion) {
    return installedVersion;
  }

  throw new Error("Utoo was installed but package.json could not be found or read");
}

/**
 * On Windows, ensure the native utoo binary is installed.
 * npm's postinstall.sh uses bash which may not run on Windows.
 * Try Git Bash first, then manually copy from platform-specific package.
 */
function ensureNativeBinary(prefixDir: string): void {
  const fs = require("node:fs") as typeof import("node:fs");
  const utooModDir = getNpmGlobalModulePath(prefixDir, "utoo");
  const utooBinPath = join(utooModDir, "bin", "utoo");

  // Check if the binary is still a placeholder
  try {
    const content = fs.readFileSync(utooBinPath, "utf-8");
    if (!content.includes("placeholder")) {
      return; // Already a real binary
    }
  } catch {
    return; // File is binary or doesn't exist
  }

  // Try running postinstall.sh with Git Bash
  const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  const postinstallSh = join(utooModDir, "postinstall.sh");

  if (existsSync(gitBash) && existsSync(postinstallSh)) {
    info("Running postinstall.sh with Git Bash...");
    const { execSync } = require("node:child_process");
    try {
      execSync(`"${gitBash}" ./postinstall.sh`, {
        cwd: utooModDir,
        stdio: "inherit",
      });
      // Verify it worked
      try {
        const content = fs.readFileSync(utooBinPath, "utf-8");
        if (!content.includes("placeholder")) {
          info("postinstall.sh installed native binary successfully");
          return;
        }
      } catch {
        return; // Now binary
      }
    } catch (e: any) {
      warning(`postinstall.sh failed: ${e.message}`);
    }
  }

  // Fallback: manually copy from platform-specific package
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const platformPkg = `@utoo/utoo-win32-${arch}`;
  const candidates = [
    join(utooModDir, "node_modules", platformPkg, "bin", "utoo"),
    join(prefixDir, "node_modules", platformPkg, "bin", "utoo"),
    join(prefixDir, "lib", "node_modules", platformPkg, "bin", "utoo"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        fs.copyFileSync(candidate, utooBinPath);
        info(`Copied native binary from ${candidate}`);
        return;
      } catch (e: any) {
        warning(`Failed to copy from ${candidate}: ${e.message}`);
      }
    }
  }

  warning("Could not install native binary for Windows");
}

/**
 * Fix Windows shim issues after install:
 * 1. Remove .ps1 shims (use /bin/bash which PowerShell can't resolve)
 * 2. Create .cmd shims pointing to the .exe binary
 * 3. Create bash shims for npm script execution (bash can't run PE directly)
 */
function fixWindowsShims(prefixDir: string): void {
  const fs = require("node:fs") as typeof import("node:fs");
  const utooModDir = getNpmGlobalModulePath(prefixDir, "utoo");
  const utooBin = join(utooModDir, "bin", "utoo");
  const utooExe = utooBin + ".exe";

  // Ensure .exe copy exists
  if (!existsSync(utooExe) && existsSync(utooBin)) {
    try {
      fs.copyFileSync(utooBin, utooExe);
    } catch { /* ignore */ }
  }

  for (const name of ["utoo", "ut"]) {
    // Remove broken .ps1 shim (PowerShell prioritizes .ps1 over .cmd)
    const ps1Path = join(prefixDir, `${name}.ps1`);
    try {
      if (existsSync(ps1Path)) fs.unlinkSync(ps1Path);
    } catch { /* ignore */ }

    // .cmd shim for PowerShell/cmd.exe
    const cmdPath = join(prefixDir, `${name}.cmd`);
    try {
      fs.writeFileSync(cmdPath, `@"${utooExe}" %*\r\n`);
    } catch { /* ignore */ }

    // bash shim (no extension) for npm script execution
    const bashShimPath = join(prefixDir, name);
    try {
      fs.writeFileSync(bashShimPath, `#!/bin/sh\nexec "${utooExe}" "$@"\n`);
    } catch { /* ignore */ }
  }

  info("Windows shims configured");
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
    const { exitCode, stderr } = await getExecOutput("utoo", [
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
    // ignore
  }
}

async function getUtooVersion(prefixDir: string): Promise<string | undefined> {
  try {
    const packageJsonPath = join(
      getNpmGlobalModulePath(prefixDir, "utoo"),
      "package.json"
    );

    if (!existsSync(packageJsonPath)) {
      return undefined;
    }

    const fs = await import("node:fs/promises");
    const content = await fs.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);

    return packageJson.version;
  } catch (error) {
    return undefined;
  }
}

/**
 * Get the npm global module path for a package.
 * Windows: <prefix>/node_modules/<pkg>
 * Linux/macOS: <prefix>/lib/node_modules/<pkg>
 */
function getNpmGlobalModulePath(prefix: string, pkg: string): string {
  if (IS_WINDOWS) {
    return join(prefix, "node_modules", pkg);
  }
  return join(prefix, "lib", "node_modules", pkg);
}

async function resolveVersion(
  version: string,
  registry: string
): Promise<string> {
  if (/^\d+\.\d+\.\d+/.test(version)) {
    return version;
  }

  try {
    info(`Resolving version "${version}" from registry...`);

    const manifestUrl = `${registry.replace(/\/$/, '')}/utoo/${version}`;
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      warning(`Failed to fetch version manifest: ${response.statusText}`);
      return version;
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

  return version;
}
