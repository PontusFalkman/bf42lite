export * from './schema';

export interface ClientInput {
  type: 'input';
  tick: number;
  axes: {
    forward: number;
    right: number;
    yaw: number;
    pitch: number;
    jump: boolean;
    shoot: boolean;
    reload: boolean;
  };
}

export interface ClientFire {
  type: 'fire';
  tick: number;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  weaponId: number;
}

// Optional: request to spawn with a specific class/loadout
export interface SpawnRequest {
  type: 'spawn';
  classId: number;
}

export interface EntityState {
  id: number;
  pos: { x: number; y: number; z: number };
  vel?: { x: number; y: number; z: number };
  rot: number;
  health: number;
  isDead: boolean;
  [key: string]: any;
}

export interface GameModeState {
  team_a_tickets: number;
  team_b_tickets: number;
  match_ended: boolean;
  winner: any;
}

export interface FlagSnapshot {
  id: number;
  x: number;
  y: number;
  z: number;
  radius: number;
  owner: any;
  capture: number;
}

export interface Snapshot {
  type: 'snapshot';
  tick: number;
  entities: EntityState[];

  // Old Node-host style
  game?: {
    ticketsAxis: number;
    ticketsAllies: number;
    state: number;
  };

  // Rust-host style
  game_state?: GameModeState;
  flags?: FlagSnapshot[];
}
