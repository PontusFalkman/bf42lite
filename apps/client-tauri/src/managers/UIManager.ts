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
    
    // [FIX] Constructor no longer takes an argument
    constructor() {
        this.ui = {
            deployScreen: document.getElementById('deploy-screen'),
            hudLayer: document.getElementById('hud-layer'),
            healthVal: document.getElementById('health-val'),
            healthFill: document.getElementById('health-fill'),
            spawnBtn: document.getElementById('btn-spawn'),
            ticketsAxis: document.getElementById('tickets-axis'),
            ticketsAllies: document.getElementById('tickets-allies'),
            fps: document.getElementById('fps-val'), // Assumed ID
            rtt: document.getElementById('rtt-val'), // Assumed ID
            hitmarker: document.getElementById('hitmarker'),
            gameOverScreen: document.getElementById('game-over'), // Assumed ID
            endTitle: document.getElementById('end-title'), // Assumed ID
            ammoCurr: document.getElementById('ammo-curr'), // Assumed ID
            ammoRes: document.getElementById('ammo-res'), // Assumed ID
            weaponName: document.getElementById('weapon-name'), // Assumed ID
        };

        // [FIX] Spawn request logic is now internal
        if (this.ui.spawnBtn) {
            this.ui.spawnBtn.addEventListener('click', () => {
                // We'd need to pass the spawn request to ClientGame,
                // but for now, this just hides the screen.
                if (this.ui.deployScreen) {
                    this.ui.deployScreen.style.display = 'none';
                }
            });
        }
    }

    // ... (All other update methods: updateStats, updateHealth, etc.)
    public updateStats(fps: number, rtt: number) {
        if (this.ui.fps) this.ui.fps.innerText = Math.round(fps).toString();
        if (this.ui.rtt) this.ui.rtt.innerText = Math.round(rtt).toString();
    }

    public updateHealth(current: number) {
        const perc = (current / 100) * 100;
        if (this.ui.healthVal) this.ui.healthVal.innerText = Math.round(current).toString();
        if (this.ui.healthFill) this.ui.healthFill.style.width = `${perc}%`;
    }

    public updateTickets(axis: number, allies: number) {
        if (this.ui.ticketsAxis) this.ui.ticketsAxis.innerText = axis.toString();
        if (this.ui.ticketsAllies) this.ui.ticketsAllies.innerText = allies.toString();
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
            } else {
                this.ui.spawnBtn.innerText = "DEPLOY (Press SPACE)";
                this.ui.spawnBtn.removeAttribute('disabled');
            }
        } else {
            this.ui.deployScreen.style.display = 'none';
        }
    }

    // [NEW] Added missing showHitmarker method
    public showHitmarker() {
        if (!this.ui.hitmarker) return;
        
        this.ui.hitmarker.style.opacity = '1';
        
        if (this.hitTimeout) clearTimeout(this.hitTimeout);
        
        this.hitTimeout = window.setTimeout(() => {
            if (this.ui.hitmarker) this.ui.hitmarker.style.opacity = '0';
        }, 100);
    }
}