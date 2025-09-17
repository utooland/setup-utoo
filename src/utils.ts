import { info } from "@actions/core";

export async function retry<T>(
  fn: () => Promise<T>,
  retries: number
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < retries) {
        info(`Attempt ${i + 1} failed, retrying... (${error})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  
  throw lastError!;
}

export function addExtension(filePath: string, extension: string): string {
  return filePath.endsWith(extension) ? filePath : filePath + extension;
}