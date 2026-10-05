import { HttpException, HttpStatus } from '@nestjs/common';
import { Role } from '../common/constants/roles.constant';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

export interface ObservationWorkflow {
  status: 'pending' | 'validated';
  target_desks: string[];
  submitted_at?: string;
  validated_at?: string;
  validated_by?: string;
}

export const normalizeDesk = (desk: unknown): string => typeof desk === 'string' ? desk.trim().toLowerCase() : '';
export const isObservationReviewer = (user?: JwtPayload): boolean => !!user?.sub && normalizeDesk(user.desk) === 'cord_intel';

export function observationVisibility(user?: JwtPayload) {
  if (isObservationReviewer(user)) return { match_all: {} };
  const desk = normalizeDesk(user?.desk);
  if (!desk || !user || ![Role.ANALYSTE, Role.CONSEILLER].includes(user.role)) return { match_none: {} };
  return { bool: { filter: [{ term: { 'workflow.status': 'validated' } }, { term: { 'workflow.target_desks': desk } }] } };
}

export function assertObservationReviewer(user?: JwtPayload) {
  if (!isObservationReviewer(user)) throw new HttpException('La validation est réservée au desk cord_intel', HttpStatus.FORBIDDEN);
}

export function assertObservationVisible(workflow: ObservationWorkflow | undefined, user?: JwtPayload) {
  if (isObservationReviewer(user)) return;
  if (user && [Role.ANALYSTE, Role.CONSEILLER].includes(user.role) && workflow?.status === 'validated' &&
      !!normalizeDesk(user.desk) && workflow.target_desks?.includes(normalizeDesk(user.desk))) return;
  throw new HttpException('Accès refusé à cette information', HttpStatus.FORBIDDEN);
}
