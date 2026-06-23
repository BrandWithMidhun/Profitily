// OTel must initialize before anything else loads (side-effect import first).
import './observability/otel.js';
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { tenantContextMiddleware } from './tenant/tenant-context.middleware.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  // Signed cookies for the OAuth state nonce (CSRF). Secret = JWT_SECRET (validated by loadEnv).
  app.use(cookieParser(process.env.JWT_SECRET));
  app.use(tenantContextMiddleware);

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
