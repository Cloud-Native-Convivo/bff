import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const globalPrefix = process.env.GLOBAL_PREFIX ?? 'api';
  app.setGlobalPrefix(globalPrefix);

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  Logger.log(
    `CONVIVO BFF corriendo en http://localhost:${port}/${globalPrefix}`,
    'Bootstrap'
  );
}

void bootstrap();
