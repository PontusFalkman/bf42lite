// apps/client-tauri/src/Renderer.ts
import * as THREE from "three";

export class Renderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  playerObjects: Map<number, THREE.Mesh> = new Map();
  
  // Materials
  localMat = new THREE.MeshStandardMaterial({ color: 0x0044ff });
  enemyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  playerGeo = new THREE.BoxGeometry(2, 2, 2);
  debugCube: THREE.Mesh;

  constructor(canvas: HTMLCanvasElement) {
    // === RENDERER SETUP ===
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    // === SCENE ===
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 20, 30);

    // Lights & Ground
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(new THREE.GridHelper(200, 50));

    // Pillars
    const pillarGeo = new THREE.BoxGeometry(1, 4, 1);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const pillars = [ {x: 5, z: 5}, {x: -5, z: 5}, {x: 5, z: -5}, {x: -5, z: -5} ];
    pillars.forEach(p => {
        const mesh = new THREE.Mesh(pillarGeo, pillarMat);
        mesh.position.set(p.x, 2, p.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
    });

    // Debug Cube
    this.debugCube = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshNormalMaterial());
    this.debugCube.position.set(0,1,0);
    this.scene.add(this.debugCube);
    
    // Resize Listener
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  getPlayerObject(eid: number, isLocal: boolean): THREE.Mesh {
    let obj = this.playerObjects.get(eid);
    if (!obj) {
      const mat = isLocal ? this.localMat : this.enemyMat;
      obj = new THREE.Mesh(this.playerGeo, mat.clone());
      obj.castShadow = true;
      obj.receiveShadow = true;
      this.scene.add(obj);
      this.playerObjects.set(eid, obj);
    }
    return obj;
  }

  updateEntities(entities: any[], localPlayerEid: number | null) {
    // In a real system, we would hide objects that aren't in the list anymore
    // For this refactor, we simply update positions
    for (const e of entities) {
      const isMe = (e.eid === localPlayerEid);
      const obj = this.getPlayerObject(e.eid, isMe);
      
      const px = e.transform.x ?? 0;
      const py = e.transform.y ?? 0;
      const pz = e.transform.z ?? 0;

      obj.position.set(px, py, pz);
      if (typeof e.transform.yaw === "number") obj.rotation.y = e.transform.yaw;
      obj.visible = true;
    }
  }

  updateCamera(x: number, y: number, z: number, yaw: number) {
    const dist = 6;
    const height = 2;
    const offX = -Math.sin(yaw) * dist;
    const offZ = -Math.cos(yaw) * dist;
    this.camera.position.set(x + offX, y + height, z + offZ);
    this.camera.lookAt(x, y + 1.2, z);
  }

  render() {
    this.debugCube.rotation.y += 0.01;
    this.renderer.render(this.scene, this.camera);
  }
}