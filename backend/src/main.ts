import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Cloud hosts (Render, Railway, etc.) inject the port via PORT; fall back to
  // BACKEND_PORT for local dev, then a sane default.
  const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 4000);
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.use(helmet());
  app.enableCors({ origin: corsOrigins, credentials: true });

  // All routes are prefixed with /api/v1
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI / Swagger documentation at /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('EOS — Education Operating System API')
    .setDescription('REST API for the Education Operating System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`EOS backend listening on http://localhost:${port}/api/v1`);
}
bootstrap();
