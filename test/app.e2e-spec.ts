import request from 'supertest';
import { createTestApp, ErrorBody, TestApp } from './e2e-utils';

describe('App (e2e)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / responde sin token', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('GET /health indica que la api y la base de datos estan arriba', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
  });

  it('GET /docs-json publica la documentacion con autenticacion bearer', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as {
      paths: Record<string, unknown>;
      components: { securitySchemes: Record<string, { scheme: string }> };
    };

    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/auth/login',
        '/students',
        '/areas',
        '/grades',
        '/recommendations/students/{studentId}',
        '/health',
      ]),
    );
    expect(document.components.securitySchemes.bearer.scheme).toBe('bearer');
  });

  it('agrega las cabeceras de seguridad de helmet', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('los errores siempre tienen el mismo formato', async () => {
    const response = await request(app.getHttpServer())
      .get('/no-existe')
      .expect(404);
    const body = response.body as ErrorBody;

    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: expect.any(String),
      path: '/no-existe',
      timestamp: expect.any(String),
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
