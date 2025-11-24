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
      this.updateFlagVisual(group, f);
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

    // Use radius from snapshot, with a sensible default
    const radius = flag.radius && flag.radius > 0 ? flag.radius : 8.0;

    // A. The Pole
    const poleGeom = new THREE.BoxGeometry(0.4, 6, 0.4);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 3; // Sit on ground
    pole.castShadow = true;
    pole.receiveShadow = true;
    pole.name = 'pole';
    group.add(pole);

    // B. The Banner (Rectangular flag)
    const bannerGeom = new THREE.BoxGeometry(1.2, 0.8, 0.1);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
    });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(0.6, 5.5, 0);
    banner.castShadow = true;
    banner.name = 'banner';
    group.add(banner);

    // C. The Zone Boundary (Ring)
    const ringGeom = new THREE.RingGeometry(radius - 0.3, radius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    ring.name = 'ring';
    group.add(ring);

    // D. Progress Disc – fills same radius as ring at 100%
    const progGeom = new THREE.CircleGeometry(radius, 64);
    const progMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const progress = new THREE.Mesh(progGeom, progMat);
    progress.rotation.x = -Math.PI / 2;
    progress.position.y = 0.15;
    // Start at 0 scale (no capture)
    progress.scale.set(0, 0, 0);
    progress.name = 'progress';
    group.add(progress);

    // World position
    group.position.set(flag.x, flag.y, flag.z);

    return group;
  }

  private updateFlagTransform(group: THREE.Object3D, flag: FlagSnapshot): void {
    group.position.set(flag.x, flag.y, flag.z);
  }

  /**
   * Update colours + capture circle from owner/capture.
   */
  private updateFlagVisual(group: THREE.Object3D, flag: FlagSnapshot): void {
    // Ensure children exist (in case of future changes)
    let banner = group.getObjectByName('banner') as THREE.Mesh | null;
    let pole = group.getObjectByName('pole') as THREE.Mesh | null;
    let progressDisc = group.getObjectByName('progress') as THREE.Mesh | null;

    if (!banner || !pole || !progressDisc) {
      return;
    }

    const poleMat = pole.material as THREE.MeshStandardMaterial;
    const bannerMat = banner.material as THREE.MeshStandardMaterial;
    const progMat = progressDisc.material as THREE.MeshBasicMaterial;

    // 1) Pole stays neutral at all times
    poleMat.color.setHex(0xcccccc);

    // 2) Base ownership colour (when no active capture)
    let baseColor = 0xcccccc;
    if (flag.owner === 'TeamA') baseColor = 0xff0000; // Axis
    else if (flag.owner === 'TeamB') baseColor = 0x0000ff; // Allies

    // 3) Capture progress drives BOTH banner + circle colours
    //
    // flag.capture in [-1, 1]:
    //   > 0  => TeamA capturing
    //   < 0  => TeamB capturing
    //   = 0  => no active capture
    const rawProgress =
      typeof flag.capture === 'number' ? flag.capture : 0;
    const clamped = Math.max(-1, Math.min(1, rawProgress));
    const t = Math.abs(clamped); // 0..1 capture amount

    // Scale disc 0% → 100% based on |progress|
    progressDisc.scale.set(t, t, t);

    // Target team colour based on sign
    let teamColor = 0xffffff; // no capture
    if (clamped > 0) {
      teamColor = 0xff0000; // TeamA capturing
    } else if (clamped < 0) {
      teamColor = 0x0000ff; // TeamB capturing
    }

    // Smoothly blend from white → teamColour using t
    const white = new THREE.Color(0xffffff);
    const teamCol = new THREE.Color(teamColor);
    white.lerp(teamCol, t); // t=0 → white, t=1 → team colour

    if (clamped === 0) {
      // No active capture: circle white, banner shows owner/neutral
      progMat.color.setHex(0xffffff);
      bannerMat.color.setHex(baseColor);
    } else {
      // Active capture: banner + circle share blended colour
      bannerMat.color.copy(white);
      progMat.color.copy(white);
    }
  }

  /**
   * Legacy capture bar API — still a no-op; kept for compatibility.
   */
  private setCaptureProgress(_group: THREE.Object3D, _capture: number): void {
    // No-op
  }
}
