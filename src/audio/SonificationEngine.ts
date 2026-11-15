import * as Tone from 'tone';
import { PixelTelemetry } from '../types/jukebox';
import { quantizeToNote } from '../utils/colorScience';

/**
 * Motor de sonificación simple y transparente:
 * convierte el valor térmico normalizado (0..1) en altura musical, brillo de filtro y paneo estéreo.
 */
class SimpleSonificationEngine {
  private initialized = false;
  private isPlaying = false;
  private volume = 0.8;

  private synth!: Tone.PolySynth;
  private filter!: Tone.Filter;
  private panner!: Tone.Panner;
  private reverb!: Tone.Reverb;
  private masterGain!: Tone.Gain;
  private waveform!: Tone.Waveform;

  private lastTriggerMs = 0;
  private lastNote = '';

  public async ensureStarted(): Promise<void> {
    await Tone.start();
    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume();
    }
    if (this.initialized) return;

    this.waveform = new Tone.Waveform(64);
    this.masterGain = new Tone.Gain(this.volume).toDestination();
    this.masterGain.connect(this.waveform);

    this.reverb = new Tone.Reverb({ decay: 2.2, wet: 0.28 }).connect(this.masterGain);
    this.panner = new Tone.Panner(0).connect(this.reverb);
    this.filter = new Tone.Filter({
      type: 'lowpass',
      frequency: 1800,
      rolloff: -12,
    }).connect(this.panner);

    this.synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.03,
        decay: 0.25,
        sustain: 0.2,
        release: 0.75,
      },
    }).connect(this.filter);
    this.synth.maxPolyphony = 4;

    this.initialized = true;
  }

  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    if (this.initialized && !playing) {
      this.synth.releaseAll();
    }
  }

  public setVolume(nextVolume: number): void {
    this.volume = nextVolume;
    if (this.initialized) {
      this.masterGain.gain.rampTo(nextVolume, 0.06);
    }
  }

  public processTelemetry(telemetry: PixelTelemetry, forceProbe = false): void {
    if (!this.initialized || !this.isPlaying) return;

    const now = performance.now();
    const norm = telemetry.normalizedValue;

    // Paneo estéreo (Oeste = Izquierda, Este = Derecha) y brillo según temperatura
    this.panner.pan.rampTo(telemetry.stereoPan, 0.08);
    this.filter.frequency.rampTo(600 + norm * 3200, 0.08);

    const minIntervalMs = Math.max(140, 260 - norm * 90);
    const noteChanged = telemetry.noteName !== this.lastNote;

    if (
      (forceProbe && noteChanged && now - this.lastTriggerMs > 80) ||
      now - this.lastTriggerMs >= minIntervalMs
    ) {
      const velocity = Math.min(0.85, 0.35 + norm * 0.45);
      this.synth.triggerAttackRelease(telemetry.noteName, '8n', undefined, velocity);
      this.lastNote = telemetry.noteName;
      this.lastTriggerMs = now;
    }
  }

  public async previewCalibration(normalized: number): Promise<void> {
    await this.ensureStarted();
    const { note } = quantizeToNote(normalized);
    this.panner.pan.rampTo(0, 0.04);
    this.filter.frequency.rampTo(700 + normalized * 3000, 0.04);
    this.synth.triggerAttackRelease(note, '4n', undefined, 0.72);
  }

  public getWaveform(): Float32Array {
    if (!this.initialized) return new Float32Array(64);
    return this.waveform.getValue();
  }
}

export const sonificationEngine = new SimpleSonificationEngine();
