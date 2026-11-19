import request from 'supertest';
import { DataSource } from 'typeorm';
import { seed } from '../src/database/seeds/seed';
import { auth, createTestApp, login, TestApp } from './e2e-utils';

interface StudentBody {
  id: string;
  email: string;
}

describe('Seed (e2e)', () => {
  let app: TestApp;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('carga los datos la primera vez y no duplica nada la segunda', async () => {
    const first = await dataSource.transaction((manager) => seed(manager));
    const second = await dataSource.transaction((manager) => seed(manager));

    expect(first).toEqual({ areas: 5, students: 5, grades: 46, users: 3 });
    expect(second).toEqual({ areas: 0, students: 0, grades: 0, users: 0 });
  });

  it('las cuentas de prueba inician sesion y ven los datos que les tocan', async () => {
    const teacherToken = await login(
      app,
      'docente@colegio.edu.co',
      'Docente123',
    );
    const students = await request(app.getHttpServer())
      .get('/students')
      .set(auth(teacherToken))
      .expect(200);
    expect(students.body).toHaveLength(5);

    const laura = (students.body as StudentBody[]).find(
      (student) => student.email === 'laura.gomez@colegio.edu.co',
    )!;
    const lauraToken = await login(
      app,
      'laura.gomez@colegio.edu.co',
      'Estudiante123',
    );
    const grades = await request(app.getHttpServer())
      .get('/grades')
      .set(auth(lauraToken))
      .expect(200);
    expect(grades.body).toHaveLength(12);

    const analysis = await request(app.getHttpServer())
      .get(`/recommendations/students/${laura.id}`)
      .set(auth(lauraToken))
      .expect(200);
    expect(analysis.body).toMatchObject({
      strongestArea: 'Inglés',
      weakestArea: 'Matemáticas',
    });
  });

  it('no reemplaza una materia que ya existia con otro formato', async () => {
    await dataSource.query(
      'TRUNCATE TABLE "grades", "students", "areas" CASCADE',
    );
    await dataSource.query(
      `INSERT INTO "areas" ("name") VALUES ('matemáticas')`,
    );

    const summary = await dataSource.transaction((manager) => seed(manager));
    const [{ count }] = (await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "areas" WHERE LOWER("name") = 'matemáticas'`,
    )) as { count: number }[];

    expect(summary.areas).toBe(4);
    expect(count).toBe(1);
  });
});
