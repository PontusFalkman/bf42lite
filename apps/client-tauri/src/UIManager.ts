// apps/client-tauri/src/UIManager.ts

export class UIManager {
  canvasEl: HTMLCanvasElement;
  hudEl: HTMLElement | null;
  menuEl: HTMLElement | null;
  fpsEl: HTMLElement | null;
  respawnScreenEl: HTMLElement | null;
  respawnTimerEl: HTMLElement | null;
  btnDeploy: HTMLButtonElement | null;
  crosshairEl: HTMLElement;
  scoreboardEl: HTMLElement | null;
  
  private respawnInterval: number | null = null;

  constructor() {
    // ... (CSS Injection same as before) ...

    // === UI ELEMENTS ===
    this.canvasEl = document.getElementById("game") as HTMLCanvasElement;
    if (!this.canvasEl) {
      console.warn("Canvas #game missing, creating fallback.");
      this.canvasEl = document.createElement("canvas");
      this.canvasEl.id = "game";
      document.body.appendChild(this.canvasEl);
    }
    this.scoreboardEl = document.getElementById("scoreboard");
    this.hudEl = document.getElementById("hud");
    this.menuEl = document.getElementById("menu");
    this.fpsEl = document.getElementById("fps-counter");
    this.respawnScreenEl = document.getElementById("respawn-screen");
    this.respawnTimerEl = document.getElementById("respawn-timer");
    this.btnDeploy = document.getElementById("btn-deploy") as HTMLButtonElement;

    // === RESTORED: Missing ID Checks ===
    const missing: string[] = [];
    if (!this.hudEl) missing.push("#hud");
    if (!this.menuEl) missing.push("#menu");
    if (!this.fpsEl) missing.push("#fps-counter");
    if (!this.respawnScreenEl) missing.push("#respawn-screen");
    if (!this.respawnTimerEl) missing.push("#respawn-timer");
    if (!this.btnDeploy) missing.push("#btn-deploy");
    if (this.scoreboardEl) this.scoreboardEl.classList.add("hidden");

    // Check for elements not yet used in logic, but present in DOM
    if (!document.getElementById("scoreboard-top")) missing.push("#scoreboard-top");
    if (!document.getElementById("team-a-tickets")) missing.push("#team-a-tickets");
    if (!document.getElementById("team-b-tickets")) missing.push("#team-b-tickets");
    if (!document.getElementById("crosshair")) missing.push("#crosshair"); // Note: We create a dynamic one below
    if (!document.getElementById("scoreboard")) missing.push("#scoreboard");
    if (!document.getElementById("match-end-message")) missing.push("#match-end-message");
    if (!document.getElementById("match-winner")) missing.push("#match-winner");

    if (missing.length) console.warn("Missing UI ids:", missing.join(", "));
    if (this.menuEl) {
      this.menuEl.classList.add("hidden");
   }
    // CROSSHAIR (Dynamic creation matches your original logic)
    this.crosshairEl = document.createElement("div");
    // ... (Styles same as before) ...
    document.body.appendChild(this.crosshairEl);
  }

  updateFPS(fps: number) {
    if (this.fpsEl) this.fpsEl.textContent = `FPS: ${fps.toFixed(1)}`;
  }
setScoreboardVisible(visible: boolean) {
    if (!this.scoreboardEl) return;
    if (visible) {
      this.scoreboardEl.classList.remove("hidden");
    } else {
      this.scoreboardEl.classList.add("hidden");
    }
  }
  showRespawnScreen(duration: number, onDeploy: () => void) {
    document.exitPointerLock();
    this.crosshairEl.style.display = "none"; 
    this.respawnScreenEl?.classList.remove("hidden");
    this.hudEl?.classList.add("hidden");

    if(this.btnDeploy) {
      this.btnDeploy.disabled = true;
      this.btnDeploy.textContent = "DEPLOYING IN...";
      // Note: You might want to attach the onclick listener here or in main
      this.btnDeploy.onclick = onDeploy;
    }

    let remaining = duration;
    if(this.respawnTimerEl) this.respawnTimerEl.textContent = remaining.toString();
    
    if (this.respawnInterval) window.clearInterval(this.respawnInterval);
    
    this.respawnInterval = window.setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        window.clearInterval(this.respawnInterval!);
        this.respawnInterval = null;
        if(this.respawnTimerEl) this.respawnTimerEl.textContent = "READY";
        if(this.btnDeploy) {
          this.btnDeploy.disabled = false;
          this.btnDeploy.textContent = "DEPLOY";
        }
      } else {
        if(this.respawnTimerEl) this.respawnTimerEl.textContent = remaining.toString();
      }
    }, 1000);
  }

  hideRespawnScreen() {
    this.respawnScreenEl?.classList.add("hidden");
    this.hudEl?.classList.remove("hidden");
    this.crosshairEl.style.display = "block"; 
    if (this.respawnInterval) { 
        window.clearInterval(this.respawnInterval); 
        this.respawnInterval = null; 
    }
    this.canvasEl.requestPointerLock();
  }
}