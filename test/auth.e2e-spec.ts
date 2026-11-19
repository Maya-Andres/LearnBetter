import request from 'supertest';
import {
  adminCredentials,
  auth,
  createAs,
  createTestApp,
  ErrorBody,
  login,
  loginAsAdmin,
  TestApp,
} from './e2e-utils';

describe('Auth (e2e)', () => {
  let app: TestApp;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('el administrador inicial entra y recibe un token sin el hash de la contrasena', async () => {
      const { email, password } = adminCredentials();
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        user: { email, role: 'ADMIN', studentId: null },
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('acepta el correo escrito en mayusculas', async () => {
      const { email, password } = adminCredentials();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: email.toUpperCase(), password })
        .expect(200);
    });

    it('contrasena incorrecta y correo inexistente dan el mismo 401', async () => {
      const { email } = adminCredentials();
      const wrongPassword = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'incorrecta' })
        .expect(401);
      const unknownEmail = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nadie@colegio.edu.co', password: 'incorrecta' })
        .expect(401);

      expect((wrongPassword.body as ErrorBody).message).toBe(
        'Correo o contraseña incorrectos',
      );
      expect((unknownEmail.body as ErrorBody).message).toBe(
        'Correo o contraseña incorrectos',
      );
    });

    it('rechaza datos invalidos con 400', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'no-es-un-correo' })
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('sin token responde 401 con un mensaje claro', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(401);

      expect((response.body as ErrorBody).message).toBe(
        'Necesitas un token válido: inicia sesión en POST /auth/login',
      );
    });

    it('con un token alterado responde 401', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set(auth(`${adminToken}x`))
        .expect(401);
    });

    it('con token devuelve el usuario actual', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set(auth(adminToken))
        .expect(200);

      expect(response.body).toMatchObject({
        email: adminCredentials().email,
        role: 'ADMIN',
      });
      expect(response.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /auth/register', () => {
    const teacher = {
      email: 'docente.auth@colegio.edu.co',
      password: 'Docente123',
      role: 'TEACHER',
    };

    it('el administrador crea un docente que luego puede iniciar sesion', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .set(auth(adminToken))
        .send(teacher)
        .expect(201);

      expect(response.body).toMatchObject({
        email: teacher.email,
        role: 'TEACHER',
      });
      expect(response.body).not.toHaveProperty('passwordHash');
      await login(app, teacher.email, teacher.password);
    });

    it('un correo repetido responde 409', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .set(auth(adminToken))
        .send({ ...teacher, email: teacher.email.toUpperCase() })
        .expect(409);
    });

    it('un docente no puede crear usuarios', async () => {
      const teacherToken = await login(app, teacher.email, teacher.password);
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .set(auth(teacherToken))
        .send({ ...teacher, email: 'otro@colegio.edu.co' })
        .expect(403);

      expect((response.body as ErrorBody).message).toBe(
        'Tu rol no tiene permiso para realizar esta acción',
      );
    });

    it('un usuario STUDENT necesita un estudiante existente y solo uno por estudiante', async () => {
      const studentId = await createAs(app, adminToken, '/students', {
        firstName: 'Ana',
        lastName: 'Ruiz',
        gradeLevel: '8B',
      });
      const studentUser = {
        email: 'ana.ruiz@colegio.edu.co',
        password: 'Estudiante123',
        role: 'STUDENT',
      };
      const register = (body: object) =>
        request(app.getHttpServer())
          .post('/auth/register')
          .set(auth(adminToken))
          .send(body);

      await register(studentUser).expect(400);
      await register({
        ...studentUser,
        studentId: '00000000-0000-4000-8000-000000000000',
      }).expect(404);
      await register({ ...studentUser, studentId }).expect(201);
      await register({
        ...studentUser,
        email: 'otra.cuenta@colegio.edu.co',
        studentId,
      }).expect(409);
    });

    it('un docente no se puede enlazar a un estudiante', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .set(auth(adminToken))
        .send({
          ...teacher,
          email: 'docente2@colegio.edu.co',
          studentId: '00000000-0000-4000-8000-000000000000',
        })
        .expect(400);
    });
  });
});
