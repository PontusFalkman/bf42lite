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
        hitmarker: HTMLElement | null;
        gameOverScreen: HTMLElement | null;
        endTitle: HTMLElement | null;
        ammoCurr: HTMLElement | null;
        ammoRes: HTMLElement | null;
        weaponName: HTMLElement | null;

        objectiveText: HTMLElement | null;
        flagStrip: HTMLElement | null;
        centerStatus: HTMLElement | null;
        flagList: HTMLElement | null;
        killFeed: HTMLElement | null;
        crosshair: HTMLElement | null;

    };

    private selectedSpawnId = -1;
    private hitTimeout: number | null = null;

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
            weaponName: document.getElementById('weapon-name'),

            objectiveText: document.getElementById('objective-text'),
            flagStrip: document.getElementById('flag-strip'),
            centerStatus: document.getElementById('center-status'),
            flagList: document.getElementById('flag-list'),
            killFeed: document.getElementById('kill-feed'),

            crosshair: document.getElementById('crosshair'),
        };

        this.initListeners();
    }
    /**
     * Crosshair spread animation (0 = tight, >0 = expanded).
     * We simply bump the font size for a simple “breathing” effect.
     */
    public setCrosshairSpread(spread: number) {
        if (!this.ui.crosshair) return;
    
        // 0..1 from WeaponSystem
        const clamped = Math.max(0, Math.min(spread, 1));
    
        const baseGap = 6;       // idle distance from center (px)
        const extraGap = clamped * 6; // extra when shooting
    
        const top = this.ui.crosshair.querySelector('.ch-top') as HTMLElement | null;
        const bottom = this.ui.crosshair.querySelector('.ch-bottom') as HTMLElement | null;
        const left = this.ui.crosshair.querySelector('.ch-left') as HTMLElement | null;
        const right = this.ui.crosshair.querySelector('.ch-right') as HTMLElement | null;
    
        if (top)    top.style.marginTop    = `${-(baseGap + extraGap)}px`;
        if (bottom) bottom.style.marginTop = `${ baseGap + extraGap }px`;
        if (left)   left.style.marginLeft  = `${-(baseGap + extraGap)}px`;
        if (right)  right.style.marginLeft = `${ baseGap + extraGap }px`;
    }    
   
    private initListeners() {
        // 1. Class Selection Listeners
        const classBtns = document.querySelectorAll('.class-btn');
        classBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                classBtns.forEach(b => b.classList.remove('selected'));
                const target = e.currentTarget as HTMLElement;
                target.classList.add('selected');

                const id = target.getAttribute('data-id');
                if (id) this.selectedClassId = parseInt(id, 10) || 0;
            });
        });

        // 2. Map / Spawn Point Click Listener
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.addEventListener('click', (e: Event) => {
                const target = (e.target as HTMLElement).closest('.spawn-point') as HTMLElement | null;
                if (!target) return;

                document
                    .querySelectorAll('.spawn-point')
                    .forEach(el => el.classList.remove('selected'));
                target.classList.add('selected');

                this.selectedSpawnId = parseInt(target.dataset.id || '-1', 10);
            });
        }

