

---



\### `/docs/32\_design\_sim\_weapons.md`

```markdown

\# Weapons System Design (v1.2)



\## Purpose

Define how firing, hit detection, and basic damage work in a deterministic way.



\## Components

```ts

Weapon {

&nbsp; fireRate: number;   // shots per second

&nbsp; cooldown: number;   // time until next shot allowed

&nbsp; damage: number;     // hit damage

}



Health {

&nbsp; current: number;

&nbsp; max: number;

}



Projectile (optional Phase 5) {

&nbsp; x, y, z;

&nbsp; dirX, dirY, dirZ;

&nbsp; speed;

&nbsp; ttl;

}



Fire Flow (Hitscan MVP)



Per tick:



Client sends input event “fire”.



Server checks Weapon.cooldown <= 0.



If allowed:



Perform hitscan along view direction.



If it intersects an entity with Health, apply damage.



Reset Weapon.cooldown = 1 / fireRate.



Each tick:



Weapon.cooldown = Math.max(0, Weapon.cooldown - dt);



Damage and Death



On hit:



Health.current -= Weapon.damage;

if (Health.current <= 0) -> death event





Death event triggers respawn logic (Phase 4).



Determinism and RNG



For spread and recoil (Phase 4–5), use a seeded RNG per tick and entity.



Do not use wall-clock time in any calculation.



Next: 40\_design\_net\_protocol.md

