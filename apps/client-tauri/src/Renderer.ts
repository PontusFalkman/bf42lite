import * as THREE from 'three';

export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  // FIXED: This map was missing, causing the build error
  private entities = new Map<number, THREE.Mesh>();

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 100); // Simple fog for depth

    // 1. Basic Floor
    // We create a large grid to give a sense of scale and speed
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
    this.scene.add(new THREE.AmbientLight(0x404040)); // Soft fill light

    // 3. Camera Setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // 4. Renderer Setup
    // We attach to the existing <canvas id="game"> from index.html
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    
    // Handle Window Resize
    window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // Called every frame by ClientGame loop
  public updateEntity(id: number, x: number, y: number, z: number, rot: number, pitch: number, isMe: boolean) {
    let mesh = this.entities.get(id);

    // A. Create Mesh if it doesn't exist
    if (!mesh) {
        // Simple capsule representation for players
        const geometry = new THREE.CapsuleGeometry(0.4, 1.8, 4, 8);
        const material = new THREE.MeshStandardMaterial({ 
            color: isMe ? 0x00ff00 : 0xff0000 // Green for me, Red for enemies
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        
        this.scene.add(mesh);
        this.entities.set(id, mesh);
    }

    // B. Update Visual Position
    // The physics position (x,y,z) is at the feet/center bottom. 
    // We lift the mesh up by half height (0.9) so it stands ON the ground, not IN it.
    mesh.position.set(x, y + 0.9, z); 
    mesh.rotation.set(0, rot, 0);

    // C. Update Camera (First Person View)
    if (isMe) {
        // Camera goes at "Eye Level" (approx 1.6 units up)
        this.camera.position.set(x, y + 1.6, z);
        
        // Apply Look Rotation (YXZ order prevents gimbal lock)
        this.camera.rotation.set(pitch, rot, 0, 'YXZ');
        
        // Hide my own body mesh so I don't clip through it
        mesh.visible = false; 
    } else {
        mesh.visible = true;
    }
  }

  // FIXED: This method handles cleaning up disconnected players
  public removeEntity(id: number) {
    const mesh = this.entities.get(id);
    if (mesh) {
        this.scene.remove(mesh);
        // Important: Dispose geometry/material to prevent memory leaks
        if (mesh.geometry) mesh.geometry.dispose();
        this.entities.delete(id);
    }
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  public getCamera() {
      return this.camera;
  }

  // Visual effect for shooting
  public drawTracer(start: THREE.Vector3, end: THREE.Vector3) {
      const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
      const points = [start, end];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      
      this.scene.add(line);
      
      // Remove the tracer line after 100ms
      setTimeout(() => {
          this.scene.remove(line);
          geometry.dispose();
          material.dispose();
      }, 100);
  }
}