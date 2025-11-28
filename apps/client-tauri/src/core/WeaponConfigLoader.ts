export interface WeaponConfig {
  id: number;
  key: string;
  name: string;
  damage_per_hit: number;
  fire_rate: number;
  mag_size: number;
  reserve_ammo: number;
  recoil: number;
}

export async function loadWeaponConfig(): Promise<WeaponConfig[]> {
  const res = await fetch("weapons.json");
  if (!res.ok) {
    console.error("[WEAPONS] Failed to load weapons.json");
    return [];
  }
  return await res.json();
}
