import { existsSync } from 'node:fs';

const DEFAULT_E2E_DB_NAME = 'learn_better_e2e';

// The e2e tests drop and recreate their database, so it can never be the development one:
// its name must end in "_e2e". Returns the name, which is also set as DB_NAME for the app.
export function useE2eDatabase(): string {
  if (existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  const name = process.env.E2E_DB_NAME ?? DEFAULT_E2E_DB_NAME;
  if (!/^[a-z0-9_]+_e2e$/.test(name)) {
    throw new Error(
      `E2E_DB_NAME debe terminar en "_e2e" y usar solo minúsculas, números y guiones bajos: "${name}"`,
    );
  }
  process.env.DB_NAME = name;
  return name;
}
