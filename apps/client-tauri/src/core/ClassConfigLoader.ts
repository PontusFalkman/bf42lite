export interface ClassConfig {
  id: number;
  key: string;
  name: string;
  max_health: number;
  primary_weapon_id: number;
}

export async function loadClassConfig(): Promise<ClassConfig[]> {
  const res = await fetch("classes.json");
  if (!res.ok) {
    console.error("[CLASSES] Failed to load classes.json");
    return [];
  }
  return await res.json();
}
