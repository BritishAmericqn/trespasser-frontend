# Audio Assets Guide

## Getting the FilmCow Sound Library

### 1. Download the Library
1. Go to: https://filmcow.itch.io/filmcow-sfx
2. Click "Download Now" (it's pay-what-you-want, so you can get it for free)
3. Download both ZIP files:
   - **FilmCow Recorded SFX.zip** (865 MB) - Main library
   - **FilmCow Designed SFX.zip** (234 MB) - Processed effects

### 2. Extract and Organize
After downloading, extract the files and organize them into our folder structure:

## Folder Structure

```
src/assets/audio/
├── weapons/
│   ├── PRIMARY WEAPONS
│   ├── rifle/
│   │   ├── shots/          # rifle_single.ogg, rifle_auto_burst.ogg
│   │   ├── reload/         # rifle_reload.ogg, bolt_action.ogg
│   │   └── shells/         # rifle_shell_drop.ogg
│   ├── smg/
│   │   ├── shots/          # smg_burst.ogg, smg_auto.ogg (higher pitch)
│   │   ├── reload/         # smg_reload_fast.ogg
│   │   └── shells/         # small_shell_drop.ogg
│   ├── shotgun/
│   │   ├── shots/          # shotgun_blast.ogg, pump_action.ogg
│   │   ├── reload/         # shell_insert.ogg, pump_sound.ogg
│   │   └── shells/         # shotgun_shell_drop.ogg
│   ├── battlerifle/
│   │   ├── shots/          # heavy_rifle_shot.ogg (slower, louder)
│   │   ├── reload/         # heavy_mag_reload.ogg
│   │   └── shells/         # large_shell_drop.ogg
│   ├── sniperrifle/
│   │   ├── shots/          # sniper_shot.ogg (loud, echoing)
│   │   ├── reload/         # bolt_action_slow.ogg
│   │   └── shells/         # sniper_shell_drop.ogg
│   │
│   ├── SECONDARY WEAPONS
│   ├── pistol/
│   │   ├── shots/          # pistol_shot_01.ogg, pistol_shot_02.ogg
│   │   ├── reload/         # pistol_reload.ogg, magazine_insert.ogg
│   │   └── shells/         # shell_drop_concrete.ogg
│   ├── revolver/
│   │   ├── shots/          # revolver_shot.ogg (heavy, booming)
│   │   └── reload/         # cylinder_open.ogg, cylinder_close.ogg
│   ├── suppressedpistol/
│   │   ├── shots/          # suppressed_shot.ogg (quiet puff)
│   │   ├── reload/         # quiet_reload.ogg
│   │   └── shells/         # shell_drop_quiet.ogg
│   │
│   ├── SUPPORT WEAPONS
│   ├── grenadelauncher/
│   │   ├── shots/          # grenade_launch.ogg (thump sound)
│   │   ├── reload/         # chamber_open.ogg, shell_load_heavy.ogg
│   │   └── shells/         # large_casing_drop.ogg
│   ├── machinegun/
│   │   ├── shots/          # mg_burst.ogg, mg_sustained.ogg
│   │   ├── reload/         # belt_feed.ogg, heavy_reload.ogg
│   │   └── shells/         # shell_rain.ogg (many shells)
│   ├── antimaterialrifle/
│   │   ├── shots/          # amr_shot.ogg (extremely loud)
│   │   ├── reload/         # heavy_bolt.ogg, magazine_heavy.ogg
│   │   └── shells/         # huge_shell_drop.ogg
│   ├── rocketlauncher/
│   │   ├── launch/         # rocket_launch.ogg, rocket_whoosh.ogg
│   │   ├── explosion/      # rocket_explode.ogg, large_explosion.ogg
│   │   └── reload/         # rocket_reload.ogg, heavy_click.ogg
│   │
│   ├── THROWN WEAPONS
│   ├── grenade/
│   │   ├── pin/            # pin_pull.ogg
│   │   ├── throw/          # grenade_throw.ogg
│   │   ├── bounce/         # grenade_bounce_concrete.ogg
│   │   └── explosion/      # grenade_explode.ogg, frag_explosion.ogg
│   ├── smokegrenade/
│   │   ├── pin/            # pin_pull.ogg (same as grenade)
│   │   ├── throw/          # throw_whoosh.ogg
│   │   └── bounce/         # smoke_bounce.ogg
│   └── flashbang/
│       ├── pin/            # pin_pull_quick.ogg
│       ├── throw/          # flashbang_throw.ogg
│       └── explosion/      # flashbang_pop.ogg, high_pitch_ring.ogg
├── impacts/
│   ├── concrete/           # bullet_impact_concrete_01.ogg, etc.
│   ├── metal/              # bullet_impact_metal_01.ogg, etc.
│   ├── wood/               # bullet_impact_wood_01.ogg, etc.
│   ├── flesh/              # bullet_impact_flesh.ogg
│   └── ricochet/           # ricochet_01.ogg, ricochet_02.ogg
├── ui/
│   ├── buttons/            # button_click.ogg, button_hover.ogg
│   ├── menus/              # menu_open.ogg, menu_close.ogg
│   └── notifications/      # notification_alert.ogg, error_beep.ogg
├── ambient/
│   ├── background/         # ambient_tension.ogg, background_hum.ogg
│   └── environmental/      # wind.ogg, indoor_reverb.ogg
└── effects/
    ├── footsteps/          # footstep_concrete.ogg, footstep_metal.ogg
    ├── movement/           # player_jump.ogg, player_land.ogg
    └── destruction/        # wall_break.ogg, debris_fall.ogg
```

## Sound Mapping for Your Game

Based on your existing assets, here's what to look for in the FilmCow library:

### Primary Weapons
- **Rifle**: Look for automatic weapon sounds, burst fire
- **SMG**: Higher pitched, faster automatic fire sounds
- **Shotgun**: Heavy blast sounds, pump action mechanics
- **Battle Rifle**: Heavier, slower rifle sounds
- **Sniper Rifle**: Loud, echoing single shots

### Secondary Weapons
- **Pistol**: Sharp, quick gunshot sounds
- **Revolver**: Heavy, booming handgun sounds
- **Suppressed Pistol**: Quiet "puff" or "thwip" sounds

### Support Weapons
- **Grenade Launcher**: "Thump" or "bloop" launch sounds
- **Machine Gun**: Sustained automatic fire, belt-fed sounds
- **Anti-Material Rifle**: Extremely loud, powerful shots
- **Rocket Launcher**: Explosion sounds, whoosh sounds

### Thrown Weapons
- **Grenade**: Pin pull, throw whoosh, metal bounces, explosion
- **Smoke Grenade**: Similar to grenade but with hissing smoke sound
- **Flashbang**: Quick pin pull, lighter throw, sharp pop explosion

### Impact Sounds
- Search for "metal hit", "concrete impact", "wood break"
- Look for ricochet sounds (metal on metal)

### UI Sounds
- Search for "click", "beep", "button" sounds
- Look for notification-style sounds

## File Naming Convention

When organizing sounds, use this naming pattern:
- `[category]_[action]_[variation].ogg`
- Examples:
  - `pistol_shot_01.ogg`
  - `rifle_reload_heavy.ogg`
  - `grenade_bounce_concrete.ogg`
  - `impact_metal_sharp.ogg`

## Tips for Organization

1. **Create multiple variations** of the same sound (shot_01, shot_02, etc.) to avoid repetition
2. **Convert to OGG format** for better web compression if needed
3. **Keep file sizes small** - aim for under 100KB per sound
4. **Test volume levels** - normalize all sounds to similar volumes

## Next Steps

After organizing your sounds:
1. Implement the AudioManager class (see AudioManager.ts)
2. Load sounds on game initialization
3. Test each weapon and impact sound
4. Adjust volume levels and add variations

## License

FilmCow sounds are completely royalty-free for commercial and personal use.
No attribution required, but always appreciated! 