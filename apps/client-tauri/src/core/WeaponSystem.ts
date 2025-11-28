// apps/client-tauri/src/core/WeaponSystem.ts

import * as THREE from 'three';
import { Renderer } from './Renderer';
import { NetworkManager } from '../managers/NetworkManager';
import { InputState } from '@bf42lite/engine-core';

// Keep client-side types aligned with server JSON
export interface WeaponConfig {
  id: number;
  key: string;
  name: string;
  damage_per_hit: number;
  fire_rate: number;      // seconds between shots
  mag_size: number;
  reserve_ammo: number;
  recoil: number;
}

export interface ClassConfig {
  id: number;
  key: string;
  name: string;
  max_health: number;
  primary_weapon_id: number;
}

/**
 * Data-driven WeaponSystem:
 * - Loads weapons.json / classes.json (same data as server)
 * - Tracks current class and its primary weapon
 * - Enforces client-side fire cadence using weapon.fire_rate
 * - Sends fire commands; server does hitscan + damage
 */
export class WeaponSystem {
  private lastFireTime = 0;          // seconds
  private readonly RANGE = 100;

  private raycaster = new THREE.Raycaster();

  // Current class (numeric ID coming from UI / snapshot)
  public currentClassId: number = 0;

  private weaponsById = new Map<number, WeaponConfig>();
  private classesById = new Map<number, ClassConfig>();

  private isLoaded = false;

  constructor(
    private renderer: Renderer,
    private net: NetworkManager,
  ) {
    // Fire-and-forget config load; if not ready yet, update() is a no-op.
    void this.loadConfigs();
  }

  /**
   * Called by UI / snapshot when local player selects a class.
   * Safe to call even before JSON is loaded.
   */
  public setClass(classId: number) {
    this.currentClassId = classId;

    if (!this.isLoaded) {
      // Will be resolved once configs are loaded
      return;
    }

    const classCfg = this.classesById.get(classId);
    if (!classCfg) {
      console.warn('[WeaponSystem] setClass: unknown class id', classId);
    }
  }

  /**
   * Per-frame update:
   * - Checks if current weapon exists
   * - Reads InputState for myEntityId
   * - Enforces fire_rate from weapon config
   * - Sends fire command to server
   */
  public update(_dt: number, myEntityId: number, currentTick: number) {
    if (myEntityId < 0) return;
    if (!this.isLoaded) return;

    const weapon = this.getCurrentWeapon();
    if (!weapon) return;

    const isShooting = (InputState.buttons[myEntityId] & 2) !== 0;
    if (!isShooting) return;

    const now = performance.now() / 1000;
    if (now - this.lastFireTime <= weapon.fire_rate) {
      // Still on client-side cooldown
      return;
    }

    this.fire(currentTick);
    this.lastFireTime = now;
  }

  // === Internal helpers ===

  private getCurrentWeapon(): WeaponConfig | null {
    const classCfg = this.classesById.get(this.currentClassId);
    if (!classCfg) {
      // Optional: fallback to class 0 if present
      const fallback = this.classesById.get(0);
      if (!fallback) return null;
      return this.weaponsById.get(fallback.primary_weapon_id) ?? null;
    }

    return this.weaponsById.get(classCfg.primary_weapon_id) ?? null;
  }

  private fire(tick: number) {
    const camera = this.renderer.getCamera();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const start = camera.position.clone();
    const direction = this.raycaster.ray.direction.clone();
    const end = start.clone().add(direction.clone().multiplyScalar(this.RANGE));

    // Server-authoritative fire command
    this.net.sendFire(
      { x: start.x, y: start.y, z: start.z },
      { x: direction.x, y: direction.y, z: direction.z },
      tick,
    );

    // Visual tracer slightly offset from camera
    const visualOffset = new THREE.Vector3(0.2, -0.2, 0.5);
    visualOffset.applyQuaternion(camera.quaternion);
    const visualStart = start.clone().add(visualOffset);

    this.renderer.drawTracer(visualStart, end);
  }

  private async loadConfigs() {
    try {
      const [weapons, classes] = await Promise.all([
        this.loadWeaponsJson(),
        this.loadClassesJson(),
      ]);

      this.weaponsById.clear();
      for (const w of weapons) {
        this.weaponsById.set(w.id, w);
      }

      this.classesById.clear();
      for (const c of classes) {
        this.classesById.set(c.id, c);
      }

      this.isLoaded = true;

      console.log('[WeaponSystem] Loaded weapons:', weapons);
      console.log('[WeaponSystem] Loaded classes:', classes);

      // If currentClassId has a valid class, we are ready;
      // otherwise, try default class 0.
      if (!this.classesById.has(this.currentClassId) && this.classesById.has(0)) {
        this.currentClassId = 0;
      }
    } catch (err) {
      console.error('[WeaponSystem] Failed to load weapon/class config:', err);
      this.isLoaded = false;
    }
  }

  private async loadWeaponsJson(): Promise<WeaponConfig[]> {
    const res = await fetch('/weapons.json');
    if (!res.ok) {
      console.error('[WeaponSystem] Failed to load /weapons.json:', res.status);
      return [];
    }
    return (await res.json()) as WeaponConfig[];
  }

  private async loadClassesJson(): Promise<ClassConfig[]> {
    const res = await fetch('/classes.json');
    if (!res.ok) {
      console.error('[WeaponSystem] Failed to load /classes.json:', res.status);
      return [];
    }
    return (await res.json()) as ClassConfig[];
  }
}
