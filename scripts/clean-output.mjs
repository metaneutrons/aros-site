import { rm } from 'node:fs/promises';

try {
  await Promise.all([
    rm('dist', { recursive: true, force: true }),
    rm('.wrangler-output', { recursive: true, force: true }),
  ]);
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
