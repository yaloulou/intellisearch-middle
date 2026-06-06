import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { AllExceptionsFilter } from './http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: true,
    credentials: true,
  });
  await app.listen(appConfig.port);
}
bootstrap();
