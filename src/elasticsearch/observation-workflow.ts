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

interface ObservationAccessRecord {
  workflow?: ObservationWorkflow;
  owner_id?: string;
  audit?: { created_by?: string };
}

export const normalizeDesk = (desk: unknown): string => typeof desk === 'string' ? desk.trim().toLowerCase() : '';
export const isObservationReviewer = (user?: JwtPayload): boolean => !!user?.sub && normalizeDesk(user.desk) === 'cord_intel';

export function observationVisibility(user?: JwtPayload) {
  if (!user?.sub) return { match_none: {} };
  if (isObservationReviewer(user)) return { match_all: {} };
  const desk = normalizeDesk(user.desk);
  const should: Record<string, unknown>[] = [
    { term: { owner_id: user.sub } },
    // Legacy records may contain the creator's audit without an owner_id.
    { bool: { must_not: [{ exists: { field: 'owner_id' } }], filter: [{ term: { 'audit.created_by': user.sub } }] } },
  ];
  if (desk && [Role.ANALYSTE, Role.CONSEILLER].includes(user.role)) {
    should.push({ bool: { filter: [{ term: { 'workflow.status': 'validated' } }, { term: { 'workflow.target_desks': desk } }] } });
  }
  return { bool: { should, minimum_should_match: 1 } };
}

export function assertObservationReviewer(user?: JwtPayload) {
  if (!isObservationReviewer(user)) throw new HttpException('La validation est réservée au desk cord_intel', HttpStatus.FORBIDDEN);
}

export function assertObservationVisible(observation: ObservationAccessRecord | undefined, user?: JwtPayload) {
  if (isObservationReviewer(user)) return;
  const author = observation?.owner_id ?? observation?.audit?.created_by;
  if (user?.sub && author === user.sub) return;
  const workflow = observation?.workflow;
  if (user?.sub && [Role.ANALYSTE, Role.CONSEILLER].includes(user.role) && workflow?.status === 'validated' &&
      !!normalizeDesk(user.desk) && workflow.target_desks?.includes(normalizeDesk(user.desk))) return;
  throw new HttpException('Accès refusé à cette information', HttpStatus.FORBIDDEN);
}
