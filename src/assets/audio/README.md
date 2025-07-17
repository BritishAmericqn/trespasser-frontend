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
│   ├── pistol/
│   │   ├── shots/          # pistol_shot_01.ogg, pistol_shot_02.ogg, etc.
│   │   ├── reload/         # pistol_reload.ogg, magazine_insert.ogg
│   │   └── shells/         # shell_drop_concrete.ogg, shell_drop_metal.ogg
│   ├── rifle/
│   │   ├── shots/          # rifle_single.ogg, rifle_auto_burst.ogg
│   │   ├── reload/         # rifle_reload.ogg, bolt_action.ogg
│   │   └── shells/         # rifle_shell_drop.ogg
│   ├── rocketlauncher/
│   │   ├── launch/         # rocket_launch.ogg, rocket_whoosh.ogg
│   │   ├── explosion/      # rocket_explode.ogg, large_explosion.ogg
│   │   └── reload/         # rocket_reload.ogg, heavy_click.ogg
│   └── grenade/
│       ├── pin/            # pin_pull.ogg
│       ├── throw/          # grenade_throw.ogg
│       ├── bounce/         # grenade_bounce_concrete.ogg, grenade_bounce_metal.ogg
│       └── explosion/      # grenade_explode.ogg, frag_explosion.ogg
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

### Weapons
- **Pistol**: Look for sharp, quick gunshot sounds
- **Rifle**: Look for automatic weapon sounds, burst fire
- **Rocket Launcher**: Look for explosion sounds, whoosh sounds
- **Grenade**: Look for metal impact, explosion sounds

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