/**
 * AudioTest - Test audio system with synthetic sounds
 * Use this to verify audio is working before adding real sound files
 */

export class AudioTest {
  private audioContext: AudioContext | null = null;
  
  constructor() {
    console.log('AudioTest ready - you can test audio without files!');
  }

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      console.log('✅ AudioTest initialized successfully!');
    }
  }

  /**
   * Play a synthetic test sound
   */
  playTestSound(type: 'click' | 'shoot' | 'explosion' | 'beep' = 'click'): void {
    if (!this.audioContext) {
      console.warn('AudioTest not initialized. Call initialize() first.');
      return;
    }

    switch (type) {
      case 'click':
        this.playClick();
        break;
      case 'shoot':
        this.playShoot();
        break;
      case 'explosion':
        this.playExplosion();
        break;
      case 'beep':
        this.playBeep();
        break;
    }
  }

  private playClick(): void {
    // Short high-pitched click
    const oscillator = this.audioContext!.createOscillator();
    const gainNode = this.audioContext!.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext!.destination);
    
    oscillator.frequency.setValueAtTime(800, this.audioContext!.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext!.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext!.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(this.audioContext!.currentTime + 0.1);
  }

  private playShoot(): void {
    // Sharp gunshot-like sound
    const oscillator = this.audioContext!.createOscillator();
    const gainNode = this.audioContext!.createGain();
    const filter = this.audioContext!.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext!.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, this.audioContext!.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext!.currentTime + 0.2);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, this.audioContext!.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.audioContext!.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.5, this.audioContext!.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext!.currentTime + 0.2);
  }

  private playExplosion(): void {
    // Rumbling explosion-like sound
    const oscillator = this.audioContext!.createOscillator();
    const gainNode = this.audioContext!.createGain();
    const filter = this.audioContext!.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext!.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(80, this.audioContext!.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(20, this.audioContext!.currentTime + 0.5);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.audioContext!.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, this.audioContext!.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.7, this.audioContext!.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(this.audioContext!.currentTime + 0.5);
  }

  private playBeep(): void {
    // Simple beep tone
    const oscillator = this.audioContext!.createOscillator();
    const gainNode = this.audioContext!.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext!.destination);
    
    oscillator.frequency.setValueAtTime(440, this.audioContext!.currentTime);
    
    gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext!.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext!.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext!.currentTime + 0.2);
  }
}

// Export singleton for easy access
export const audioTest = new AudioTest(); 