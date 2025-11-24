import * as THREE from 'three';
import { InputState } from '@bf42lite/engine-core';

export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  // We map entity IDs to ThreeJS objects (Mesh or Group)
  private entities = new Map<number, THREE.Object3D>();

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 120);

    // 1. Map Setup (The Arena)
    // A large dark green floor (100m x 100m)
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100),
        new THREE.MeshStandardMaterial({ color: 0x2a3b2a, roughness: 0.8 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    this.scene.add(plane);

    // 2. Grid Helper (Visual Ruler)
    const gridHelper = new THREE.GridHelper(100, 100, 0x555555, 0x333333);
    gridHelper.position.y = 0.05; // Slightly above ground
    this.scene.add(gridHelper);

    // 3. Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(20, 50, 20);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.left = -50;
    light.shadow.camera.right = 50;
    light.shadow.camera.top = 50;
    light.shadow.camera.bottom = -50;
    
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x505050)); // Soft fill light

    // 4. Camera Setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // 5. Renderer Setup
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public getScene(): THREE.Scene {
    return this.scene;
}

  public updateEntity(id: number, state: any, isMe: boolean) {
    let object = this.entities.get(id);

    // --- INITIALIZATION ---
    if (!object) {
        if (state.type === 'flag') {
            console.log(`[Renderer] Creating Flag Visuals for Entity ${id}`);
            const group = new THREE.Group();
            
            // A. The Pole
            const poleGeom = new THREE.BoxGeometry(0.4, 6, 0.4);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
            const pole = new THREE.Mesh(poleGeom, poleMat);
            pole.position.y = 3; // Sit on ground
            pole.castShadow = true;
            pole.receiveShadow = true;
            pole.name = 'pole';
            group.add(pole);

            // B. The Banner (The Rectangle)
            const bannerGeom = new THREE.BoxGeometry(1.2, 0.8, 0.1);
            const bannerMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, side: THREE.DoubleSide });
            const banner = new THREE.Mesh(bannerGeom, bannerMat);
            banner.position.set(0.6, 5.5, 0);
            banner.castShadow = true;
            banner.name = 'banner';
            group.add(banner);

            // C. The Zone Boundary (Ring)
            const radius = 8.0;
            const ringGeom = new THREE.RingGeometry(radius - 0.3, radius, 64);
            const ringMat = new THREE.MeshBasicMaterial({ 
                color: 0xffffff, 
                side: THREE.DoubleSide, 
                transparent: true, 
                opacity: 0.6 
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.1;
            group.add(ring);

            // D. Progress Disc – fills same radius as ring at 100%
            const progGeom = new THREE.CircleGeometry(radius, 64);
            const progMat = new THREE.MeshBasicMaterial({ 
                color: 0xcccccc, 
                side: THREE.DoubleSide, 
                transparent: true, 
                opacity: 0.4 
            });
            const progress = new THREE.Mesh(progGeom, progMat);
            progress.rotation.x = -Math.PI / 2;
            progress.position.y = 0.15;
            progress.scale.set(0, 0, 0);
            progress.name = 'progress';
            group.add(progress);
            object = group;
        } else {
            // Standard Soldier (Capsule)
            const geometry = new THREE.CapsuleGeometry(0.4, 1.8, 4, 8);
            const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            object = new THREE.Mesh(geometry, material);
            object.castShadow = true;
            object.receiveShadow = true;
        }

        this.scene.add(object);
        this.entities.set(id, object);
    }

    // --- STATE UPDATES ---
    object.position.set(state.pos.x, state.pos.y, state.pos.z);

    // === FLAG LOGIC ===
    if (state.type === 'flag') {
        const group = object as THREE.Group;

        // Ensure banner exists
        let banner = group.getObjectByName('banner') as THREE.Mesh;
        if (!banner) {
            const bannerGeom = new THREE.BoxGeometry(1.2, 0.8, 0.1);
            const bannerMat = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                side: THREE.DoubleSide,
            });
            banner = new THREE.Mesh(bannerGeom, bannerMat);
            banner.position.set(0.6, 5.5, 0);
            banner.castShadow = true;
            banner.name = 'banner';
            group.add(banner);
        }

        const pole = group.getObjectByName('pole') as THREE.Mesh;
        const progressDisc = group.getObjectByName('progress') as THREE.Mesh;

        if (!pole || !progressDisc) return;

        const poleMat = pole.material as THREE.MeshStandardMaterial;
        const bannerMat = banner.material as THREE.MeshStandardMaterial;
        const progMat = progressDisc.material as THREE.MeshBasicMaterial;

        // 1) Pole stays neutral at all times
        poleMat.color.setHex(0xcccccc);

        // 2) Base ownership color (used when there is no active capture)
        let baseColor = 0xcccccc;
        if (state.team === 1) baseColor = 0xff0000; // Axis owns
        else if (state.team === 2) baseColor = 0x0000ff; // Allies own

        // 3) Capture progress drives BOTH banner + circle colours
        //
        // state.progress in [-1, 1]:
        //   > 0  => Team 1 (Axis) capturing
        //   < 0  => Team 2 (Allies) capturing
        //   = 0  => no active capture
        const rawProgress = state.progress || 0;
        const clamped = Math.max(-1, Math.min(1, rawProgress));
        const t = Math.abs(clamped); // 0..1 capture amount

        // Scale disc 0% → 100% based on |progress|
        progressDisc.scale.set(t, t, t);

        // Target team colour based on sign
        let teamColor = 0xffffff; // no capture
        if (clamped > 0) {
            teamColor = 0xff0000; // Axis capturing
        } else if (clamped < 0) {
            teamColor = 0x0000ff; // Allies capturing
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

        return;
    }

    // === SOLDIER LOGIC ===
    if (object instanceof THREE.Mesh) {
        object.position.y += 0.9; // Adjust capsule pivot
        object.rotation.set(0, state.rot, 0);
        
        const mat = object.material as THREE.MeshStandardMaterial;

        if (isMe) {
            // FPS Camera placement
            this.camera.position.set(state.pos.x, state.pos.y + 1.6, state.pos.z);
            this.camera.rotation.set(state.pitch || InputState.viewY[id] || 0, state.rot, 0, 'YXZ');
            object.visible = false; // Hide own body
        } else {
            object.visible = true;
            // Team Colors
            if (state.team === 1) mat.color.setHex(0xff0000);
            else if (state.team === 2) mat.color.setHex(0x0000ff);
            else mat.color.setHex(0xffffff);
        }
    }
  }

  public removeEntity(id: number) {
    const obj = this.entities.get(id);
    if (obj) {
        this.scene.remove(obj);
        // Cleanup geometry/materials
        if (obj instanceof THREE.Mesh) {
            if (obj.geometry) obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                (obj.material as THREE.Material).dispose();
            }
        } else if (obj instanceof THREE.Group) {
            // Cleanup children if it's a group (like the flag)
            obj.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
        }
        this.entities.delete(id);
    }
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public getCamera() {
      return this.camera;
  }

  public drawTracer(start: THREE.Vector3, end: THREE.Vector3) {
      const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
      const points = [start, end];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      
      this.scene.add(line);

      setTimeout(() => {
          this.scene.remove(line);
          geometry.dispose();
          material.dispose();
      }, 100);
  }
}