import { execSync } from 'node:child_process';
import { DataSource } from 'typeorm';
import { useE2eDatabase } from './e2e-env';

// Runs once before every e2e file: an empty database with all the migrations applied.
export default async function globalSetup(): Promise<void> {
  const name = useE2eDatabase();
  await recreateDatabase(name);
  runMigrations();
}

async function recreateDatabase(name: string): Promise<void> {
  // CREATE and DROP DATABASE have to run from another database.
  const server = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await server.initialize();
  try {
    await server.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await server.query(`CREATE DATABASE "${name}"`);
  } finally {
    await server.destroy();
  }
}

// The same command used in development, so the tests also prove the migrations work from scratch.
function runMigrations(): void {
  try {
    execSync('npm run migration:run', { stdio: 'pipe', env: process.env });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    console.error(stdout?.toString(), stderr?.toString());
    throw new Error(
      'No se pudieron aplicar las migraciones en la base de datos de e2e',
    );
  }
}