// 3. Spawn Button Click Listener
if (this.ui.spawnBtn) {
    this.ui.spawnBtn.addEventListener('click', () => {
        // Require a spawn point selection
        if (this.selectedSpawnId < 0) {
            this.setCenterStatus('Select a spawn point first.');
            console.warn('[UI] Deploy clicked but no spawn point selected');
            return;
        }

        // Optimistic deploy: hide deploy screen immediately.
        this.setDeployMode(false);

        // Let the server know which class we chose.
        this.onSpawnRequest(this.selectedClassId);
    });
}
    }

    // Show / hide deploy vs in-game HUD
    public setDeployMode(isDeploying: boolean) {
        if (isDeploying) {
            this.ui.deployScreen?.classList.remove('hidden');
            this.ui.hudLayer?.classList.add('hidden');
            document.exitPointerLock();
            if (this.ui.centerStatus) this.ui.centerStatus.innerText = '';
        } else {
            this.ui.deployScreen?.classList.add('hidden');
            this.ui.hudLayer?.classList.remove('hidden');

            const canvas = document.getElementById('game') as HTMLCanvasElement | null;
            if (canvas && document.pointerLockElement !== canvas) {
                canvas.requestPointerLock?.();
            }
        }
    }

    // Debug overlay stats
    public updateStats(fps: number, rtt: number) {
        if (this.ui.fps) this.ui.fps.innerText = fps.toFixed(0);
        if (this.ui.rtt) this.ui.rtt.innerText = rtt.toFixed(0);
    }

    public updateHealth(current: number) {
        if (this.ui.healthVal) this.ui.healthVal.innerText = current.toString();
        if (this.ui.healthFill) this.ui.healthFill.style.width = `${current}%`;
    }

    // Tickets + objective text
    public updateTickets(axis: number, allies: number) {
        // Round for display but keep logic using original floats
        const axisRounded = Math.max(0, Math.round(axis));
        const alliesRounded = Math.max(0, Math.round(allies));

        // AXIS
        if (this.ui.ticketsAxis) {
            this.ui.ticketsAxis.innerText = axisRounded.toString();

            if (axisRounded <= 20) this.ui.ticketsAxis.classList.add('low');
            else this.ui.ticketsAxis.classList.remove('low');
        }

        // ALLIES
        if (this.ui.ticketsAllies) {
            this.ui.ticketsAllies.innerText = alliesRounded.toString();

            if (alliesRounded <= 20) this.ui.ticketsAllies.classList.add('low');
            else this.ui.ticketsAllies.classList.remove('low');
        }

        // OBJECTIVE TEXT (still uses float logic, works fine)
        if (this.ui.objectiveText) {
            if (axis <= 0 && allies > 0) {
                this.ui.objectiveText.innerText = 'ALLIES ARE WINNING – HOLD YOUR FLAGS';
            } else if (allies <= 0 && axis > 0) {
                this.ui.objectiveText.innerText = 'AXIS ARE WINNING – HOLD YOUR FLAGS';
            } else {
                this.ui.objectiveText.innerText = 'CAPTURE AND HOLD THE FLAGS';
            }
        }
    }

    // Center status line (respawn / capturing hints)
    public setCenterStatus(text: string) {
        if (this.ui.centerStatus) {
            this.ui.centerStatus.innerText = text;
        }
    }

    /**
     * High-level entry point for all flag HUD elements.
     *
     * - Clears both strip + list if there are no flags.
     * - Uses raw snapshot objects for the mini strip.
     * - Normalizes data for the detailed list.
     */
    public updateFlagsHUD(rawFlags: any[] | undefined | null) {
        const flags = rawFlags ?? [];

        // No flags: clear both HUD elements and bail.
        if (!flags.length) {
            if (this.ui.flagStrip) {
                this.ui.flagStrip.innerHTML = '';
            }
            if (this.ui.flagList) {
                this.ui.flagList.innerHTML = '';
            }
            return;
        }

        // Mini strip uses the raw snapshot objects (id + owner).
        this.updateFlagStrip(flags as { id: number; owner: any }[]);

        // Detailed list uses a small normalized DTO.
        this.updateFlagList(
            flags.map((f: any) => ({
                id: f.id,
                owner: f.owner,
                capture: typeof f.capture === 'number' ? f.capture : 0,
            })),
        );
    }

    // Mini flag-strip at top center
    public updateFlagStrip(flags: { id: number; owner: any }[]) {
        if (!this.ui.flagStrip) return;
        const root = this.ui.flagStrip;
        root.innerHTML = '';

        flags.forEach((f) => {
            const div = document.createElement('div');
            div.classList.add('flag-mini');

            let cls = 'neutral';
            if (f.owner === 'TeamA' || f.owner === 1) cls = 'axis';
            else if (f.owner === 'TeamB' || f.owner === 2) cls = 'allies';

            div.classList.add(cls);
            root.appendChild(div);
        });
    }

    // Detailed flag list bottom-left
    public updateFlagList(flags: { id: number; owner: any; capture: number }[]) {
        if (!this.ui.flagList) return;
        const root = this.ui.flagList;
        root.innerHTML = '';

        flags.forEach((f) => {
            const row = document.createElement('div');
            row.classList.add('flag-row');

            const name = document.createElement('span');
            name.classList.add('flag-name');
            name.innerText = `Flag ${f.id}`;

            const owner = document.createElement('span');
            owner.classList.add('flag-owner');

            let ownerCls = 'neutral';
            let label = 'NEUTRAL';

            if (f.owner === 'TeamA' || f.owner === 1) {
                ownerCls = 'axis';
                label = 'AXIS';
            } else if (f.owner === 'TeamB' || f.owner === 2) {
                ownerCls = 'allies';
                label = 'ALLIES';
            }

            owner.classList.add(ownerCls);
            owner.innerText = label;

            const bar = document.createElement('div');
            bar.classList.add('flag-progress');

            const fill = document.createElement('div');
            fill.classList.add('flag-progress-fill');

            const t = Math.min(1, Math.abs(f.capture || 0));
            fill.style.width = `${t * 100}%`;

            bar.appendChild(fill);
            row.appendChild(name);
            row.appendChild(owner);
            row.appendChild(bar);

            root.appendChild(row);
        });
    }

    // Kill feed on the right side
    public pushKillFeed(killer: string, victim: string, weapon?: string) {
        if (!this.ui.killFeed) return;

        const entry = document.createElement('div');
        entry.classList.add('kill-entry');

        const weaponText = weapon ? ` [${weapon}]` : '';
        entry.innerText = `${killer} ➜ ${victim}${weaponText}`;

        this.ui.killFeed.prepend(entry);

        while (this.ui.killFeed.children.length > 5) {
            this.ui.killFeed.removeChild(this.ui.killFeed.lastChild as Node);
        }

        setTimeout(() => {
            entry.classList.add('fade-out');
            setTimeout(() => entry.remove(), 500);
        }, 3000);
    }

    public showHitMarker(_damage?: number) {
        if (!this.ui.hitmarker) return;
        this.ui.hitmarker.classList.remove('hit-active');
        void this.ui.hitmarker.offsetWidth;
        this.ui.hitmarker.classList.add('hit-active');

        if (this.hitTimeout) clearTimeout(this.hitTimeout);
        this.hitTimeout = window.setTimeout(() => {
            if (this.ui.hitmarker) {
                this.ui.hitmarker.classList.remove('hit-active');
            }
        }, 200);
    }

    public setGameOver(isGameOver: boolean, winningTeam: string) {
        if (!this.ui.gameOverScreen || !this.ui.endTitle) return;
    
        if (isGameOver) {
            this.ui.gameOverScreen.classList.add('visible');
            this.ui.endTitle.innerText = winningTeam;
            document.exitPointerLock?.();
        } else {
            this.ui.gameOverScreen.classList.remove('visible');
            this.ui.endTitle.innerText = '';
        }
    }    

    public updateAmmo(current: number, reserve: number, weaponName?: string) {
        if (this.ui.ammoCurr) this.ui.ammoCurr.innerText = current.toString();
        if (this.ui.ammoRes) this.ui.ammoRes.innerText = reserve.toString();
        if (this.ui.weaponName && weaponName) this.ui.weaponName.innerText = weaponName;
    }

    // Respawn timer → center status and spawn button text
