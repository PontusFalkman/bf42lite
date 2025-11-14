import * as THREE from 'three';

export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private meshes = new Map<number, THREE.Mesh>();
  
  // Reusable geometry/material to save memory
  private playerGeo = new THREE.BoxGeometry(1, 2, 1);
  private localMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green = Me
  private remoteMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red = Enemy

  constructor() {
    // 1. Setup Basic Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky Blue
    
    // 2. Lights
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0x404040));

    // 3. Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    // 4. Camera & Canvas
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    // Set rotation order to YXZ to prevent camera flipping weirdly when looking up/down
    this.camera.rotation.order = 'YXZ'; 

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    // Resize Handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Sync ECS state to Three.js Meshes
  updateEntity(id: number, x: number, y: number, z: number, yaw: number, pitch: number, isLocal: boolean) {
    let mesh = this.meshes.get(id);
    
    // Create if new
    if (!mesh) {
      mesh = new THREE.Mesh(this.playerGeo, isLocal ? this.localMat : this.remoteMat);
      this.scene.add(mesh);
      this.meshes.set(id, mesh);
    }

    // 1. Update Mesh Position & Rotation
    // Lift by 1.0 because pivot is center, but game y=0 is floor
    mesh.position.set(x, y + 1.0, z);
    mesh.rotation.y = yaw; // Horizontal rotation

    // 2. Camera Logic (FPS vs TPS)
    if (isLocal) {
      // === FPS MODE ===
      // Hide our own body so we don't clip through it
      mesh.visible = false; 

      // Place camera at "Eye Level" (1.6m is standard human eye height)
      this.camera.position.set(x, y + 1.6, z);
      
      // Apply look rotation
      this.camera.rotation.y = yaw;   // Look Left/Right
      this.camera.rotation.x = pitch; // Look Up/Down
    } else {
      // Show enemies
      mesh.visible = true;
    }
  }

  removeEntity(id: number) {
    const mesh = this.meshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.meshes.delete(id);
    }
  }
// Expose camera for Raycasting
getCamera(): THREE.PerspectiveCamera {
  return this.camera;
}

// Visual: Draw a laser/bullet line that fades out
drawTracer(start: THREE.Vector3, end: THREE.Vector3) {
  // Create a line geometry
  const points = [start, end];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffff00 }); // Yellow tracer
  
  const line = new THREE.Line(geometry, material);
  this.scene.add(line);

  // Simple "cleanup" - remove after 100ms
  setTimeout(() => {
    this.scene.remove(line);
    geometry.dispose();
    material.dispose();
  }, 100);
}

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}