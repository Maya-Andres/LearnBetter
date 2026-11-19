import dataSource from '../data-source';
import { seed } from './seed';

// Entry point of `npm run seed`. Uses the same .env and connection as the migrations.
async function runSeed(): Promise<void> {
  // The demo accounts have public passwords, so production needs an explicit opt-in.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_SEED_IN_PRODUCTION !== 'true'
  ) {
    throw new Error(
      'Los datos de ejemplo tienen contraseñas públicas. Para cargarlos en producción define ALLOW_SEED_IN_PRODUCTION=true',
    );
  }

  await dataSource.initialize();
  try {
    if (await dataSource.showMigrations()) {
      throw new Error(
        'Hay migraciones pendientes: ejecuta primero npm run migration:run',
      );
    }

    // All or nothing: a failure halfway leaves the database as it was.
    const summary = await dataSource.transaction((manager) => seed(manager));
    const created = Object.values(summary).reduce((sum, n) => sum + n, 0);
    console.log(
      created === 0
        ? 'Los datos de ejemplo ya estaban cargados: no se creó nada nuevo.'
        : `Datos de ejemplo cargados: ${summary.areas} materias, ${summary.students} estudiantes, ${summary.grades} notas y ${summary.users} usuarios nuevos.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

runSeed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