// Respawn timer → center status and spawn button text
public updateRespawn(isDead: boolean, timer: number) {
    const t = Math.max(0, timer); // extra safety clamp

    if (isDead) {
        // Spawn button state (if present)
        if (this.ui.spawnBtn) {
            if (t > 0) {
                this.ui.spawnBtn.innerText = `Deploy in ${t.toFixed(1)}s`;
                this.ui.spawnBtn.setAttribute('disabled', 'true');
                this.ui.spawnBtn.style.pointerEvents = 'none';
                this.ui.spawnBtn.style.opacity = '0.5';
            } else {
                this.ui.spawnBtn.innerText = 'DEPLOY (Press SPACE)';
                this.ui.spawnBtn.removeAttribute('disabled');
                this.ui.spawnBtn.style.pointerEvents = 'auto';
                this.ui.spawnBtn.style.opacity = '1.0';
            }
        }

        // Center status – independent of whether the button exists
        if (t > 0) {
            this.setCenterStatus(`Respawning in ${t.toFixed(1)}s`);
        } else {
            this.setCenterStatus('Press SPACE or click DEPLOY to respawn');
        }
    } else {
        // Alive: clear center status and reset button visuals (even though deploy UI is hidden)
        if (this.ui.spawnBtn) {
            this.ui.spawnBtn.innerText = 'DEPLOY';
            this.ui.spawnBtn.removeAttribute('disabled');
            this.ui.spawnBtn.style.pointerEvents = 'auto';
            this.ui.spawnBtn.style.opacity = '1.0';
        }
        this.setCenterStatus('');
    }
}
}
