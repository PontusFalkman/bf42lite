// apps/client-tauri/src/core/FlagRenderer.ts

import * as THREE from 'three';
import { FlagSnapshot } from '@bf42lite/protocol';
import { TEAM_COLORS } from './constants';

export class FlagRenderer {
  private scene: THREE.Scene;
  private flags = new Map<number, THREE.Object3D>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

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

    for (const [id, obj] of this.flags) {
      if (!seen.has(id)) {
        this.scene.remove(obj);
        this.flags.delete(id);
      }
    }
  }

  private createFlagMesh(flag: FlagSnapshot): THREE.Object3D {
    const group = new THREE.Group();
    group.name = `flag-${flag.id}`;

    const radius = flag.radius && flag.radius > 0 ? flag.radius : 8.0;

    const poleGeom = new THREE.BoxGeometry(0.4, 6, 0.4);
    const poleMat = new THREE.MeshStandardMaterial({ color: TEAM_COLORS.NEUTRAL });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 3;
    pole.castShadow = true;
    pole.receiveShadow = true;
    pole.name = 'pole';
    group.add(pole);

    const bannerGeom = new THREE.BoxGeometry(1.2, 0.8, 0.1);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: TEAM_COLORS.NEUTRAL,
      side: THREE.DoubleSide,
    });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(0.6, 5.5, 0);
    banner.castShadow = true;
    banner.name = 'banner';
    group.add(banner);

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

    const progGeom = new THREE.CircleGeometry(radius, 64);
    const progMat = new THREE.MeshBasicMaterial({
      color: TEAM_COLORS.NEUTRAL,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const progress = new THREE.Mesh(progGeom, progMat);
    progress.rotation.x = -Math.PI / 2;
    progress.position.y = 0.15;
    progress.scale.set(0, 0, 0);
    progress.name = 'progress';
    group.add(progress);

    group.position.set(flag.x, flag.y, flag.z);

    return group;
  }

  private updateFlagTransform(group: THREE.Object3D, flag: FlagSnapshot): void {
    group.position.set(flag.x, flag.y, flag.z);
  }

  private updateFlagVisual(group: THREE.Object3D, flag: FlagSnapshot): void {
    const banner = group.getObjectByName('banner') as THREE.Mesh | null;
    const pole = group.getObjectByName('pole') as THREE.Mesh | null;
    const progressDisc = group.getObjectByName('progress') as THREE.Mesh | null;

    if (!banner || !pole || !progressDisc) return;

    const poleMat = pole.material as THREE.MeshStandardMaterial;
    const bannerMat = banner.material as THREE.MeshStandardMaterial;
    const progMat = progressDisc.material as THREE.MeshBasicMaterial;

    poleMat.color.setHex(TEAM_COLORS.NEUTRAL);

    let baseColor = TEAM_COLORS.NEUTRAL;
    if (flag.owner === 'TeamA') baseColor = TEAM_COLORS.AXIS;
    else if (flag.owner === 'TeamB') baseColor = TEAM_COLORS.ALLIES;

    const rawProgress =
      typeof flag.capture === 'number' ? flag.capture : 0;
    const clamped = Math.max(-1, Math.min(1, rawProgress));
    const t = Math.abs(clamped);

    progressDisc.scale.set(t, t, t);

    let teamColor = 0xffffff;
    if (clamped > 0) {
      teamColor = TEAM_COLORS.AXIS;
    } else if (clamped < 0) {
      teamColor = TEAM_COLORS.ALLIES;
    }

    const white = new THREE.Color(0xffffff);
    const teamCol = new THREE.Color(teamColor);
    white.lerp(teamCol, t);

    if (clamped === 0) {
      progMat.color.setHex(0xffffff);
      bannerMat.color.setHex(baseColor);
    } else {
      bannerMat.color.copy(white);
      progMat.color.copy(white);
    }
  }
}
