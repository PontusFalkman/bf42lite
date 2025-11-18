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
        ammoCurr: HTMLElement | null;
        ammoRes: HTMLElement | null;
        weaponName: HTMLElement | null;
    };
    private selectedSpawnId = -1;
    private hitTimeout: number | null = null;
    
    // FIX: Update signature to accept classId
    private onSpawnRequest: (classId: number) => void;
    private selectedClassId = 0; // Default to Assault

    constructor(onSpawnRequest: (classId: number) => void) {
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
            ammoCurr: document.getElementById('ammo-curr'),
            ammoRes: document.getElementById('ammo-res'),
            weaponName: document.getElementById('weapon-name')
        };

        this.initListeners();
    }

    private initListeners() {
        // 1. Class Selection Listeners (NEW)
        const classBtns = document.querySelectorAll('.class-btn');
        classBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update Visuals
                classBtns.forEach(b => b.classList.remove('selected'));
                const target = e.target as HTMLElement;
                target.classList.add('selected');
                
                // Update Logic
                const id = target.getAttribute('data-id');
                if (id) this.selectedClassId = parseInt(id);
            });
        });

        // 2. Map / Spawn Point Click Listener
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.addEventListener('click', (e: Event) => {
                const target = (e.target as HTMLElement).closest('.spawn-point') as HTMLElement;
                if (!target) return;
                
                document.querySelectorAll('.spawn-point').forEach(el => el.classList.remove('selected'));
                target.classList.add('selected');
                
                this.selectedSpawnId = parseInt(target.dataset.id || "-1");
            });
        }

        // 3. Spawn Button Click Listener
        if (this.ui.spawnBtn) {
            this.ui.spawnBtn.addEventListener('click', () => {
                // Note: We can relax the spawn point requirement if we are just doing random spawns for now
                // if (this.selectedSpawnId === -1) { ... } 

                this.setDeployMode(false);
                
                // Pass the selected class ID to the game loop
                this.onSpawnRequest(this.selectedClassId);
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

    public updateAmmo(current: number, reserve: number, weaponName?: string) {
    if (this.ui.ammoCurr) this.ui.ammoCurr.innerText = current.toString();
    if (this.ui.ammoRes) this.ui.ammoRes.innerText = reserve.toString();
    if (this.ui.weaponName && weaponName) this.ui.weaponName.innerText = weaponName;
}

    public updateRespawn(isDead: boolean, timer: number) {
        if (!this.ui.deployScreen || !this.ui.spawnBtn) return;

        if (isDead) {
            this.ui.deployScreen.style.display = 'flex'; 
            
            if (timer > 0) {
                this.ui.spawnBtn.innerText = `Deploy in ${timer.toFixed(1)}s`;
                this.ui.spawnBtn.setAttribute('disabled', 'true');
                this.ui.spawnBtn.style.pointerEvents = 'none';
                this.ui.spawnBtn.style.opacity = '0.5';
            } else {
                this.ui.spawnBtn.innerText = "DEPLOY (Press SPACE)";
                this.ui.spawnBtn.removeAttribute('disabled');
                this.ui.spawnBtn.style.pointerEvents = 'auto';
                this.ui.spawnBtn.style.opacity = '1.0';
            }
        } else {
            this.ui.deployScreen.style.display = 'none';
        }
    }
}
