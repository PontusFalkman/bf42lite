import * as THREE from 'three';
import { InputState } from '@bf42lite/sim'; // <--- FIX: Added Import

export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  private entities = new Map<number, THREE.Mesh>();

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); 
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 100); 

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

    // 3. Camera Setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    // 4. Renderer Setup
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    
    window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // UPDATED SIGNATURE: Takes full state object
  public updateEntity(id: number, state: any, isMe: boolean) {
    let mesh = this.entities.get(id);

    // 1. Create Mesh (Handle types)
    if (!mesh) {
        let geometry;
        let material;

        if (state.type === 'flag') {
             // Tall Box for Flag
             geometry = new THREE.BoxGeometry(1, 8, 1);
             material = new THREE.MeshStandardMaterial({ color: 0x888888 }); 
        } else {
             // Soldier Capsule
             geometry = new THREE.CapsuleGeometry(0.4, 1.8, 4, 8);
             material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        }

        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.entities.set(id, mesh);
    }

    // 2. Update Visuals
    mesh.position.set(state.pos.x, state.pos.y, state.pos.z);

    // --- FLAG LOGIC ---
    if (state.type === 'flag') {
        mesh.position.y = 4; // Sit on ground (height/2)
        
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (state.team === 1) mat.color.setHex(0xff0000);      // Axis Red
        else if (state.team === 2) mat.color.setHex(0x0000ff); // Allies Blue
        else mat.color.setHex(0xcccccc);                       // Neutral Grey
        
        return; // Done with flag
    }

    // --- SOLDIER LOGIC ---
    mesh.position.y += 0.9; // Capsule offset
    mesh.rotation.set(0, state.rot, 0);
    
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (isMe) {
        this.camera.position.set(state.pos.x, state.pos.y + 1.6, state.pos.z);
        // Fix: InputState is now imported
        this.camera.rotation.set(state.pitch || InputState.viewY[id] || 0, state.rot, 0, 'YXZ');
        mesh.visible = false; 
    } else {
        mesh.visible = true;
        // Use Team Color if available, else Red
        if (state.team === 1) mat.color.setHex(0xff0000);
        else if (state.team === 2) mat.color.setHex(0x0000ff);
        else mat.color.setHex(0xff0000);
    }
  }

  public removeEntity(id: number) {
    const mesh = this.entities.get(id);
    if (mesh) {
        this.scene.remove(mesh);
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