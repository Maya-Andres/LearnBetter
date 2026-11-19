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

interface GradeBody {
  id: string;
  studentId: string;
  areaId: string;
  score: number;
  period: number;
}

interface AreaAnalysisBody {
  areaName: string;
  average: number;
  level: string;
  trend: string;
  recommendations: string[];
}

interface StudentAnalysisBody {
  overallAverage: number | null;
  level: string | null;
  strongestArea: string | null;
  weakestArea: string | null;
  areas: AreaAnalysisBody[];
  generalRecommendations: string[];
}

describe('Grades and recommendations (e2e)', () => {
  let app: TestApp;
  let adminToken: string;
  let teacherToken: string;
  let lauraToken: string;
  let mathId: string;
  let englishId: string;
  let lauraId: string;
  let santiagoId: string;
  let isabellaId: string;
  let lauraMathGradeId: string;
  let santiagoGradeId: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAsAdmin(app);

    mathId = await createAs(app, adminToken, '/areas', { name: 'Matemáticas' });
    englishId = await createAs(app, adminToken, '/areas', { name: 'Inglés' });

    const student = (firstName: string) =>
      createAs(app, adminToken, '/students', {
        firstName,
        lastName: 'Prueba',
        gradeLevel: '9A',
      });
    lauraId = await student('Laura');
    santiagoId = await student('Santiago');
    isabellaId = await student('Isabella');

    await createAs(app, adminToken, '/auth/register', {
      email: 'docente@colegio.edu.co',
      password: 'Docente123',
      role: 'TEACHER',
    });
    teacherToken = await login(app, 'docente@colegio.edu.co', 'Docente123');

    await createAs(app, adminToken, '/auth/register', {
      email: 'laura@colegio.edu.co',
      password: 'Estudiante123',
      role: 'STUDENT',
      studentId: lauraId,
    });
    lauraToken = await login(app, 'laura@colegio.edu.co', 'Estudiante123');

    const grade = (
      studentId: string,
      areaId: string,
      score: number,
      period: number,
    ) =>
      createAs(app, teacherToken, '/grades', {
        studentId,
        areaId,
        score,
        period,
      });
    // Laura: low but improving and irregular in math, superior and stable in English.
    lauraMathGradeId = await grade(lauraId, mathId, 1.9, 1);
    await grade(lauraId, mathId, 3.0, 2);
    await grade(lauraId, mathId, 3.5, 3);
    await grade(lauraId, englishId, 4.7, 1);
    await grade(lauraId, englishId, 4.9, 2);
    // Santiago: high but declining in math.
    santiagoGradeId = await grade(santiagoId, mathId, 4.5, 1);
    await grade(santiagoId, mathId, 3.9, 2);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/grades', () => {
    it('devuelve el puntaje como numero aunque postgres lo guarde como decimal', async () => {
      const response = await request(server())
        .get(`/grades/${lauraMathGradeId}`)
        .set(auth(teacherToken))
        .expect(200);

      expect(response.body).toMatchObject({
        studentId: lauraId,
        areaId: mathId,
        score: 1.9,
        period: 1,
      });
    });

    it.each([
      ['un puntaje mayor que 5', { score: 5.5, period: 1 }],
      ['un puntaje menor que 0', { score: -1, period: 1 }],
      ['mas de dos decimales', { score: 4.123, period: 1 }],
      ['un periodo fuera de 1 a 4', { score: 4, period: 5 }],
    ])('rechaza con 400 %s', async (_case, values) => {
      await request(server())
        .post('/grades')
        .set(auth(teacherToken))
        .send({ studentId: lauraId, areaId: mathId, ...values })
        .expect(400);
    });

    it('responde 404 si el estudiante o la materia no existen', async () => {
      await request(server())
        .post('/grades')
        .set(auth(teacherToken))
        .send({ studentId: MISSING_ID, areaId: mathId, score: 4, period: 1 })
        .expect(404);
      await request(server())
        .post('/grades')
        .set(auth(teacherToken))
        .send({ studentId: lauraId, areaId: MISSING_ID, score: 4, period: 1 })
        .expect(404);
    });

    it('filtra por estudiante, materia y periodo', async () => {
      const byStudent = await request(server())
        .get('/grades')
        .query({ studentId: lauraId })
        .set(auth(teacherToken))
        .expect(200);
      expect(byStudent.body).toHaveLength(5);

      const combined = await request(server())
        .get('/grades')
        .query({ studentId: lauraId, areaId: mathId, period: 2 })
        .set(auth(teacherToken))
        .expect(200);
      expect(combined.body).toEqual([
        expect.objectContaining({ score: 3, period: 2 }),
      ]);

      await request(server())
        .get('/grades')
        .query({ period: 'uno' })
        .set(auth(teacherToken))
        .expect(400);
    });

    it('el docente edita y borra notas, pero no puede cambiar de estudiante', async () => {
      const gradeId = await createAs(app, teacherToken, '/grades', {
        studentId: isabellaId,
        areaId: mathId,
        score: 2,
        period: 1,
      });

      const updated = await request(server())
        .patch(`/grades/${gradeId}`)
        .set(auth(teacherToken))
        .send({ score: 2.5 })
        .expect(200);
      expect((updated.body as GradeBody).score).toBe(2.5);

      await request(server())
        .patch(`/grades/${gradeId}`)
        .set(auth(teacherToken))
        .send({ studentId: lauraId })
        .expect(400);

      await request(server())
        .delete(`/grades/${gradeId}`)
        .set(auth(teacherToken))
        .expect(204);
    });

    it('un estudiante solo recibe sus propias notas', async () => {
      const response = await request(server())
        .get('/grades')
        .set(auth(lauraToken))
        .expect(200);
      const grades = response.body as GradeBody[];

      expect(grades).toHaveLength(5);
      expect(grades.every((grade) => grade.studentId === lauraId)).toBe(true);
    });

    it('un estudiante no puede ver ni registrar notas de otros', async () => {
      const filtered = await request(server())
        .get('/grades')
        .query({ studentId: santiagoId })
        .set(auth(lauraToken))
        .expect(403);
      expect((filtered.body as ErrorBody).message).toBe(
        'Solo puedes consultar tu propia información',
      );

      await request(server())
        .get(`/grades/${santiagoGradeId}`)
        .set(auth(lauraToken))
        .expect(403);
      await request(server())
        .get(`/grades/${lauraMathGradeId}`)
        .set(auth(lauraToken))
        .expect(200);
      await request(server())
        .post('/grades')
        .set(auth(lauraToken))
        .send({ studentId: lauraId, areaId: mathId, score: 5, period: 4 })
        .expect(403);
    });

    it('un usuario cuyo estudiante fue borrado ya no ve notas', async () => {
      const studentId = await createAs(app, adminToken, '/students', {
        firstName: 'Temporal',
        lastName: 'Prueba',
        gradeLevel: '9A',
      });
      await createAs(app, adminToken, '/auth/register', {
        email: 'temporal@colegio.edu.co',
        password: 'Estudiante123',
        role: 'STUDENT',
        studentId,
      });
      const token = await login(
        app,
        'temporal@colegio.edu.co',
        'Estudiante123',
      );
      await request(server())
        .delete(`/students/${studentId}`)
        .set(auth(adminToken))
        .expect(204);

      const response = await request(server())
        .get('/grades')
        .set(auth(token))
        .expect(403);
      expect((response.body as ErrorBody).message).toBe(
        'Tu usuario no está enlazado a un estudiante',
      );
    });
  });

  describe('/recommendations', () => {
    it('analiza al estudiante: promedio, nivel, materias y consejos', async () => {
      const response = await request(server())
        .get(`/recommendations/students/${lauraId}`)
        .set(auth(lauraToken))
        .expect(200);
      const analysis = response.body as StudentAnalysisBody;

      expect(analysis).toMatchObject({
        overallAverage: 3.8,
        level: 'BASICO',
        strongestArea: 'Inglés',
        weakestArea: 'Matemáticas',
      });
      const [math, english] = analysis.areas;
      expect(math).toMatchObject({
        areaName: 'Matemáticas',
        average: 2.8,
        level: 'BAJO',
        trend: 'MEJORANDO',
      });
      expect(math.recommendations.join(' ')).toContain('irregulares');
      expect(english).toMatchObject({
        areaName: 'Inglés',
        average: 4.8,
        level: 'SUPERIOR',
        trend: 'ESTABLE',
      });
      expect(analysis.generalRecommendations[0]).toBe(
        'Prioriza las áreas que estás perdiendo (Matemáticas): asígnales las primeras horas de tu jornada de estudio.',
      );
    });

    it('detecta cuando las notas vienen bajando', async () => {
      const response = await request(server())
        .get(`/recommendations/students/${santiagoId}/areas/${mathId}`)
        .set(auth(teacherToken))
        .expect(200);

      expect(response.body).toMatchObject({
        average: 4.2,
        level: 'ALTO',
        trend: 'BAJANDO',
        gradesCount: 2,
      });
    });

    it('un estudiante sin notas recibe un aviso en vez de un analisis', async () => {
      const response = await request(server())
        .get(`/recommendations/students/${isabellaId}`)
        .set(auth(teacherToken))
        .expect(200);

      expect(response.body).toMatchObject({
        overallAverage: null,
        level: null,
        areas: [],
        generalRecommendations: [
          'Aún no hay notas registradas para este alumno. Registra notas para generar recomendaciones.',
        ],
      });
    });

    it('responde 404 sin notas en la materia o si el estudiante no existe', async () => {
      await request(server())
        .get(`/recommendations/students/${isabellaId}/areas/${englishId}`)
        .set(auth(teacherToken))
        .expect(404);
      await request(server())
        .get(`/recommendations/students/${MISSING_ID}`)
        .set(auth(teacherToken))
        .expect(404);
    });

    it('un estudiante no puede ver las recomendaciones de otro', () => {
      return request(server())
        .get(`/recommendations/students/${santiagoId}`)
        .set(auth(lauraToken))
        .expect(403);
    });
  });
});
