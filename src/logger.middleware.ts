import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const ip = req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown';
    const start = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      // Les erreurs (4xx/5xx) sont déjà loguées par AllExceptionsFilter
      if (statusCode < 400) {
        this.logger.log(`${method} ${originalUrl} ${statusCode} ${ms}ms — ${ip}`);
      }
    });

    next();
  }
}
