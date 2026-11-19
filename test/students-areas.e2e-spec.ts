import request from 'supertest';
import {
  auth,
  createAs,
  createTestApp,
  ErrorBody,
  login,
  loginAsAdmin,
  TestApp,
} from './e2e-utils';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Students and areas (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    await createAs(app, adminToken, '/auth/register', {
      email: 'docente@colegio.edu.co',
      password: 'Docente123',
      role: 'TEACHER',
    });
    teacherToken = await login(app, 'docente@colegio.edu.co', 'Docente123');

    const studentId = await createAs(app, adminToken, '/students', {
      firstName: 'Pedro',
      lastName: 'Diaz',
      gradeLevel: '7A',
    });
    await createAs(app, adminToken, '/auth/register', {
      email: 'pedro@colegio.edu.co',
      password: 'Estudiante123',
      role: 'STUDENT',
      studentId,
    });
    studentToken = await login(app, 'pedro@colegio.edu.co', 'Estudiante123');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/students', () => {
    const laura = {
      firstName: 'Laura',
      lastName: 'Gómez',
      email: 'laura.gomez@colegio.edu.co',
      gradeLevel: '9A',
    };
    let lauraId: string;

    it('el administrador crea un estudiante', async () => {
      const response = await request(app.getHttpServer())
        .post('/students')
        .set(auth(adminToken))
        .send(laura)
        .expect(201);

      expect(response.body).toMatchObject({ id: expect.any(String), ...laura });
      lauraId = (response.body as { id: string }).id;
    });

    it('el docente lista y consulta estudiantes pero no los crea', async () => {
      const list = await request(app.getHttpServer())
        .get('/students')
        .set(auth(teacherToken))
        .expect(200);
      expect(list.body).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: lauraId })]),
      );

      await request(app.getHttpServer())
        .get(`/students/${lauraId}`)
        .set(auth(teacherToken))
        .expect(200);
      await request(app.getHttpServer())
        .post('/students')
        .set(auth(teacherToken))
        .send({ ...laura, email: 'otro@colegio.edu.co' })
        .expect(403);
    });

    it('un estudiante no puede ver la lista de estudiantes', () => {
      return request(app.getHttpServer())
        .get('/students')
        .set(auth(studentToken))
        .expect(403);
    });

    it('valida los datos y rechaza campos que no existen', async () => {
      const missing = await request(app.getHttpServer())
        .post('/students')
        .set(auth(adminToken))
        .send({ lastName: 'Sin nombre', gradeLevel: '9A' })
        .expect(400);
      expect((missing.body as ErrorBody).message).toEqual(
        expect.arrayContaining(['firstName should not be empty']),
      );

      const extra = await request(app.getHttpServer())
        .post('/students')
        .set(auth(adminToken))
        .send({ ...laura, email: 'extra@colegio.edu.co', isAdmin: true })
        .expect(400);
      expect((extra.body as ErrorBody).message).toEqual([
        'property isAdmin should not exist',
      ]);
    });

    it('un correo repetido responde 409', () => {
      return request(app.getHttpServer())
        .post('/students')
        .set(auth(adminToken))
        .send(laura)
        .expect(409);
    });

    it('un id invalido responde 400 y uno inexistente 404', async () => {
      await request(app.getHttpServer())
        .get('/students/no-es-un-uuid')
        .set(auth(adminToken))
        .expect(400);
      await request(app.getHttpServer())
        .get(`/students/${MISSING_ID}`)
        .set(auth(adminToken))
        .expect(404);
    });

    it('el administrador edita y borra un estudiante', async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/students/${lauraId}`)
        .set(auth(adminToken))
        .send({ gradeLevel: '10A' })
        .expect(200);
      expect(updated.body).toMatchObject({ id: lauraId, gradeLevel: '10A' });

      await request(app.getHttpServer())
        .patch(`/students/${lauraId}`)
        .set(auth(teacherToken))
        .send({ gradeLevel: '11A' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/students/${lauraId}`)
        .set(auth(adminToken))
        .expect(204);
      await request(app.getHttpServer())
        .get(`/students/${lauraId}`)
        .set(auth(adminToken))
        .expect(404);
    });
  });

  describe('/areas', () => {
    let areaId: string;

    it('el administrador crea una materia y el docente la ve', async () => {
      areaId = await createAs(app, adminToken, '/areas', {
        name: 'Matemáticas',
        description: 'Álgebra, geometría y estadística',
      });

      const response = await request(app.getHttpServer())
        .get(`/areas/${areaId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(response.body).toMatchObject({ name: 'Matemáticas' });
    });

    it('el nombre no se puede repetir aunque cambien mayusculas o espacios', () => {
      return request(app.getHttpServer())
        .post('/areas')
        .set(auth(adminToken))
        .send({ name: '  MATEMÁTICAS ' })
        .expect(409);
    });

    it('el docente no edita materias y el estudiante no las ve', async () => {
      await request(app.getHttpServer())
        .patch(`/areas/${areaId}`)
        .set(auth(teacherToken))
        .send({ description: 'Otra' })
        .expect(403);
      await request(app.getHttpServer())
        .get('/areas')
        .set(auth(studentToken))
        .expect(403);
    });

    it('al borrar una materia se borran sus notas', async () => {
      const studentId = await createAs(app, adminToken, '/students', {
        firstName: 'Sofia',
        lastName: 'Castro',
        gradeLevel: '9B',
      });
      const gradeId = await createAs(app, teacherToken, '/grades', {
        studentId,
        areaId,
        score: 4,
        period: 1,
      });

      await request(app.getHttpServer())
        .delete(`/areas/${areaId}`)
        .set(auth(adminToken))
        .expect(204);
      await request(app.getHttpServer())
        .get(`/grades/${gradeId}`)
        .set(auth(adminToken))
        .expect(404);
    });
  });
});
