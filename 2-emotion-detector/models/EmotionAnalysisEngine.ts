import { EmotionalState } from './EmotionalState';
import { FacialEmotionEngine, EmotionDetectionResult } from '../ml/emotion/FacialEmotionEngine';
import { VocalToneEngine, VocalToneResult } from '../ml/audio/VocalToneEngine';

export interface EmotionAnalysisResult {
  emotionalState: EmotionalState;
  facialResult?: EmotionDetectionResult;
  vocalResult?: VocalToneResult;
  dominantFacialEmotion?: string;
  dominantVocalTone?: string;
  processingTimeMs: number;
}

export class EmotionAnalysisEngine {
  modelVersion: string;
  private facialEngine: FacialEmotionEngine;
  private vocalEngine: VocalToneEngine;

  constructor(modelVersion: string) {
    this.modelVersion = modelVersion;
    this.facialEngine = new FacialEmotionEngine('/models/face-api');
    this.vocalEngine = new VocalToneEngine();
  }

  /**
   * Initialize both engines (lazy-loads models).
   */
  async initialize(): Promise<void> {
    await Promise.allSettled([
      this.facialEngine.initialize(),
      this.vocalEngine.initialize(),
    ]);
  }

  /**
   * Analyze facial expression from an image source.
   */
  async analyzeFacialExpression(imageSource: File | string): Promise<number> {
    console.log(`Analyzing facial expression with model v${this.modelVersion}...`);
    try {
      const result = await this.facialEngine.analyzeFromImage(imageSource);
      return result.wellnessScore;
    } catch (error) {
      console.warn('[EmotionEngine] Facial analysis failed:', error);
      return 50; // neutral fallback
    }
  }

  /**
   * Analyze facial expression from a video/canvas/image element.
   */
  async analyzeFacialElement(
    element: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ): Promise<EmotionDetectionResult> {
    await this.facialEngine.initialize();
    return this.facialEngine.analyze(element);
  }

  /**
   * Analyze vocal tone from an audio file.
   */
  async analyzeVocalTone(audioSource: File): Promise<number> {
    console.log(`Analyzing vocal tone with model v${this.modelVersion}...`);
    try {
      const result = await this.vocalEngine.analyzeFile(audioSource);
      return result.wellnessScore;
    } catch (error) {
      console.warn('[EmotionEngine] Vocal analysis failed:', error);
      return 50; // neutral fallback
    }
  }

  /**
   * Record from microphone and analyze for vocal tone.
   */
  async recordAndAnalyzeVocal(durationMs: number = 5000): Promise<VocalToneResult> {
    await this.vocalEngine.initialize();
    return this.vocalEngine.recordAndAnalyze(durationMs);
  }

  /**
   * Generate a combined emotional state from facial and vocal scores.
   */
  generateEmotionalState(facialScore: number, vocalScore: number): EmotionalState {
    const averageScore = Math.round((facialScore + vocalScore) / 2);
    return new EmotionalState(new Date(), averageScore);
  }

  /**
   * Full analysis: combine facial + vocal into a single EmotionalState.
   */
  async analyzeResident(
    facialImage?: File | string,
    vocalAudio?: File
  ): Promise<EmotionAnalysisResult> {
    const startTime = performance.now();
    let facialScore = 50;
    let vocalScore = 50;
    let facialResult: EmotionDetectionResult | undefined;
    let vocalResult: VocalToneResult | undefined;

    // Run both analyses in parallel when possible
    const tasks: Promise<void>[] = [];

    if (facialImage) {
      tasks.push(
        (async () => {
          try {
            if (facialImage instanceof File || typeof facialImage === 'string') {
              facialResult = await this.facialEngine.analyzeFromImage(facialImage);
              facialScore = facialResult.wellnessScore;
            }
          } catch (error) {
            console.warn('[EmotionEngine] Facial analysis failed:', error);
          }
        })()
      );
    }

    if (vocalAudio) {
      tasks.push(
        (async () => {
          try {
            vocalResult = await this.vocalEngine.analyzeFile(vocalAudio);
            vocalScore = vocalResult.wellnessScore;
          } catch (error) {
            console.warn('[EmotionEngine] Vocal analysis failed:', error);
          }
        })()
      );
    }

    await Promise.all(tasks);

    const emotionalState = this.generateEmotionalState(facialScore, vocalScore);
    const processingTimeMs = performance.now() - startTime;

    return {
      emotionalState,
      facialResult,
      vocalResult,
      dominantFacialEmotion: facialResult?.dominant,
      dominantVocalTone: vocalResult?.dominant,
      processingTimeMs,
    };
  }

  /**
   * Start continuous facial emotion monitoring from webcam.
   */
  startContinuousMonitoring(
    videoElement: HTMLVideoElement,
    onResult: (result: EmotionDetectionResult) => void,
    intervalMs: number = 2000
  ): () => void {
    return this.facialEngine.startContinuousDetection(videoElement, onResult, intervalMs);
  }

  /**
   * Check if engines are ready.
   */
  isReady(): { facial: boolean; vocal: boolean } {
    return {
      facial: this.facialEngine.isReady(),
      vocal: this.vocalEngine.isReady(),
    };
  }
}
