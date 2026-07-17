import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { requestIdMiddleware } from '../common/request-id.middleware.js';
import { ApiResponseInterceptor } from '../common/api-response.interceptor.js';
import { AllExceptionsFilter } from '../common/http-exception.filter.js';

@Module({
  controllers: [HealthController],
  providers: [
    HealthService,
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class HealthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
