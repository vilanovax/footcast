import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { getConfig } from '@footcast/config';
import { createLogger } from '@footcast/logger';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const config = getConfig();
  const logger = createLogger({ service: 'api' });
  const app = await NestFactory.create(AppModule, { logger: false });

  app.use(helmet());
  app.enableCors({
    origin: config.WEB_ORIGIN,
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle(config.PRODUCT_NAME_EN)
    .setDescription('Football Newsroom API — Foundation')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(config.API_PORT);
  logger.info('API listening', { port: config.API_PORT });
}

bootstrap().catch((error: unknown) => {
  const logger = createLogger({ service: 'api' });
  logger.error('API failed to start', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
