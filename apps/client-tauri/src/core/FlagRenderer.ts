// src/core/FlagRenderer.ts
import * as THREE from 'three';
import { FlagSnapshot } from '@bf42lite/protocol';

export class FlagRenderer {
  private scene: THREE.Scene;
  private flags = new Map<number, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Update or create flag meshes from the latest snapshot.
   */
  updateFromSnapshot(flags: FlagSnapshot[]): void {
    const seen = new Set<number>();

    for (const f of flags) {
      let group = this.flags.get(f.id);
      if (!group) {
        group = this.createFlagMesh(f);
        this.scene.add(group);
        this.flags.set(f.id, group);
      }

      this.updateFlagTransform(group, f);
      this.updateFlagOwner(group, f.owner);
      this.setCaptureProgress(group, this.captureTo01(f.capture));
      seen.add(f.id);
    }

    // Remove any flags that are no longer present.
    for (const [id, obj] of this.flags) {
      if (!seen.has(id)) {
        this.scene.remove(obj);
        this.flags.delete(id);
      }
    }
  }

  /**
   * Convert capture value (-1..1) to 0..1.
   *  0.0 => full Team B
   *  0.5 => neutral
   *  1.0 => full Team A
   */
  private captureTo01(capture: number): number {
    const c = Math.max(-1, Math.min(1, capture));
    return (c + 1) * 0.5;
  }

  private createFlagMesh(flag: FlagSnapshot): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `flag-${flag.id}`;

    // Flag pole
    const poleGeom = new THREE.BoxGeometry(0.2, 4.0, 0.2);
    const poleMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.set(0, 2.0, 0);
    pole.name = 'pole';
    group.add(pole);

    // Flag plate (ownership color)
    const plateGeom = new THREE.BoxGeometry(1.2, 0.8, 0.1);
    const plateMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const plate = new THREE.Mesh(plateGeom, plateMat);
    plate.position.set(0.7, 3.0, 0);
    plate.name = 'plate';
    group.add(plate);

    // Capture bar (under the plate)
    const barGeom = new THREE.BoxGeometry(1.0, 0.15, 0.1);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const bar = new THREE.Mesh(barGeom, barMat);
    bar.position.set(-0.5, 1.0, 0); // left edge at -0.5 when scale.x = 1
    bar.name = 'captureBar';
    group.add(bar);

    // World position
    group.position.set(flag.x, flag.y, flag.z);

    return group;
  }

  private updateFlagTransform(group: THREE.Object3D, flag: FlagSnapshot): void {
    group.position.set(flag.x, flag.y, flag.z);
  }

  /**
   * Interpret the owner value (number or string) and set plate color.
   * We support both numeric (0/1/2) and string ('TeamA'/'TeamB') encodings.
   */
  private updateFlagOwner(group: THREE.Object3D, owner: FlagSnapshot['owner']): void {
    const plate = group.getObjectByName('plate') as THREE.Mesh | null;
    if (!plate) return;

    const mat = plate.material as THREE.MeshBasicMaterial;

    const o = owner as any;

    const isTeamA = o === 1 || o === 'TeamA' || o === 'A';
    const isTeamB = o === 2 || o === 'TeamB' || o === 'B';

    if (isTeamA) {
      mat.color.set(0x0080ff); // blue
    } else if (isTeamB) {
      mat.color.set(0xff4040); // red
    } else {
      mat.color.set(0xcccccc); // neutral
    }
  }

  /**
   * Set capture bar fill (0..1).
   */
  private setCaptureProgress(group: THREE.Object3D, capture: number): void {
    const bar = group.getObjectByName('captureBar') as THREE.Mesh | null;
    if (!bar) return;

    // Clamp 0..1
    const c = Math.max(0, Math.min(1, capture));

    bar.scale.x = c;
    // Keep left edge fixed, grow to the right
    bar.position.x = (c - 1) * 0.5;
  }
}
