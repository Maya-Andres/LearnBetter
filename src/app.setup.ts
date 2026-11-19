import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { setupSwagger } from './swagger';

// Shared by main.ts and the e2e tests, so the tests exercise the same app that runs in production.
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  setupSwagger(app);
}
