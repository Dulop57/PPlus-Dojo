import type {MoveData} from '../src/data/types';
export function datasetPath(root: string, path: string): string;
export function readMove(root: string, path: string, bytes?: Uint8Array): Promise<MoveData>;
