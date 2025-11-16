export * from './schema';
export interface ClientInput {
    type: 'input';
    tick: number;
    axes: { forward: number; right: number; yaw: number; pitch: number; jump: boolean; shoot: boolean; reload: boolean };
  }
  
  export interface ClientFire {
    type: 'fire';
    tick: number;
    origin: { x: number; y: number; z: number };
    direction: { x: number; y: number; z: number };
    weaponId: number;
  }
  
  // --- NEW: Request to Spawn ---
  export interface ClientSpawnRequest {
    type: 'spawn_request';
    classId: number; // 0=Assault, 1=Medic, 2=Scout
  }
  
  // Update the union type
  export type ClientMessage = ClientInput | ClientFire | ClientSpawnRequest;
  
  export interface EntityState {
      id: number;
      pos: { x: number, y: number, z: number };
      vel?: { x: number, y: number, z: number };
      rot: number;
      health: number;
      isDead: boolean;
      // ... keep other fields
      
      // OPTIONAL: Add classId to sync visuals later?
      // classId?: number;
      
      [key: string]: any;
  }
  // ... keep Snapshot etc.