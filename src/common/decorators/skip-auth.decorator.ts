import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants/roles.constant';

/** Mark a route as public — the global JwtAuthGuard will skip it. */
export const SkipAuth = () => SetMetadata(IS_PUBLIC_KEY, true);
