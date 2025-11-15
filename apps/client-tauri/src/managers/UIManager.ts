export class UIManager {
    private ui: {
        deployScreen: HTMLElement | null;
        hudLayer: HTMLElement | null;
        healthVal: HTMLElement | null;
        healthFill: HTMLElement | null;
        spawnBtn: HTMLElement | null;
        ticketsAxis: HTMLElement | null;
        ticketsAllies: HTMLElement | null;
        fps: HTMLElement | null;
        rtt: HTMLElement | null;
        hitmarker: HTMLElement | null;
        gameOverScreen: HTMLElement | null;
        endTitle: HTMLElement | null;
        // === NEW ===
        ammoCurr: HTMLElement | null;
        ammoRes: HTMLElement | null;
    };
    private selectedSpawnId = -1;
    private onSpawnRequest: () => void;
    private hitTimeout: number | null = null;

    constructor(onSpawnRequest: () => void) {
        this.onSpawnRequest = onSpawnRequest;
        
        this.ui = {
            deployScreen: document.getElementById('deploy-screen'),
            hudLayer: document.getElementById('hud-layer'),
            healthVal: document.getElementById('health-val'),
            healthFill: document.getElementById('health-fill'),
            spawnBtn: document.getElementById('btn-spawn'),
            ticketsAxis: document.getElementById('tickets-axis'),
            ticketsAllies: document.getElementById('tickets-allies'),
            fps: document.getElementById('fps'),
            rtt: document.getElementById('rtt'),
            hitmarker: document.getElementById('hitmarker'),
            gameOverScreen: document.getElementById('game-over-screen'),
            endTitle: document.getElementById('end-title'),
            // === NEW ===
            ammoCurr: document.getElementById('ammo-curr'),
            ammoRes: document.getElementById('ammo-res')
        };

        this.initListeners();
    }

    // ... (keep initListeners, setDeployMode, updateStats, updateHealth, updateTickets as is) ...

    private initListeners() {
        // 1. Map / Spawn Point Click Listener (Likely missing)
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.addEventListener('click', (e: Event) => {
                const target = (e.target as HTMLElement).closest('.spawn-point') as HTMLElement;
                if (!target) return;
                
                // Visual Feedback: Update Green Dot
                document.querySelectorAll('.spawn-point').forEach(el => el.classList.remove('selected'));
                target.classList.add('selected');
                
                // Logic: Save ID
                this.selectedSpawnId = parseInt(target.dataset.id || "-1");
            });
        }

        // 2. Spawn Button Click Listener
        if (this.ui.spawnBtn) {
            this.ui.spawnBtn.addEventListener('click', () => {
                // Validation: Must select a point
                if (this.selectedSpawnId === -1) {
                    alert("⚠️ You must select a spawn point first!");
                    return;
                }

                // Success: Start Game
                this.setDeployMode(false);
                this.onSpawnRequest();
            });
        }
    }

    public setDeployMode(isDeploying: boolean) {
        if (isDeploying) {
            this.ui.deployScreen?.classList.remove('hidden');
            this.ui.hudLayer?.classList.add('hidden');
            document.exitPointerLock();
        } else {
            this.ui.deployScreen?.classList.add('hidden');
            this.ui.hudLayer?.classList.remove('hidden');
            document.body.requestPointerLock();
        }
    }

    public updateStats(fps: number, rtt: number) {
        if (this.ui.fps) this.ui.fps.innerText = fps.toString();
        if (this.ui.rtt) this.ui.rtt.innerText = rtt.toString();
    }

    public updateHealth(current: number) {
        if (this.ui.healthVal) this.ui.healthVal.innerText = current.toString();
        if (this.ui.healthFill) this.ui.healthFill.style.width = `${current}%`;
    }

    public updateTickets(axis: number, allies: number) {
        if (this.ui.ticketsAxis) this.ui.ticketsAxis.innerText = axis.toString();
        if (this.ui.ticketsAllies) this.ui.ticketsAllies.innerText = allies.toString();
    }

    public showHitMarker() {
        if (!this.ui.hitmarker) return;
        this.ui.hitmarker.classList.remove('hit-active');
        void this.ui.hitmarker.offsetWidth; 
        this.ui.hitmarker.classList.add('hit-active');
        if (this.hitTimeout) clearTimeout(this.hitTimeout);
        this.hitTimeout = window.setTimeout(() => {
            this.ui.hitmarker?.classList.remove('hit-active');
        }, 200);
    }

    public setGameOver(isGameOver: boolean, winningTeam: string) {
        if (!this.ui.gameOverScreen || !this.ui.endTitle) return;
        if (isGameOver) {
            this.ui.gameOverScreen.classList.add('visible');
            this.ui.endTitle.innerText = winningTeam;
            document.exitPointerLock();
        } else {
            this.ui.gameOverScreen.classList.remove('visible');
        }
    }

    // === NEW ===
    public updateAmmo(current: number, reserve: number) {
        if (this.ui.ammoCurr) this.ui.ammoCurr.innerText = current.toString();
        if (this.ui.ammoRes) this.ui.ammoRes.innerText = reserve.toString();
    }
}