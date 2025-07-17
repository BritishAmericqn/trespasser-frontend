# 🎵 Audio Quick Start Guide

## 🚀 Get Audio Working in 5 Minutes

### Step 1: Download FilmCow Sound Library
1. Go to: **https://filmcow.itch.io/filmcow-sfx**
2. Click "Download Now" (it's free!)
3. Download both ZIP files:
   - `FilmCow Recorded SFX.zip` (865 MB)
   - `FilmCow Designed SFX.zip` (234 MB)

### Step 2: Extract and Find Some Basic Sounds
You don't need to organize everything perfectly right away. Just find these essential sounds first:

**Look for these types of files in the downloaded folders:**
- Any gunshot/bang sounds → rename to `pistol_shot_01.ogg`
- Any click/tap sounds → rename to `ui_click.ogg`
- Any metal impact sounds → rename to `impact_metal_01.ogg`
- Any explosion sounds → rename to `grenade_explode.ogg`

**Put them in these locations:**
```
src/assets/audio/weapons/pistol/shots/pistol_shot_01.ogg
src/assets/audio/ui/buttons/ui_click.ogg
src/assets/audio/impacts/metal/impact_metal_01.ogg
src/assets/audio/weapons/grenade/explosion/grenade_explode.ogg
```

### Step 3: Initialize Audio in Your Game
Add this to your main game initialization (probably in `GameScene.ts`):

```typescript
// Add to imports
import { initializeGameAudio } from '../systems/AudioIntegration';

// Add to your scene initialization
async init() {
  // ... your existing code ...
  
  // Initialize audio after user interaction
  await initializeGameAudio();
}
```

### Step 4: Test with a Simple Sound
Add this to test audio is working:

```typescript
// Add to imports
import { audioManager } from '../systems/AudioManager';

// Test in browser console or add to a button click:
audioManager.playSound('ui_click');
```

### Step 5: Add Weapon Sounds
In your weapon firing code, add:

```typescript
// Add to imports
import { fireWeapon } from '../systems/AudioIntegration';

// In your weapon firing logic:
fireWeapon('pistol'); // or 'rifle', 'rocketlauncher'
```

## 🎯 Quick File Mapping

Here's what to search for in the FilmCow library:

| Game Need | Search Terms in FilmCow | Save As |
|-----------|------------------------|---------|
| Pistol shot | "gun", "shot", "bang", "pop" | `pistol_shot_01.ogg` |
| UI click | "click", "tap", "button" | `ui_click.ogg` |
| Metal impact | "metal", "clang", "hit" | `impact_metal_01.ogg` |
| Explosion | "explosion", "boom", "blast" | `grenade_explode.ogg` |
| Footsteps | "step", "walk", "tap" | `footstep_01.ogg` |

## 🔧 Troubleshooting

**"No sound playing"**
- Check browser console for errors
- Make sure audio was initialized after user interaction (click/key press)
- Verify file paths are correct

**"AudioContext suspended"**
- Call `audioManager.initialize()` after a user click/interaction
- This is required by browser autoplay policies

**"File not found"**
- Check file paths match exactly
- Make sure files are in `/src/assets/audio/` folders
- Verify file extensions are `.ogg` (convert if needed)

## 🎉 Once Working

After you have basic sounds working:

1. **Add more variations** - find 2-3 different gunshot sounds for variety
2. **Organize by weapon** - separate pistol, rifle, rocket launcher sounds
3. **Add reload sounds** - mechanical clicking/sliding sounds
4. **Add impact variety** - different sounds for concrete, metal, wood
5. **Balance volumes** - adjust volume levels in the code

## 🎵 File Conversion (if needed)

If your sounds aren't in OGG format:
- Use **Audacity** (free) to convert
- File → Export → Export as OGG

Recommended settings:
- **Quality**: 5-7 (good balance of size/quality)
- **Sample Rate**: 44100 Hz
- **Channels**: Mono (for most SFX)

## 📝 Next Steps

Once basic audio is working:
1. Read the full `src/assets/audio/README.md` for complete organization
2. Add more sound variations to avoid repetition
3. Implement spatial audio (sounds from different directions)
4. Add volume controls to your settings menu
5. Add background music/ambient sounds

**The goal is to get SOME audio working quickly, then improve it over time!** 