export type Vec3 = { x: number; y: number; z: number };
export type Vec4 = Vec3 & { w: number };
export type BoneMatrix = { x: Vec4; y: Vec4; z: Vec4; w: Vec4 };
export type Extent = { left: number; right: number; up: number; down: number };
export type HitValues = {
  hitbox_id: number; set_id: number; damage: number; trajectory: number;
  kbg: number; bkb: number; wdsk: number; size: number; enabled: boolean;
  ground: boolean; aerial: boolean; shield_damage: number;
  hitlag_mult: number; sdi_mult: number; effect: string;
  [key: string]: unknown;
};
export type GrabValues = { hitbox_id: number; size: number; target: string; [key: string]: unknown };
export type CollisionValues = { Hit: HitValues } | { Grab: GrabValues };
export type HitBox = {
  hitbox_id: number; prev_pos: Vec3 | null; prev_size: number | null;
  prev_values: CollisionValues | null; next_pos: Vec3; next_size: number;
  next_values: CollisionValues;
};
export type HurtBox = {
  bone_matrix: BoneMatrix;
  hurt_box: { offset: Vec3; stretch: Vec3; radius: number; grabbable: boolean; [key: string]: unknown };
  state: string;
};
export type Frame = {
  index: number; hit_boxes: HitBox[]; hurt_boxes: HurtBox[]; x_pos: number; y_pos: number;
  landing_lag: boolean; interruptible: boolean; ledge_grab_box: Extent | null;
  ecb: { left: number; right: number; top: number; bottom: number; transn_x: number; transn_y: number };
  throw: { damage: number; trajectory: number; kbg: number; bkb: number; wdsk: number; [key: string]: unknown } | null;
  [key: string]: unknown;
};
export type MoveData = {
  schemaVersion: 1; fighterId: string; moveId: string; name: string;
  iasa: number | null; landing_lag: number | null; bad_interrupts: boolean;
  frames: Frame[]; extent: Extent; warnings: string[];
  sequence?: { startName: string; startFrames: number; releaseName: string };
  timing?: { active: FrameRange[] | null; actionable: number; source: string; geometryRetimed: boolean; missingGeometry: boolean };
  sharedMove?: { path: string; sha256: string };
};
export type MoveIndex = { id: string; internalName: string; path: string; totalFrames: number; warnings: string[]; sha256: string };
export type FighterIndex = { id: string; name: string; internalName: string; path: string; moveCount: number };
export type FighterData = {
  schemaVersion: 1; id: string; name: string; internalName: string;
  attributes: Record<string, unknown>; moves: MoveIndex[]; warnings: string[];
};
export type Manifest = {
  schemaVersion: 1; game: 'Project+'; version: string; generatedAt: string;
  parser: { name: string; version: string }; verification: 'unverified' | 'verified';
  partial: boolean; fighters: FighterIndex[]; warnings: string[];
  sourceChecksums: { source: 'brawl' | 'pplus'; path: string; sha256: string }[];
};
export type FrameRange = [number, number];
