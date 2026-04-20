/**
 * CRNN OCR Engine
 * Uses a pre-trained CRNN (CNN + BiLSTM + CTC) model via ONNX Runtime Web
 * for client-side prescription text extraction.
 * 
 * Architecture:
 *   Input Image → CNN Feature Extractor → Bidirectional LSTM → CTC Decoder → Text
 */

import * as ort from 'onnxruntime-web';
import { preprocessPrescriptionImage, CRNN_INPUT_HEIGHT, CRNN_INPUT_WIDTH } from './imagePreprocessor';
import { greedyDecode, beamSearchDecode, computeConfidence, CHARSET } from './ctcDecoder';

const ORT_WASM_PUBLIC_BASE = '/onnxruntime/';

export interface OCRResult {
  text: string;
  confidence: number;
  lines: OCRLineResult[];
  processingTimeMs: number;
}

export interface OCRLineResult {
  text: string;
  confidence: number;
  lineIndex: number;
  region: { y: number; h: number };
}

export class CRNNOCREngine {
  private session: ort.InferenceSession | null = null;
  private modelPath: string;
  private isLoading: boolean = false;
  private useBeamSearch: boolean;
  private static ortConfigured = false;

  constructor(modelPath: string = '/models/crnn/crnn.onnx', useBeamSearch: boolean = false) {
    this.modelPath = modelPath;
    this.useBeamSearch = useBeamSearch;
  }

  /**
   * Configure deterministic WASM asset paths for ONNX Runtime under Vite.
   * Without this, ORT can resolve to a bad URL and fetch HTML instead of WASM.
   */
  private configureOrtWasmPaths(): void {
    if (CRNNOCREngine.ortConfigured) return;

    // ORT v1.24+ expects a string prefix, not an object map
    ort.env.wasm.wasmPaths = ORT_WASM_PUBLIC_BASE;

    // Browser stability: avoid thread-related initialization issues on restricted environments.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    CRNNOCREngine.ortConfigured = true;
  }

  /**
   * Check that the CRNN model file is actually available before initializing ORT.
   */
  private async assertModelFileExists(): Promise<void> {
    const response = await fetch(this.modelPath, { method: 'HEAD' });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || contentType.includes('text/html')) {
      throw new Error(
        `CRNN model file not found at ${this.modelPath}. ` +
        'Place the ONNX model under public/models/crnn/crnn.onnx or update the model path.'
      );
    }
  }

  /**
   * Lazy-load the ONNX model. Called automatically on first inference.
   */
  async initialize(): Promise<void> {
    if (this.session || this.isLoading) return;

    this.isLoading = true;
    try {
      this.configureOrtWasmPaths();
      await this.assertModelFileExists();
      
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      console.log('[CRNN] Model loaded successfully');
      console.log('[CRNN] Input names:', this.session.inputNames);
      console.log('[CRNN] Output names:', this.session.outputNames);
    } catch (error) {
      // Silent fall-through: if CRNN fails to load (due to missing WASM or .onnx file),
      // the system will seamlessly fallback to Gemini Vision OCR automatically.
      throw new Error(`CRNN model loading failed: ${error}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Run CRNN inference on a single preprocessed line image.
   */
  private async recognizeLine(lineData: Float32Array): Promise<{ text: string; confidence: number }> {
    if (!this.session) {
      throw new Error('CRNN model not initialized. Call initialize() first.');
    }

    // Create input tensor [batch=1, channels=1, height=32, width=100]
    const inputTensor = new ort.Tensor('float32', lineData, [1, 1, CRNN_INPUT_HEIGHT, CRNN_INPUT_WIDTH]);

    // Run inference
    const inputName = this.session.inputNames[0];
    const feeds: Record<string, ort.Tensor> = { [inputName]: inputTensor };
    const results = await this.session.run(feeds);

    // Get output logits
    const outputName = this.session.outputNames[0];
    const output = results[outputName];
    const logits = output.data as Float32Array;
    const outputDims = output.dims; // [timesteps, batch, numClasses] or similar

    const timesteps = outputDims[0] as number;
    const numClasses = outputDims[outputDims.length - 1] as number;

    // Decode
    let text: string;
    let confidence: number;

    if (this.useBeamSearch) {
      const beamResults = beamSearchDecode(logits, timesteps, numClasses, 10);
      text = beamResults[0]?.text || '';
      confidence = beamResults[0]?.score || 0;
    } else {
      text = greedyDecode(logits, timesteps, numClasses);
      confidence = computeConfidence(logits, timesteps, numClasses);
    }

    return { text: text.trim(), confidence };
  }

  /**
   * Extract text from a prescription image.
   * Full pipeline: preprocess → segment lines → CRNN inference → combine.
   */
  async extractText(imageSource: File | string): Promise<OCRResult> {
    const startTime = performance.now();

    // Ensure model is loaded
    await this.initialize();

    // Preprocess: grayscale, enhance, binarize, segment lines
    const { lines: lineTensors, lineRegions } = await preprocessPrescriptionImage(imageSource);

    console.log(`[CRNN] Processing ${lineTensors.length} text line(s)...`);

    // Run CRNN on each line
    const lineResults: OCRLineResult[] = [];
    for (let i = 0; i < lineTensors.length; i++) {
      const { text, confidence } = await this.recognizeLine(lineTensors[i]);
      if (text.length > 0) {
        lineResults.push({
          text,
          confidence,
          lineIndex: i,
          region: lineRegions[i],
        });
      }
    }

    // Combine lines into full text
    const fullText = lineResults.map(l => l.text).join('\n');
    const avgConfidence = lineResults.length > 0
      ? lineResults.reduce((sum, l) => sum + l.confidence, 0) / lineResults.length
      : 0;

    const processingTimeMs = performance.now() - startTime;

    console.log(`[CRNN] OCR complete in ${processingTimeMs.toFixed(0)}ms — ${lineResults.length} lines, ${(avgConfidence * 100).toFixed(1)}% confidence`);

    return {
      text: fullText,
      confidence: avgConfidence,
      lines: lineResults,
      processingTimeMs,
    };
  }

  /**
   * Check if the model is loaded and ready.
   */
  isReady(): boolean {
    return this.session !== null;
  }

  /**
   * Release model resources.
   */
  async dispose(): Promise<void> {
    if (this.session) {
      // ONNX session cleanup
      this.session = null;
    }
  }
}
