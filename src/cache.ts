import { join } from "node:path";

const CACHE_SCHEMA = "v2";
const COMMANDS = ["utoo", "ut", "utx"];
const WINDOWS_SHIM_EXTENSIONS = ["", ".cmd", ".ps1", ".exe"];

export type UtooLayout = {
  binPath: string;
  packagePath: string;
  cachePaths: string[];
};

export function getUtooCacheKey(
  version: string,
  platform = process.platform,
  arch = process.arch
): string {
  return `utoo-binary-${CACHE_SCHEMA}-${version}-${platform}-${arch}`;
}

export function getUtooLayout(
  npmPrefix: string,
  platform = process.platform
): UtooLayout {
  const isWindows = platform === "win32";
  const binPath = isWindows ? npmPrefix : join(npmPrefix, "bin");
  const packagePath = isWindows
    ? join(npmPrefix, "node_modules", "utoo")
    : join(npmPrefix, "lib", "node_modules", "utoo");
  const cachePaths = isWindows
    ? COMMANDS.flatMap((command) =>
        WINDOWS_SHIM_EXTENSIONS.map((extension) =>
          join(binPath, `${command}${extension}`)
        )
      )
    : COMMANDS.map((command) => join(binPath, command));

  return {
    binPath,
    packagePath,
    cachePaths: [...cachePaths, packagePath],
  };
}
