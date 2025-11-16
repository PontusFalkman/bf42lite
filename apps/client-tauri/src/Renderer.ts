import * as THREE from 'three';
import { InputState } from '@bf42lite/sim'; // <--- FIX: Added Import

// [NEW] CONSTANTS for Aura
const AURA_RADIUS = 10; // This is the max radius (10 units)
const AURA_COLOR_CHARGE = 0xffffff;
const AURA_COLOR_ACTIVE = 0x00ff00;

export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  private entities = new Map<number, THREE.Mesh>();
  private defaultFov: number;

  // [NEW] Aura Visuals
  private auraVisuals = new Map<number, THREE.Mesh>();
  private auraChargeMaterial: THREE.MeshBasicMaterial;
  private auraActiveMaterial: THREE.MeshBasicMaterial;
  private auraGeometry: THREE.RingGeometry;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); 
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 100);
    this.defaultFov = 75; 

    // [FIXED] Corrected the PerspectiveCamera constructor
    this.camera = new THREE.PerspectiveCamera(this.defaultFov, window.innerWidth / window.innerHeight, 0.1, 1000);

    // [NEW] Create Aura Materials & Geometry
    this.auraChargeMaterial = new THREE.MeshBasicMaterial({ 
        color: AURA_COLOR_CHARGE, 
        opacity: 0.5, 
        transparent: true,
        side: THREE.DoubleSide
    });
    this.auraActiveMaterial = new THREE.MeshBasicMaterial({
        color: AURA_COLOR_ACTIVE,
        opacity: 0.3,
        transparent: true,
        side: THREE.DoubleSide
    });
    // A flat ring on the ground (X, Z plane)
    this.auraGeometry = new THREE.RingGeometry(AURA_RADIUS - 0.5, AURA_RADIUS, 32);


    // 1. Basic Floor
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshStandardMaterial({ color: 0x2a3b2a })
    );
    plane.rotation.x = -Math.PI / 2;
    this.scene.add(plane);

    // 2. Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(20, 50, 20);
    light.castShadow = true;
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x404040)); 

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // 4. Test Cube
    const cube = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
    );
    cube.position.set(0, 0.5, -5);
    this.scene.add(cube);
  }

  /**
   * Toggles the camera zoom for aiming.
   * @param isZoomed - True to zoom in, false to reset.
   */
  public setZoom(isZoomed: boolean) {
      const targetFov = isZoomed ? 20 : this.defaultFov; 
      if (this.camera.fov !== targetFov) {
          this.camera.fov = targetFov;
          this.camera.updateProjectionMatrix(); 
      }
  }

  public updateEntity(id: number, state: any, isMe: boolean) {
    let mesh = this.entities.get(id);
    if (!mesh) {
        if (state.type === 'player') {
            const geometry = new THREE.CapsuleGeometry(0.5, 0.8, 4, 8); 
            const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
            mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);
            this.entities.set(id, mesh);
        } else if (state.type === 'flag') {
            const geometry = new THREE.BoxGeometry(1, 4, 1);
            const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
            mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);
            this.entities.set(id, mesh);
        }
    }

    if (!mesh) return; 

    // --- Update Player ---
    if (state.type === 'player') {
        mesh.position.set(state.pos.x, state.pos.y - 0.9, state.pos.z); // Capsule offset
        mesh.rotation.set(0, state.rot, 0);
        
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (isMe) {
            this.camera.position.set(state.pos.x, state.pos.y + 0.7, state.pos.z); // Adjusted height
            this.camera.rotation.set(state.pitch, state.rot, 0, 'YXZ');
            mesh.visible = false; 
        } else {
            mesh.visible = true;
            if (state.team === 1) mat.color.setHex(0xff0000); // Axis
            else if (state.team === 2) mat.color.setHex(0x0000ff); // Allies
            else mat.color.setHex(0xff0000);
        }
        
        // --- [NEW] Update Aura Visual ---
        let auraMesh = this.auraVisuals.get(id);
        if (!auraMesh) {
            // Create it if it doesn't exist
            auraMesh = new THREE.Mesh(this.auraGeometry, this.auraChargeMaterial);
            auraMesh.rotation.x = Math.PI / 2; // Rotate to be flat on ground
            this.scene.add(auraMesh);
            this.auraVisuals.set(id, auraMesh);
        }

        // Set position to player's feet
        auraMesh.position.set(state.pos.x, state.pos.y - 0.9, state.pos.z);

        if (state.auraActive) {
            // --- ACTIVE GREEN PULSING AURA ---
            auraMesh.material = this.auraActiveMaterial;
            const pulse = 1.0 + Math.sin(Date.now() * 0.005) * 0.05; 
            auraMesh.scale.set(pulse, pulse, pulse);
            auraMesh.visible = true;

        } else if (state.auraProgress > 0) {
            // --- CHARGING WHITE AURA ---
            auraMesh.material = this.auraChargeMaterial;
            const scale = state.auraProgress;
            auraMesh.scale.set(scale, scale, scale);
            auraMesh.visible = true;

        } else {
            // --- NO AURA ---
            auraMesh.visible = false;
        }

    // --- Update Flag ---
    } else if (state.type === 'flag') {
        mesh.position.set(state.pos.x, state.pos.y, state.pos.z);
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (state.team === 1) mat.color.setHex(0xff0000); // Axis
        else if (state.team === 2) mat.color.setHex(0x0000ff); // Allies
        else mat.color.setHex(0x888888); // Neutral
    }
  }

  public removeEntity(id: number) {
    const mesh = this.entities.get(id);
    if (mesh) {
        this.scene.remove(mesh);
        if (mesh.geometry) mesh.geometry.dispose();
        this.entities.delete(id);
    }
    
    // [NEW] Remove aura visual
    const auraMesh = this.auraVisuals.get(id);
    if (auraMesh) {
        this.scene.remove(auraMesh);
        this.auraVisuals.delete(id);
    }
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public getCamera() {
      return this.camera;
  }

  public drawTracer(start: THREE.Vector3, end: THREE.Vector3) {
      const material = new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.5
      });
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const line = new THREE.Line(geometry, material);
      this.scene.add(line);

      setTimeout(() => {
          this.scene.remove(line);
          material.dispose();
          geometry.dispose();
      }, 100); 
  }
}