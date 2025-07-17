/**
 * AudioManager - Handles all audio for the game
 * Supports realistic weapon sounds, spatial audio, and sound variations
 */

interface AudioConfig {
  volume: number;
  loop: boolean;
  pitch?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export class AudioManager {
  private audioContext: AudioContext;
  private sounds: Map<string, AudioBuffer[]> = new Map();
  private activeSources: AudioBufferSourceNode[] = [];
  private masterVolume: number = 1.0;
  private sfxVolume: number = 0.8;
  private musicVolume: number = 0.5;
  private isInitialized: boolean = false;

  constructor() {
    // Initialize AudioContext (will be created on first user interaction)
    this.audioContext = null as any;
  }

  /**
   * Initialize the audio system (call after user interaction)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      console.log('AudioManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
    }
  }

  /**
   * Load a single audio file
   */
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.isInitialized) {
      console.warn('AudioManager not initialized. Call initialize() first.');
      return;
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.sounds.set(name, [audioBuffer]);
      console.log(`Loaded sound: ${name}`);
    } catch (error) {
      console.error(`Failed to load sound ${name}:`, error);
    }
  }

  /**
   * Load multiple variations of a sound for realism
   */
  async loadSoundVariations(baseName: string, urls: string[]): Promise<void> {
    if (!this.isInitialized) {
      console.warn('AudioManager not initialized. Call initialize() first.');
      return;
    }

    const variations: AudioBuffer[] = [];

    for (let i = 0; i < urls.length; i++) {
      try {
        const response = await fetch(urls[i]);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        variations.push(audioBuffer);
      } catch (error) {
        console.error(`Failed to load sound variation ${urls[i]}:`, error);
      }
    }

    if (variations.length > 0) {
      this.sounds.set(baseName, variations);
      console.log(`Loaded ${variations.length} variations for: ${baseName}`);
    }
  }

  /**
   * Check if a file exists before trying to load it
   */
  private async fileExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Load a sound only if the file exists
   */
  async loadSoundIfExists(name: string, url: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    const exists = await this.fileExists(url);
    if (exists) {
      await this.loadSound(name, url);
      return true;
    } else {
      console.log(`⚠️  Sound file not found: ${url.split('/').pop()}`);
      return false;
    }
  }

  /**
   * Load sound variations only if files exist
   */
  async loadSoundVariationsIfExist(baseName: string, urls: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    const existingUrls: string[] = [];
    for (const url of urls) {
      const exists = await this.fileExists(url);
      if (exists) {
        existingUrls.push(url);
      }
    }

    if (existingUrls.length > 0) {
      await this.loadSoundVariations(baseName, existingUrls);
      console.log(`✅ Loaded ${existingUrls.length} variations for: ${baseName}`);
      return true;
    } else {
      console.log(`⚠️  No sound files found for: ${baseName}`);
      return false;
    }
  }

  /**
   * Load all game audio assets (only if they exist)
   */
  async loadAllSounds(): Promise<void> {
    console.log('🔍 Checking for audio files...');
    
    // Skip file loading completely for now - just use synthetic sounds
    console.log('📂 Skipping file loading - audio files not yet added');
    console.log('🎵 Using synthetic sounds only');
    console.log('💡 To add real sounds: Download FilmCow library and add files to /src/assets/audio/');
    
    // TODO: Uncomment this when you've added actual audio files
    /*
    const loadPromises = [
      // When you add audio files, uncomment these:
      this.loadSoundIfExists('ui_click', '/src/assets/audio/ui/buttons/button_click.ogg'),
      this.loadSoundIfExists('pistol_shot', '/src/assets/audio/weapons/pistol/shots/pistol_shot_01.ogg'),
      // ... etc
    ];
    
    const results = await Promise.all(loadPromises);
    const loadedCount = results.filter(Boolean).length;
    console.log(`✅ Loaded ${loadedCount} real audio files`);
    */
  }

  /**
   * Play a sound with optional configuration
   */
  playSound(soundName: string, config: Partial<AudioConfig> = {}): AudioBufferSourceNode | null {
    if (!this.isInitialized || !this.sounds.has(soundName)) {
      console.warn(`Sound not found or AudioManager not initialized: ${soundName}`);
      return null;
    }

    const variations = this.sounds.get(soundName)!;
    const audioBuffer = variations[Math.floor(Math.random() * variations.length)];

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();

    // Configure audio source
    source.buffer = audioBuffer;
    source.loop = config.loop || false;
    
    // Add slight pitch variation for realism (unless specified)
    if (config.pitch !== undefined) {
      source.playbackRate.value = config.pitch;
    } else {
      source.playbackRate.value = 0.95 + (Math.random() * 0.1); // ±5% pitch variation
    }

    // Configure volume
    const finalVolume = (config.volume || 1.0) * this.sfxVolume * this.masterVolume;
    gainNode.gain.value = finalVolume;

    // Connect audio graph
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Handle fade in
    if (config.fadeIn) {
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(finalVolume, this.audioContext.currentTime + config.fadeIn);
    }

    // Start playback
    source.start();

    // Clean up when finished
    source.onended = () => {
      const index = this.activeSources.indexOf(source);
      if (index > -1) {
        this.activeSources.splice(index, 1);
      }
    };

    this.activeSources.push(source);
    return source;
  }

  /**
   * Weapon-specific helper methods
   */
  playWeaponSound(weapon: string, action: string, config?: Partial<AudioConfig>): boolean {
    const soundName = `${weapon}_${action}`;
    return this.playSound(soundName, config) !== null;
  }

  playImpactSound(material: string, config?: Partial<AudioConfig>): boolean {
    const soundName = `impact_${material}`;
    return this.playSound(soundName, config) !== null;
  }

  /**
   * Play a sound and return whether it was successful
   */
  playSoundIfAvailable(soundName: string, config?: Partial<AudioConfig>): boolean {
    return this.playSound(soundName, config) !== null;
  }

  /**
   * Play shell casing drop with delay (realistic timing)
   */
  playShellDrop(delay: number = 0.2): void {
    setTimeout(() => {
      this.playSound('shell_drop', { volume: 0.6 });
    }, delay * 1000);
  }

  /**
   * Volume controls
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Stop all currently playing sounds
   */
  stopAllSounds(): void {
    this.activeSources.forEach(source => {
      try {
        source.stop();
      } catch (error) {
        // Ignore errors from already stopped sources
      }
    });
    this.activeSources = [];
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopAllSounds();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

// Export singleton instance
export const audioManager = new AudioManager(); 