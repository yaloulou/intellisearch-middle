import type { Role } from '../constants/roles.constant';

export interface JwtPayload {
  /** Elasticsearch _id of the user document */
  sub: string;
  email: string;
  role: Role;
  desk: string;
}
