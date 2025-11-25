// apps/client-tauri/src/render/ModelFactory.ts
//
// Central factory for all Three.js models used by the client.
// This keeps geometry/material creation out of Renderer and makes
// it easier to evolve visuals later (LOD, different styles, etc.).

import * as THREE from 'three';
import { TEAM_COLORS } from '../core/constants';

export class ModelFactory {
  /**
   * Create the standard infantry soldier object.
   *
   * We return a THREE.Group so we can name parts (body/head) and
   * recolor the body later based on team.
   */
  public static createPlayer(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'player';

    // Body
    const bodyGeom = new THREE.BoxGeometry(0.6, 1.6, 0.4);
    const bodyMat = new THREE.MeshPhongMaterial({
      color: TEAM_COLORS.NEUTRAL,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.castShadow = true;
    body.name = 'body';
    group.add(body);

    // Head
    const headGeom = new THREE.SphereGeometry(0.3, 16, 16);
    const headMat = new THREE.MeshPhongMaterial({ color: 0xffe0bd });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 1.1;
    head.castShadow = true;
    head.name = 'head';
    group.add(head);

    return group;
  }

  /**
   * Create a complete flag group:
   * - Base cylinder
   * - Pole (named "pole")
   * - Banner (Plane, named "banner")
   * - Capture ring (named "ring")
   * - Progress disc (Circle, named "progress")
   * - Capture direction arrow (Plane, named "direction")
   *
   * All color logic (team/ownership/progress) is handled in FlagVisual;
   * this factory only creates neutral-colored geometry.
   *
   * @param radius Capture radius for the ring and disc (default 8.0)
   */
  public static createFlag(radius: number = 8.0): THREE.Group {
    const group = new THREE.Group();
    group.name = 'flag';

    // A. Base
    const baseGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
    const baseMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeom, baseMat);
    base.castShadow = true;
    base.receiveShadow = true;
    base.name = 'base';
    group.add(base);

    // B. Pole
    const poleGeom = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
    const poleMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const pole = new THREE.Mesh(poleGeom, poleMat);
    pole.position.y = 2.2;
    pole.castShadow = true;
    pole.name = 'pole';
    group.add(pole);

    // C. Banner
    const bannerGeom = new THREE.PlaneGeometry(1.8, 1.2);
    const bannerMat = new THREE.MeshBasicMaterial({
      color: TEAM_COLORS.NEUTRAL,
      side: THREE.DoubleSide,
    });
    const banner = new THREE.Mesh(bannerGeom, bannerMat);
    banner.position.set(0.9, 2.8, 0);
    banner.rotation.y = Math.PI / 2;
    banner.name = 'banner';
    group.add(banner);

    // D. Capture radius ring
    const ringGeom = new THREE.RingGeometry(radius - 0.3, radius, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    ring.name = 'ring';
    group.add(ring);

    // E. Progress disc (fills as the point is being captured)
    const progGeom = new THREE.CircleGeometry(radius, 64);
    const progMat = new THREE.MeshBasicMaterial({
      color: TEAM_COLORS.NEUTRAL,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const progress = new THREE.Mesh(progGeom, progMat);
    progress.rotation.x = -Math.PI / 2;
    progress.position.y = 0.02;
    progress.scale.set(0, 0, 0); // no capture at start
    progress.name = 'progress';
    group.add(progress);

    // F. Direction arrow: shows capture direction / team color
    const arrowGeom = new THREE.PlaneGeometry(radius * 0.5, radius * 0.12);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: TEAM_COLORS.NEUTRAL,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0, // hidden until capture starts
    });
    const arrow = new THREE.Mesh(arrowGeom, arrowMat);
    arrow.position.set(radius * 0.75, 0.03, 0);
    arrow.rotation.x = -Math.PI / 2;
    arrow.name = 'direction';
    group.add(arrow);

    return group;
  }
}
