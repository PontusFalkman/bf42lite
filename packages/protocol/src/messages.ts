export interface EntityState {
  id: number;
  pos: { x: number; y: number; z: number };
  vel?: { x: number; y: number; z: number };
  rot: number;
  health: number;
  isDead: boolean;

  loadout?: {
    classId: number;
  };

  ammo?: {
    current: number;
    reserve: number;
  };

  [key: string]: any;
}
