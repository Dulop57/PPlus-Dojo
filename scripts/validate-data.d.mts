import type {Manifest} from '../src/data/types';
export function validateDataset(folder: string, options?: {release?: boolean}): Promise<Manifest>;
