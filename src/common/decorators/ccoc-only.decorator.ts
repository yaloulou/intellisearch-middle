import { SetMetadata } from '@nestjs/common';

export const CCOC_ONLY_KEY = 'ccoc_only';
export const CcocOnly = () => SetMetadata(CCOC_ONLY_KEY, true);
