import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticsearchController } from './elasticsearch/elasticsearch.controller';
import { ElasticsearchService } from './elasticsearch/elasticsearch.service';
import { LoggerMiddleware } from './logger.middleware';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AppController, ElasticsearchController],
  providers: [
    AppService,
    ElasticsearchService,
    // Apply JWT guard globally — routes use @SkipAuth() to opt-out
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Apply role guard globally — routes use @Roles() to restrict
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
