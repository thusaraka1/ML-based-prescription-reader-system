import { useState, useEffect } from 'react';
import { Upload, Camera, X, FileText, Sparkles, Loader, CheckCircle, AlertTriangle, Pill, Cpu, Brain, Zap } from 'lucide-react';
import { OCREngine } from '../models/OCREngine';
import { NLPEngine, NLPResult } from '../models/NLPEngine';
import { Medication } from '../models/Medication';
import { checkDonutHealth, DonutHealthStatus, analyzePrescriptionWithDonut } from '../ml/nlp/donutService';
import { modelAccuracyTracker } from '../ml/ensemble/ModelAccuracyTracker';

interface PrescriptionUploadProps {
  residentName: string;
  residentId?: string;
  onUpload: (doctorName: string, imageFile: File | null, medications?: Medication[]) => Promise<void> | void;
  onClose: () => void;
}

type ProcessingStep = 'idle' | 'preprocessing' | 'ocr' | 'ensemble' | 'nlp' | 'verification' | 'complete' | 'error';

export function PrescriptionUpload({ residentName, residentId, onUpload, onClose }: PrescriptionUploadProps) {
  const [doctorName, setDoctorName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'camera'>('file');
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [nlpResult, setNlpResult] = useState<NLPResult | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [error, setError] = useState('');
  const [donutStatus, setDonutStatus] = useState<DonutHealthStatus | null>(null);

  // Check Donut backend on mount
  useEffect(() => {
    checkDonutHealth().then(setDonutStatus);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setNlpResult(null);
      setExtractedText('');
      setError('');
      setStep('idle');
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim()) return;

    setProcessing(true);
    setError('');
    setNlpResult(null);

    try {
      const freshDonutStatus = await checkDonutHealth(true);
      setDonutStatus(freshDonutStatus);
      const donutAvailable = freshDonutStatus.status === 'ok';

      // Step 1: Preprocessing
      setStep('preprocessing');
      await new Promise(r => setTimeout(r, 300)); // Brief UI delay

      // 🚀 KEY FIX: Start Donut prediction IMMEDIATELY (in parallel with OCR)
      // Donut takes ~100s on CPU — starting it now means it runs concurrently
      // instead of waiting for OCR to finish first (which was adding 60s+ of serial delay)
      let donutPromise: Promise<any> | undefined;
      if (donutAvailable && selectedFile) {
        console.log('[Upload] ⚡ Starting Donut prediction early (parallel with OCR)');
        donutPromise = analyzePrescriptionWithDonut(selectedFile).catch(err => {
          console.warn('[Upload] Pre-started Donut failed (non-fatal):', err);
          return null;
        });
      }

      // Step 2: OCR — extract text from image
      // When Donut is available, OCREngine skips Gemini Vision (fast path)
      setStep('ocr');
      const ocrEngine = new OCREngine('2.5.1');
      const imageSource = selectedFile || preview || '';
      const ocrResult = await ocrEngine.extractText(imageSource);

      if (!ocrResult.text || ocrResult.text.length < 5) {
        if (!donutAvailable) {
          throw new Error('Could not extract text from the image. Please try a clearer photo.');
        }
        console.log('[Upload] OCR returned minimal text, but Donut backend is available — proceeding with ensemble');
      }

      setExtractedText(ocrResult.text);

      // Step 3: NLP + Ensemble — parse medications
      // Pass the pre-started donutPromise so ensemble reuses it (no duplicate call)
      setStep(donutAvailable ? 'ensemble' : 'nlp');
      const nlpEngine = new NLPEngine('3.1.0');
      const result = await nlpEngine.parseTextToMedication(
        ocrResult.text,
        preview || undefined,
        selectedFile || preview || undefined,
        donutPromise
      );

      // Step 4: Verification step
      if (result.geminiVerified) {
        setStep('verification');
        await new Promise(r => setTimeout(r, 500));
      }

      setNlpResult(result);
      setStep('complete');

    } catch (err) {
      console.error('Prescription processing error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Processing failed.';
      // Show helpful context based on error type
      if (errorMsg.includes('404') || errorMsg.includes('Generative Language')) {
        setError('Gemini API not enabled. Go to Google Cloud Console → APIs & Services → Enable "Generative Language API", then retry.');
      } else if (errorMsg.includes('429') || errorMsg.includes('quota')) {
        setError('API rate limit reached. Please wait 1 minute and try again.');
      } else if (errorMsg.toLowerCase().includes('timeout') || errorMsg.includes('503') || errorMsg.toLowerCase().includes('overloaded')) {
        setError('AI service is temporarily overloaded. Please retry in a few moments.');
      } else if (errorMsg.includes('VITE_GEMINI_API_KEY')) {
        setError('No Gemini API key configured. Add VITE_GEMINI_API_KEY to your .env file.');
      } else {
        setError(errorMsg);
      }
      setStep('error');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    // Track accuracy: user confirmed = all models were correct
    if (nlpResult?.ensemble) {
      modelAccuracyTracker.confirmPrediction(`pred-${Date.now()}`);
    }

    setProcessing(true);
    setError('');
    try {
      if (nlpResult) {
        await onUpload(doctorName, selectedFile, nlpResult.medications);
      } else {
        await onUpload(doctorName, selectedFile);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save prescription.';
      setError(msg);
      setStep('error');
    } finally {
      setProcessing(false);
    }
  };

  const getStepStatus = (targetStep: ProcessingStep) => {
    const order: ProcessingStep[] = ['preprocessing', 'ocr', 'ensemble', 'nlp', 'verification', 'complete'];
    const currentIdx = order.indexOf(step);
    const targetIdx = order.indexOf(targetStep);

    if (step === 'error') return 'error';
    if (currentIdx > targetIdx) return 'done';
    if (currentIdx === targetIdx) return 'active';
    return 'pending';
  };

  const isEnsembleMode = donutStatus?.status === 'ok';

  // Build processing steps based on mode
  const processingSteps = [
    { key: 'preprocessing' as ProcessingStep, label: 'Preprocessing Image', icon: '🖼️' },
    { key: 'ocr' as ProcessingStep, label: 'OCR Text Extraction', icon: '🔍' },
    ...(isEnsembleMode
      ? [{ key: 'ensemble' as ProcessingStep, label: 'Ensemble AI Analysis (Donut + Regex + Gemini)', icon: '🧠' }]
      : [{ key: 'nlp' as ProcessingStep, label: 'NLP Medication Parsing', icon: '💊' }]
    ),
    { key: 'verification' as ProcessingStep, label: 'AI Verification', icon: '✅' },
  ];

  const progressOrder: ProcessingStep[] = processingSteps.map(s => s.key);
  const currentProgressIndex = progressOrder.indexOf(step);
  const doneSteps = processingSteps.filter(s => getStepStatus(s.key) === 'done').length;
  const progressPercent = step === 'complete'
    ? 100
    : step === 'error'
      ? Math.round((doneSteps / processingSteps.length) * 100)
      : currentProgressIndex >= 0
        ? Math.round(((currentProgressIndex + 1) / processingSteps.length) * 100)
        : 0;

  const activeStepLabel = processingSteps.find(s => getStepStatus(s.key) === 'active')?.label
    || (step === 'complete' ? 'Completed' : null);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Upload Prescription</h3>
            <p className="text-sm text-gray-600">For {residentName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Doctor Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prescribing Doctor's Name
            </label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. John Smith"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={processing || step === 'complete'}
            />
          </div>

          {/* Upload Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Upload Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUploadMethod('file')}
                disabled={processing}
                className={`p-4 rounded-xl border-2 transition-all ${
                  uploadMethod === 'file'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Upload className="w-6 h-6 mx-auto mb-2" />
                <p className="font-medium text-sm">Upload File</p>
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('camera')}
                disabled={processing}
                className={`p-4 rounded-xl border-2 transition-all ${
                  uploadMethod === 'camera'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Camera className="w-6 h-6 mx-auto mb-2" />
                <p className="font-medium text-sm">Take Photo</p>
              </button>
            </div>
          </div>

          {/* File Upload Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
            {preview ? (
              <div className="space-y-4">
                <img src={preview} alt="Prescription preview" className="max-h-64 mx-auto rounded-lg shadow-md" />
                <p className="text-sm text-gray-600">{selectedFile?.name}</p>
                {!processing && step !== 'complete' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                      setNlpResult(null);
                      setExtractedText('');
                      setStep('idle');
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  capture={uploadMethod === 'camera' ? 'environment' : undefined}
                />
                {uploadMethod === 'file' ? (
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                ) : (
                  <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                )}
                <p className="text-gray-700 font-medium mb-1">
                  {uploadMethod === 'file' ? 'Click to upload' : 'Click to take photo'}
                </p>
                <p className="text-sm text-gray-500">
                  PNG, JPG up to 10MB
                </p>
              </label>
            )}
          </div>

          {/* Backend Status Indicator */}
          {step === 'idle' && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${
              isEnsembleMode
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {isEnsembleMode ? (
                <>
                  <Zap className="w-4 h-4" />
                  <span className="font-medium">Ensemble Mode Active</span>
                  <span className="text-purple-500">— Donut ({donutStatus?.device}) + Regex + Gemini</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>Standard Mode — Regex + Gemini</span>
                  <span className="text-gray-400 text-xs">(Start Donut server for ensemble)</span>
                </>
              )}
            </div>
          )}

          {/* Processing Steps Indicator */}
          {step !== 'idle' && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-800">
                    {isEnsembleMode ? '🧠 Ensemble AI Pipeline' : 'AI Processing Pipeline'}
                  </h4>
                  <span className="text-xs font-semibold text-gray-600">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      step === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-emerald-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {activeStepLabel && (
                  <p className="text-xs text-gray-500 mt-2">
                    Current stage: {activeStepLabel}
                  </p>
                )}
              </div>
              {processingSteps.map(({ key, label, icon }) => {
                const status = getStepStatus(key);
                return (
                  <div key={key} className="flex items-center gap-3">
                    {status === 'done' && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />}
                    {status === 'active' && <Loader className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />}
                    {status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />}
                    {status === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />}
                    <span className={`text-sm ${
                      status === 'active' ? 'text-blue-700 font-medium' :
                      status === 'done' ? 'text-green-700' :
                      status === 'error' ? 'text-red-700' :
                      'text-gray-400'
                    }`}>
                      {icon} {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Processing Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Extracted Text Display */}
          {extractedText && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-medium text-blue-900 mb-2">📄 Extracted Text</h4>
              <pre className="text-sm text-blue-800 whitespace-pre-wrap font-mono bg-white rounded-lg p-3 border border-blue-100 max-h-40 overflow-y-auto">
                {extractedText}
              </pre>
            </div>
          )}

          {/* Extracted Medications Display */}
          {nlpResult && nlpResult.medications.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-green-900">💊 Extracted Medications</h4>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  nlpResult.source === 'ensemble'
                    ? 'bg-purple-200 text-purple-800'
                    : nlpResult.geminiVerified
                      ? 'bg-green-200 text-green-800'
                      : 'bg-gray-200 text-gray-700'
                }`}>
                  {nlpResult.source === 'ensemble'
                    ? '🧠 Ensemble Verified'
                    : nlpResult.geminiVerified
                      ? '✨ AI Verified'
                      : 'Local Parse'}
                </span>
              </div>
              <div className="space-y-2">
                {nlpResult.medications.map((med, idx) => {
                  const medSource = nlpResult.ensemble?.medicationSources.find(
                    m => m.drugName.toLowerCase() === med.drugName.toLowerCase()
                  );

                  return (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-green-100">
                      <div className="flex items-center gap-3">
                        <Pill className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{med.drugName}</p>
                          <p className="text-xs text-gray-600">{med.dosage} — {med.frequency}</p>
                        </div>
                        {medSource && (
                          <div className="text-xs text-gray-500">
                            {(medSource.confidence * 100).toFixed(0)}%
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {nlpResult.corrections.length > 0 && (
                <div className="mt-3 text-xs text-green-700">
                  <p className="font-medium">AI Corrections:</p>
                  {nlpResult.corrections.map((c, i) => (
                    <p key={i}>• {c}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State Fallback (If all AI models fail) */}
          {step === 'complete' && nlpResult && nlpResult.medications.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
               <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
               <div>
                  <h4 className="font-medium text-amber-900 mb-1">No Medications Extracted</h4>
                  <p className="text-sm text-amber-800">
                     The Ensemble AI completed its pipeline but could not confidently identify any medications. This typically happens because:
                  </p>
                  <ul className="text-sm text-amber-800 list-disc list-inside mt-2 space-y-1">
                     <li>The image is purely a placeholder or too blurry.</li>
                     <li>The free Gemini API reached its rate limit (HTTP 429).</li>
                     <li>The handwriting is entirely unrecognizable.</li>
                  </ul>
                  <p className="text-sm text-amber-800 mt-2 font-medium">Wait a few seconds and try confirming the upload again.</p>
               </div>
            </div>
          )}

          {/* AI Info Banner */}
          {step === 'idle' && (
            <div className={`border rounded-xl p-4 ${
              isEnsembleMode
                ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
                : 'bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-3">
                {isEnsembleMode ? (
                  <Brain className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">
                    {isEnsembleMode ? 'Ensemble AI Processing' : 'AI-Powered Processing'}
                  </h4>
                  <p className="text-sm text-gray-700">
                    {isEnsembleMode
                      ? 'Upload a prescription photo and our ensemble system will run 3 AI models in parallel — your custom Donut model, local regex parser, and Gemini AI. Results are merged via confidence voting for maximum accuracy.'
                      : 'Upload a prescription photo and our AI will automatically extract the text, identify medications, dosages, and frequencies. Results are verified by Gemini AI.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              disabled={processing}
            >
              Cancel
            </button>

            {step === 'complete' ? (
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-medium hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Confirm & Save
              </button>
            ) : (
              <button
                type="submit"
                disabled={processing || !doctorName.trim() || !selectedFile}
                className={`flex-1 px-6 py-3 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  isEnsembleMode
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                }`}
              >
                {processing ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {isEnsembleMode ? <Brain className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                    {isEnsembleMode ? 'Analyze with Ensemble AI' : 'Process with AI'}
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
