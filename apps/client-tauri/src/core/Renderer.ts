// apps/client-tauri/src/core/Renderer.ts

import * as THREE from 'three';
import { TEAM_COLORS, TEAM_IDS } from './constants';
import { log } from '../utils/log';
import { ModelFactory } from '../render/ModelFactory';
import { FlagVisual } from '../render/FlagVisual';

type RenderStatePlayer = {
  type: 'player';
  pos: { x: number; y: number; z: number };
  rot: number;   // yaw in radians
  pitch: number; // pitch in radians
  team: number;  // TEAM_IDS.*
};

type RenderStateFlag = {
  type: 'flag';
  pos: { x: number; y: number; z: number };
  team: number;      // TEAM_IDS.*
  progress: number;  // capture progress (-1..1 or 0..1)
};

export type RenderState = RenderStatePlayer | RenderStateFlag;

/**
 * Thin 3D renderer for bf42lite.
 *
 * Responsibilities:
 * - Own Three.js Scene / Camera / WebGLRenderer
 * - Maintain a map of ECS entity id -> THREE.Object3D
 * - Provide utility hooks (getCamera, drawTracer, updateEntity, render)
 *
 * It does NOT know about ECS directly; it only consumes RenderState.
 */
export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Map ECS entity IDs -> ThreeJS objects (Mesh or Group)
  private entities = new Map<number, THREE.Object3D>();

  // Optional hooks used by RemoteEntitySync
  public onEntityCreated?: (id: number) => void;
  public onEntityUpdated?: (id: number) => void;

  constructor() {
    // --- Scene ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // sky blue
    this.scene.fog = new THREE.Fog(0x87ceeb, 20, 150);

    // --- Ground plane (simple arena) ---
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshPhongMaterial({ color: 0x558855 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    // --- Camera ---
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 500);
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    // --- Lights ---
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -80;
    dirLight.shadow.camera.right = 80;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    this.scene.add(dirLight);

    const ambient = new THREE.AmbientLight(0x505050);
    this.scene.add(ambient);

    // --- WebGLRenderer ---
    const canvas = document.getElementById('game') as HTMLCanvasElement | null;
    if (!canvas) {
      throw new Error('Renderer: <canvas id="game"> not found in DOM');
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.setSize(window.innerWidth, window.innerHeight);

    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.setSize(w, h);
    });

    log.info('RENDER', 'Renderer initialized');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  /**
   * Main entry point from worldRender / RemoteEntitySync.
   *
   * If the entity does not exist, it is created; otherwise its transform
   * and visuals are updated in-place.
   */
  public updateEntity(
    id: number,
    state: RenderState,
    isLocalPlayer: boolean,
  ): void {
    let object = this.entities.get(id);

    if (!object) {
      object = this.createObjectForState(state, isLocalPlayer);
      this.scene.add(object);
      this.entities.set(id, object);

      if (this.onEntityCreated) {
        this.onEntityCreated(id);
      }
    }

    this.applyStateToObject(object, state, isLocalPlayer);

    if (this.onEntityUpdated) {
      this.onEntityUpdated(id);
    }
  }

  /**
   * Debug / cosmetic tracer used by WeaponSystem.
   */
  public drawTracer(start: THREE.Vector3, end: THREE.Vector3): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0xffdd33 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    // Remove shortly after
    window.setTimeout(() => {
      this.scene.remove(line);
      geometry.dispose();
      material.dispose();
    }, 100);
  }

  /**
   * Render one frame.
   */
  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------------------
  // Object creation helpers
  // ---------------------------------------------------------------------------

  private createObjectForState(
    state: RenderState,
    _isLocalPlayer: boolean,
  ): THREE.Object3D {
    if (state.type === 'player') {
      return ModelFactory.createPlayer();
    } else {
      // Flags currently use a fixed radius (8m) on the client side.
      return ModelFactory.createFlag(8.0);
    }
  }

  // ---------------------------------------------------------------------------
  // State application helpers
  // ---------------------------------------------------------------------------

  private applyStateToObject(
    object: THREE.Object3D,
    state: RenderState,
    isLocalPlayer: boolean,
  ): void {
    if (state.type === 'player') {
      const playerState = state as RenderStatePlayer;
      const group = object as THREE.Group;

      // Position + rotation for the soldier mesh
      group.position.set(
        playerState.pos.x,
        playerState.pos.y,
        playerState.pos.z,
      );
      group.rotation.y = playerState.rot;
      group.userData.team = playerState.team;

      // Team tint on body, if present
      const body = group.getObjectByName('body') as THREE.Mesh | null;
      if (body) {
        const bodyMat = body.material as THREE.MeshPhongMaterial;
        bodyMat.color.setHex(this.getTeamColor(playerState.team));
      }

      if (isLocalPlayer) {
        // First-person camera placement
        this.camera.position.set(
          playerState.pos.x,
          playerState.pos.y + 1.6, // eye height
          playerState.pos.z,
        );

        this.camera.rotation.set(
          playerState.pitch || 0,
          playerState.rot,
          0,
          'YXZ',
        );

        // Hide own body in first person
        group.visible = false;
      } else {
        group.visible = true;
      }

      return;
    }

    // === FLAG LOGIC ===
    const flagState = state as RenderStateFlag;
    const group = object as THREE.Group;

    // Position
    group.position.set(
      flagState.pos.x,
      flagState.pos.y,
      flagState.pos.z,
    );

    // Delegate all visual details (colors, pulses, arrow) to FlagVisual
    FlagVisual.applyState(group, flagState.team, flagState.progress);
  }

  private getTeamColor(team: number): number {
    if (team === TEAM_IDS.AXIS) return TEAM_COLORS.AXIS as number;
    if (team === TEAM_IDS.ALLIES) return TEAM_COLORS.ALLIES as number;
    return TEAM_COLORS.NEUTRAL as number;
  }
}
