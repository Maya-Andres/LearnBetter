import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

export type TestApp = INestApplication<App>;

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

// Every e2e file starts from empty tables; the admin is created again when the app starts.
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  await moduleRef
    .get(DataSource)
    .query('TRUNCATE TABLE "grades", "users", "students", "areas" CASCADE');

  const app = moduleRef.createNestApplication<TestApp>({
    logger: ['error', 'warn'],
  });
  configureApp(app);
  await app.init();
  return app;
}

export function adminCredentials(): { email: string; password: string } {
  return {
    email: process.env.ADMIN_EMAIL!,
    password: process.env.ADMIN_PASSWORD!,
  };
}

export async function login(
  app: TestApp,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return (response.body as { accessToken: string }).accessToken;
}

export function loginAsAdmin(app: TestApp): Promise<string> {
  const { email, password } = adminCredentials();
  return login(app, email, password);
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

// Creates a resource as the given user and returns its id.
export async function createAs(
  app: TestApp,
  token: string,
  path: string,
  body: object,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post(path)
    .set(auth(token))
    .send(body)
    .expect(201);
  return (response.body as { id: string }).id;
}
