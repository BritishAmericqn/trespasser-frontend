export interface WeaponConfig {
  id: string;
  name: string;
  category: 'primary' | 'secondary' | 'support';
  slotCost: number;
  description: string;
  textureKey: string;
  damage?: number;
  fireRate?: number;
  range?: string;
}

export const WEAPON_CONFIGS: Record<string, WeaponConfig> = {
  // PRIMARY WEAPONS (1 slot each)
  rifle: {
    id: 'rifle',
    name: 'Rifle',
    category: 'primary',
    slotCost: 1,
    description: 'Reliable automatic weapon',
    textureKey: 'weapon_rifle',
    damage: 25,
    fireRate: 600,
    range: 'Medium'
  },
  smg: {
    id: 'smg',
    name: 'SMG',
    category: 'primary',
    slotCost: 1,
    description: 'High rate of fire, close range',
    textureKey: 'weapon_smg',
    damage: 20,
    fireRate: 800,
    range: 'Short'
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    category: 'primary',
    slotCost: 1,
    description: 'Devastating close range damage',
    textureKey: 'weapon_shotgun',
    damage: 80,
    fireRate: 120,
    range: 'Very Short'
  },
  battlerifle: {
    id: 'battlerifle',
    name: 'Battle Rifle',
    category: 'primary',
    slotCost: 1,
    description: 'Balanced damage and range',
    textureKey: 'weapon_battlerifle',
    damage: 45,
    fireRate: 450,
    range: 'Medium'
  },
  sniperrifle: {
    id: 'sniperrifle',
    name: 'Sniper Rifle',
    category: 'primary',
    slotCost: 1,
    description: 'High damage, long range',
    textureKey: 'weapon_sniperrifle',
    damage: 100,
    fireRate: 60,
    range: 'Very Long'
  },

  // SECONDARY WEAPONS (1 slot each)
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    category: 'secondary',
    slotCost: 1,
    description: 'Standard sidearm',
    textureKey: 'weapon_pistol',
    damage: 35,
    fireRate: 200,
    range: 'Short'
  },
  revolver: {
    id: 'revolver',
    name: 'Revolver',
    category: 'secondary',
    slotCost: 1,
    description: 'High damage sidearm',
    textureKey: 'weapon_revolver',
    damage: 60,
    fireRate: 150,
    range: 'Short'
  },
  suppressedpistol: {
    id: 'suppressedpistol',
    name: 'Suppressed Pistol',
    category: 'secondary',
    slotCost: 1,
    description: 'Silent and deadly',
    textureKey: 'weapon_suppressedpistol',
    damage: 35,
    fireRate: 250,
    range: 'Short'
  },

  // SUPPORT WEAPONS (variable slot costs)
  grenade: {
    id: 'grenade',
    name: 'Grenade',
    category: 'support',
    slotCost: 1,
    description: 'Explosive fragmentation grenade',
    textureKey: 'fraggrenade',
    damage: 100,
    fireRate: 120,
    range: 'Medium'
  },
  smokegrenade: {
    id: 'smokegrenade',
    name: 'Smoke Grenade',
    category: 'support',
    slotCost: 1,
    description: 'Blocks vision, tactical cover',
    textureKey: 'weapon_smokegrenade'
  },
  flashbang: {
    id: 'flashbang',
    name: 'Flashbang',
    category: 'support',
    slotCost: 1,
    description: 'Blinds and disorients enemies',
    textureKey: 'weapon_flashbang'
  },
  grenadelauncher: {
    id: 'grenadelauncher',
    name: 'Grenade Launcher',
    category: 'support',
    slotCost: 2,
    description: 'Explosive projectile launcher',
    textureKey: 'weapon_grenadelauncher',
    damage: 120,
    fireRate: 90,
    range: 'Medium'
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket Launcher',
    category: 'support',
    slotCost: 2,
    description: 'High explosive rocket launcher',
    textureKey: 'weapon_rocket',
    damage: 150,
    fireRate: 60,
    range: 'Long'
  },
  machinegun: {
    id: 'machinegun',
    name: 'Machine Gun',
    category: 'support',
    slotCost: 3,
    description: 'Heavy suppressive fire',
    textureKey: 'weapon_machinegun',
    damage: 35,
    fireRate: 600,
    range: 'Long'
  },
  antimaterialrifle: {
    id: 'antimaterialrifle',
    name: 'Anti-Material Rifle',
    category: 'support',
    slotCost: 3,
    description: 'Destroys walls and equipment',
    textureKey: 'weapon_antimaterialrifle',
    damage: 200,
    fireRate: 30,
    range: 'Very Long'
  }
};

export const WEAPON_CATEGORIES = {
  primary: {
    name: 'Primary',
    maxSlots: 1,
    weapons: ['rifle', 'smg', 'shotgun', 'battlerifle', 'sniperrifle']
  },
  secondary: {
    name: 'Secondary', 
    maxSlots: 1,
    weapons: ['pistol', 'revolver', 'suppressedpistol']
  },
  support: {
    name: 'Support',
    maxSlots: 3,
    weapons: ['grenade', 'smokegrenade', 'flashbang', 'grenadelauncher', 'rocket', 'machinegun', 'antimaterialrifle']
  }
};

export interface PlayerLoadout {
  primary: string | null;
  secondary: string | null;
  support: string[];
  team: 'red' | 'blue' | null;
}

export const DEFAULT_LOADOUT: PlayerLoadout = {
  primary: 'rifle',
  secondary: 'pistol', 
  support: ['grenade', 'rocket'],
  team: null
};

// Helper functions
export function getWeaponConfig(weaponId: string): WeaponConfig | undefined {
  return WEAPON_CONFIGS[weaponId];
}

export function calculateSupportSlots(supportWeapons: string[]): number {
  return supportWeapons.reduce((total, weaponId) => {
    const config = getWeaponConfig(weaponId);
    return total + (config?.slotCost || 0);
  }, 0);
}

export function canAddSupportWeapon(currentSupport: string[], newWeapon: string): boolean {
  const currentSlots = calculateSupportSlots(currentSupport);
  const newWeaponSlots = getWeaponConfig(newWeapon)?.slotCost || 0;
  return (currentSlots + newWeaponSlots) <= WEAPON_CATEGORIES.support.maxSlots;
}

export function isValidLoadout(loadout: PlayerLoadout): boolean {
  // Check primary
  if (loadout.primary && !WEAPON_CATEGORIES.primary.weapons.includes(loadout.primary)) {
    return false;
  }
  
  // Check secondary
  if (loadout.secondary && !WEAPON_CATEGORIES.secondary.weapons.includes(loadout.secondary)) {
    return false;
  }
  
  // Check support slots
  const supportSlots = calculateSupportSlots(loadout.support);
  if (supportSlots > WEAPON_CATEGORIES.support.maxSlots) {
    return false;
  }
  
  // Check all support weapons are valid
  for (const weapon of loadout.support) {
    if (!WEAPON_CATEGORIES.support.weapons.includes(weapon)) {
      return false;
    }
  }
  
  return true;
} 