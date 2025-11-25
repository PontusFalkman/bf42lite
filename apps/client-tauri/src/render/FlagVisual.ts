// apps/client-tauri/src/render/FlagVisual.ts
//
// Encapsulates all visual updates for flag objects created by ModelFactory.
// Renderer calls these methods when receiving a RenderStateFlag.

import * as THREE from 'three';
import { TEAM_COLORS, TEAM_IDS } from '../core/constants';

export class FlagVisual {
  /**
   * Apply ECS flag state to a THREE.Group flag instance.
   *
   * @param group    THREE.Group created by ModelFactory.createFlag()
   * @param team     current owning team (numeric ECS ID)
   * @param progress capture progress from -1 → 1
   */
  public static applyState(
    group: THREE.Group,
    team: number,
    progress: number,
  ) {
    const banner = group.getObjectByName('banner') as THREE.Mesh | null;
    const ring = group.getObjectByName('ring') as THREE.Mesh | null;
    const progressDisc = group.getObjectByName('progress') as THREE.Mesh | null;
    const direction = group.getObjectByName('direction') as THREE.Mesh | null;

    if (!banner || !ring || !progressDisc) {
      console.warn('[FlagVisual] Missing banner/ring/progress in flag model');
      return;
    }

    const bannerMat = banner.material as THREE.MeshBasicMaterial;
    const ringMat = ring.material as THREE.MeshBasicMaterial;
    const progMat = progressDisc.material as THREE.MeshBasicMaterial;
    const dirMat = direction
      ? (direction.material as THREE.MeshBasicMaterial)
      : null;

    // Base ownership color from team
    let baseColor = TEAM_COLORS.NEUTRAL as number;
    if (team === TEAM_IDS.AXIS) baseColor = TEAM_COLORS.AXIS as number;
    else if (team === TEAM_IDS.ALLIES) baseColor = TEAM_COLORS.ALLIES as number;

    // Clamp capture progress [-1, 1]
    const raw = typeof progress === 'number' ? progress : 0;
    const clamped = Math.max(-1, Math.min(1, raw));
    const t = Math.abs(clamped); // 0..1

    // Scale progress disc
    progressDisc.scale.set(t, t, t);

    // Time-based pulse for contested / capturing effects
    const time = performance.now() / 1000;
    const pulse = 0.75 + 0.25 * Math.sin(time * 4); // ~0.5..1.0

    // Which team is currently capturing?
    let capturingColor = 0xffffff;
    let capturingTeam: number | null = null;
    if (clamped > 0) {
      capturingColor = TEAM_COLORS.AXIS as number;
      capturingTeam = TEAM_IDS.AXIS;
    } else if (clamped < 0) {
      capturingColor = TEAM_COLORS.ALLIES as number;
      capturingTeam = TEAM_IDS.ALLIES;
    }

    // Lerp white → capturingColor by |progress|
    const white = new THREE.Color(0xffffff);
    const teamCol = new THREE.Color(capturingColor);
    white.lerp(teamCol, t); // “whitish” when low, pure team color when full

    const isCapturing = clamped !== 0;
    const isContested = isCapturing && t < 0.4; // near-neutral but non-zero

    if (!isCapturing) {
      // Idle: banner is owner color, ring is subtle, arrow hidden
      bannerMat.color.setHex(baseColor);
      progMat.color.setHex(0xffffff);
      ringMat.opacity = 0.3;

      if (direction && dirMat) {
        direction.visible = false;
        dirMat.opacity = 0.0;
      }
    } else {
      // Actively being captured: banner + progress use capture color
      bannerMat.color.copy(white);
      progMat.color.copy(white);

      // Ring opacity increases with progress; pulses when “contested”
      const baseOpacity = 0.25 + 0.5 * t; // 0.25 .. 0.75
      ringMat.opacity = baseOpacity * (isContested ? pulse : 1.0);

      if (direction && dirMat && capturingTeam !== null) {
        direction.visible = true;

        // Direction arrow color = capturing team
        dirMat.color.setHex(capturingColor);
        dirMat.opacity = 0.5 + 0.4 * pulse; // subtle pulse

        // Spin direction based on capturing team (A vs B)
        const dirSign = capturingTeam === TEAM_IDS.AXIS ? 1 : -1;
        direction.rotation.z = time * 2.0 * dirSign;
      }
    }
  }
}
