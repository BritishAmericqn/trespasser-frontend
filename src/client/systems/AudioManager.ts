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

interface WeaponAudioConfig {
  volume: number;           // Overall volume (0-1)
  baseFrequency: number;    // Starting frequency in Hz
  frequencyDecay: number;   // Ending frequency in Hz
  duration: number;         // Sound duration in seconds
  waveType: OscillatorType; // 'sine', 'square', 'sawtooth', 'triangle'
  filterFreq: number;       // Filter starting frequency
  filterDecay: number;      // Filter ending frequency
  filterType: BiquadFilterType; // 'lowpass', 'highpass', 'bandpass'
  attack: number;           // Attack time in seconds
  release: number;          // Release time in seconds
  noise: number;            // Noise level (0-1)
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

  /**
   * Play synthetic weapon sound with optional custom modifications
   */
  playSyntheticWeaponSound(weaponType: string, modifications?: {
    volume?: number;      // Multiply base volume (1.0 = normal, 0.5 = half, 2.0 = double)
    pitch?: number;       // Multiply base frequency (1.0 = normal, 2.0 = octave up, 0.5 = octave down)
    duration?: number;    // Multiply base duration (1.0 = normal, 0.5 = half length)
    muffled?: boolean;    // Apply muffled effect (lower frequency, more filtering)
    distant?: boolean;    // Apply distance effect (lower volume, more filtering)
  }): void {
    if (!this.isInitialized) return;

    let config: Partial<WeaponAudioConfig> = {};

    if (modifications) {
      const baseConfig = this.getWeaponAudioConfig(weaponType);
      
      if (modifications.volume !== undefined) {
        config.volume = baseConfig.volume * modifications.volume;
      }
      
      if (modifications.pitch !== undefined) {
        config.baseFrequency = baseConfig.baseFrequency * modifications.pitch;
        config.frequencyDecay = baseConfig.frequencyDecay * modifications.pitch;
      }
      
      if (modifications.duration !== undefined) {
        config.duration = baseConfig.duration * modifications.duration;
      }
      
      if (modifications.muffled) {
        config.filterFreq = (baseConfig.filterFreq || 2000) * 0.3;
        config.filterDecay = (baseConfig.filterDecay || 500) * 0.3;
        config.volume = (config.volume || baseConfig.volume) * 0.6;
        config.noise = (baseConfig.noise || 0.3) * 0.5;
      }
      
      if (modifications.distant) {
        config.volume = (config.volume || baseConfig.volume) * 0.3;
        config.filterFreq = (baseConfig.filterFreq || 2000) * 0.5;
        config.filterDecay = (baseConfig.filterDecay || 500) * 0.5;
      }
    }

    this.generateWeaponSound(weaponType, config);
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
   * Synthetic weapon sound generator with customizable properties
   */
  generateWeaponSound(weaponType: string, config?: Partial<WeaponAudioConfig>): void {
    if (!this.isInitialized || !this.audioContext) {
      console.warn('AudioManager not initialized - cannot generate weapon sound');
      return;
    }

    const weaponConfig = this.getWeaponAudioConfig(weaponType, config);
    this.playComplexWeaponSound(weaponConfig);
  }

  private getWeaponAudioConfig(weaponType: string, override?: Partial<WeaponAudioConfig>): WeaponAudioConfig {
    const defaults: { [key: string]: WeaponAudioConfig } = {
      // High-pitched, short, crisp
      pistol: {
        volume: 0.4,
        baseFrequency: 1200,
        frequencyDecay: 400,
        duration: 0.12,
        waveType: 'square',
        filterFreq: 3000,
        filterDecay: 800,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.08,
        noise: 0.3
      },

      // Suppressed - muffled, low volume
      suppressedpistol: {
        volume: 0.15,
        baseFrequency: 400,
        frequencyDecay: 150,
        duration: 0.08,
        waveType: 'sine',
        filterFreq: 800,
        filterDecay: 200,
        filterType: 'lowpass',
        attack: 0.002,
        release: 0.05,
        noise: 0.1
      },

      // Deep, powerful revolver
      revolver: {
        volume: 0.6,
        baseFrequency: 800,
        frequencyDecay: 200,
        duration: 0.25,
        waveType: 'square',
        filterFreq: 2500,
        filterDecay: 600,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.15,
        noise: 0.4
      },

      // Rapid, medium pitch
      rifle: {
        volume: 0.5,
        baseFrequency: 1000,
        frequencyDecay: 300,
        duration: 0.15,
        waveType: 'sawtooth',
        filterFreq: 2800,
        filterDecay: 700,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.1,
        noise: 0.35
      },

      // Higher pitch, faster
      smg: {
        volume: 0.35,
        baseFrequency: 1400,
        frequencyDecay: 500,
        duration: 0.08,
        waveType: 'square',
        filterFreq: 3500,
        filterDecay: 1000,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.05,
        noise: 0.25
      },

      // Wide, booming shotgun
      shotgun: {
        volume: 0.7,
        baseFrequency: 600,
        frequencyDecay: 150,
        duration: 0.3,
        waveType: 'square',
        filterFreq: 1800,
        filterDecay: 400,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.2,
        noise: 0.6
      },

      // Heavy, deep machine gun
      machinegun: {
        volume: 0.5,
        baseFrequency: 900,
        frequencyDecay: 250,
        duration: 0.12,
        waveType: 'sawtooth',
        filterFreq: 2200,
        filterDecay: 500,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.08,
        noise: 0.4
      },

      // Very deep, powerful sniper
      sniperrifle: {
        volume: 0.8,
        baseFrequency: 700,
        frequencyDecay: 180,
        duration: 0.4,
        waveType: 'square',
        filterFreq: 2000,
        filterDecay: 400,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.25,
        noise: 0.5
      },

      // Ultra-powerful anti-material
      antimaterialrifle: {
        volume: 0.9,
        baseFrequency: 500,
        frequencyDecay: 120,
        duration: 0.5,
        waveType: 'square',
        filterFreq: 1500,
        filterDecay: 300,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.35,
        noise: 0.7
      },

      // Powerful battle rifle
      battlerifle: {
        volume: 0.6,
        baseFrequency: 850,
        frequencyDecay: 220,
        duration: 0.18,
        waveType: 'sawtooth',
        filterFreq: 2400,
        filterDecay: 550,
        filterType: 'lowpass',
        attack: 0.001,
        release: 0.12,
        noise: 0.4
      }
    };

    const baseConfig = defaults[weaponType] || defaults.rifle;
    return { ...baseConfig, ...override };
  }

  private playComplexWeaponSound(config: WeaponAudioConfig): void {
    const now = this.audioContext.currentTime;
    
    // Main oscillator for the core sound
    const mainOsc = this.audioContext.createOscillator();
    const mainGain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    
    // Noise generator for texture
    const noiseBuffer = this.createNoiseBuffer(0.1);
    const noiseSource = this.audioContext.createBufferSource();
    const noiseGain = this.audioContext.createGain();
    
    // Connect main signal chain
    mainOsc.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(this.audioContext.destination);
    
    // Connect noise signal chain
    noiseSource.buffer = noiseBuffer;
    noiseSource.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);
    
    // Configure main oscillator
    mainOsc.type = config.waveType;
    mainOsc.frequency.setValueAtTime(config.baseFrequency, now);
    mainOsc.frequency.exponentialRampToValueAtTime(config.frequencyDecay, now + config.duration);
    
    // Configure filter
    filter.type = config.filterType;
    filter.frequency.setValueAtTime(config.filterFreq, now);
    filter.frequency.exponentialRampToValueAtTime(config.filterDecay, now + config.duration);
    filter.Q.setValueAtTime(1, now);
    
    // Configure main envelope
    const mainVolume = config.volume * this.sfxVolume * this.masterVolume;
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(mainVolume, now + config.attack);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);
    
    // Configure noise envelope
    const noiseVolume = config.noise * mainVolume * 0.3;
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(noiseVolume, now + config.attack);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + config.duration * 0.7);
    
    // Start and stop
    mainOsc.start(now);
    mainOsc.stop(now + config.duration);
    noiseSource.start(now);
    noiseSource.stop(now + config.duration);
    
    // Track active sources for cleanup
    this.activeSources.push(mainOsc as any);
    this.activeSources.push(noiseSource as any);
  }

  private createNoiseBuffer(duration: number): AudioBuffer {
    const sampleRate = this.audioContext.sampleRate;
    const frameCount = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < frameCount; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    return buffer;
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