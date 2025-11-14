// apps/client-tauri/src/managers/UIManager.ts
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
    };
    private selectedSpawnId = -1;
    private onSpawnRequest: () => void;

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
            rtt: document.getElementById('rtt')
        };

        this.initListeners();
    }

    private initListeners() {
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

        if (this.ui.spawnBtn) {
            this.ui.spawnBtn.addEventListener('click', () => {
                if (this.selectedSpawnId === -1) {
                    alert("⚠️ You must select a spawn point first!");
                    return;
                }
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
            // Request pointer lock when entering game
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
}