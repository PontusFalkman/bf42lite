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
  updateEntity(id: number, x: number, y: number, z: number, isLocal: boolean) {
    let mesh = this.meshes.get(id);
    
    // Create if new
    if (!mesh) {
      mesh = new THREE.Mesh(this.playerGeo, isLocal ? this.localMat : this.remoteMat);
      this.scene.add(mesh);
      this.meshes.set(id, mesh);
    }

    // Update Position
    // We assume the pivot is at the center, but the ECS Y=0 is the floor.
    // So we lift the mesh up by half its height (1.0).
    mesh.position.set(x, y + 1.0, z);

    // Follow Camera (if local)
    if (isLocal) {
      // Simple 3rd person follow
      this.camera.position.set(x, y + 5, z + 8);
      this.camera.lookAt(x, y + 2, z);
    }
  }

  removeEntity(id: number) {
    const mesh = this.meshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.meshes.delete(id);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}