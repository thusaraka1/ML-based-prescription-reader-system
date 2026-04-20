import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, CheckCircle2, Pill, Camera, RefreshCw, Video } from 'lucide-react';
import { Resident } from '../models/Resident';
import { Medication } from '../models/Medication';
import { FacialEmotionEngine, EmotionDetectionResult } from '../ml/emotion/FacialEmotionEngine';
import { emotionsApi } from '../services/apiService';
import { pushEmotionUpdate, pushAlert } from '../services/firestoreService';

interface EmotionLoggerModalProps {
  resident: Resident;
  onClose: () => void;
  onLogged: () => void;
}

/** Map face-api emotion keys to display info */
const EMOTION_DISPLAY: Record<string, { emoji: string; label: string; color: string; bgColor: string; borderColor: string }> = {
  happy:      { emoji: '😊', label: 'Happy',      color: 'text-emerald-700', bgColor: 'bg-emerald-50',  borderColor: 'border-emerald-300' },
  sad:        { emoji: '😢', label: 'Sad',        color: 'text-blue-700',    bgColor: 'bg-blue-50',     borderColor: 'border-blue-300' },
  angry:      { emoji: '😤', label: 'Angry',      color: 'text-red-700',     bgColor: 'bg-red-50',      borderColor: 'border-red-300' },
  fearful:    { emoji: '😰', label: 'Fearful',    color: 'text-amber-700',   bgColor: 'bg-amber-50',    borderColor: 'border-amber-300' },
  disgusted:  { emoji: '🤢', label: 'Disgusted',  color: 'text-lime-700',    bgColor: 'bg-lime-50',     borderColor: 'border-lime-300' },
  surprised:  { emoji: '😲', label: 'Surprised',  color: 'text-violet-700',  bgColor: 'bg-violet-50',   borderColor: 'border-violet-300' },
  neutral:    { emoji: '😐', label: 'Neutral',    color: 'text-gray-700',    bgColor: 'bg-gray-50',     borderColor: 'border-gray-300' },
};

function getEmotionCategory(emotion: string): 'positive' | 'neutral' | 'negative' | 'side-effect' {
  if (['happy', 'surprised'].includes(emotion)) return 'positive';
  if (['neutral'].includes(emotion)) return 'neutral';
  return 'negative';
}

type Step = 'camera' | 'analyzing' | 'result' | 'medicine' | 'submitting' | 'success' | 'error';

// Singleton engine instance to avoid re-loading models on every modal open
let sharedEngine: FacialEmotionEngine | null = null;
function getEngine(): FacialEmotionEngine {
  if (!sharedEngine) {
    sharedEngine = new FacialEmotionEngine('/models/face-api');
  }
  return sharedEngine;
}

export function EmotionLoggerModal({ resident, onClose, onLogged }: EmotionLoggerModalProps) {
  const [step, setStep] = useState<Step>('camera');
  const [animateIn, setAnimateIn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [modelLoading, setModelLoading] = useState(true);
  const [detectionResult, setDetectionResult] = useState<EmotionDetectionResult | null>(null);
  const [liveResult, setLiveResult] = useState<EmotionDetectionResult | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<Medication | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<FacialEmotionEngine>(getEngine());
  const cleanupRef = useRef<(() => void) | null>(null);

  const allMedications = resident.getAllMedications();

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
  }, []);

  // Initialize camera & face-api models
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Load face-api models
      try {
        setModelLoading(true);
        await engineRef.current.initialize();
        if (!cancelled) setModelLoading(false);
      } catch (err) {
        console.error('[EmotionLogger] Model load failed:', err);
        if (!cancelled) {
          setCameraError('Failed to load emotion detection models. Please try again.');
          setModelLoading(false);
        }
        return;
      }

      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Start live emotion preview (updates every 1s for better responsiveness)
          const stopContinuous = engineRef.current.startContinuousDetection(
            videoRef.current,
            (result) => {
              if (!cancelled) {
                setLiveResult(result);
              }
            },
            1000
          );
          cleanupRef.current = stopContinuous;
        }
      } catch (err: any) {
        console.error('[EmotionLogger] Camera error:', err);
        if (!cancelled) {
          if (err.name === 'NotAllowedError') {
            setCameraError('Camera access denied. Please allow camera access in your browser settings.');
          } else if (err.name === 'NotFoundError') {
            setCameraError('No camera found on this device.');
          } else {
            setCameraError('Could not access camera. Please try again.');
          }
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const stopCamera = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const handleCapture = () => {
    if (!liveResult || !liveResult.faceDetected) {
      setCameraError('No face detected. Please look clearly at the camera.');
      return;
    }

    setStep('analyzing');
    stopCamera();

    // Use the exact result they were seeing on screen for better consistency
    setDetectionResult(liveResult);

    // Simulate analyzing delay for better UX
    setTimeout(() => {
      setStep('result');
    }, 1500);
  };

  const handleRetake = async () => {
    setDetectionResult(null);
    setSelectedMedicine(null);
    setNote('');
    setCameraError('');
    setStep('camera');

    // Restart camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        cleanupRef.current = engineRef.current.startContinuousDetection(
          videoRef.current,
          (r) => setLiveResult(r),
          1000
        );
      }
    } catch {
      setCameraError('Could not restart camera.');
    }
  };

  const handleSubmit = async () => {
    if (!detectionResult) return;

    setStep('submitting');
    setError('');

    const emotionInfo = EMOTION_DISPLAY[detectionResult.dominant] || EMOTION_DISPLAY['neutral'];
    const category = getEmotionCategory(detectionResult.dominant);

    try {
      // 1. Save to MySQL
      await emotionsApi.record({
        residentId: resident.residentId,
        stateScore: detectionResult.wellnessScore,
        emotionLabel: emotionInfo.label,
        category,
        relatedMedicine: selectedMedicine?.drugName || null,
        note: note.trim() || null,
      });

      // 2. Push real-time update to Firestore (caretaker sees this live)
      // We run these in the background so they don't block UI if Firestore hangs
      Promise.all([
        pushEmotionUpdate({
          residentId: resident.residentId,
          residentName: resident.name,
          stateScore: detectionResult.wellnessScore,
          emotionalLevel: emotionInfo.label,
        }),
        ...(category === 'negative' ? [
          pushAlert({
            type: 'wellness',
            severity: detectionResult.wellnessScore <= 20 ? 'high' : 'medium',
            message: `${resident.name} is feeling ${emotionInfo.label}${selectedMedicine ? ` (may be related to ${selectedMedicine.drugName})` : ''}. Wellness: ${detectionResult.wellnessScore}/100`,
            residentId: resident.residentId,
            residentName: resident.name,
            targetRoles: ['caretaker', 'admin'],
            acknowledged: false,
          })
        ] : []),
      ]).catch(e => console.warn('[EmotionLogger] Optional Firestore update failed:', e));

      setStep('success');
      setTimeout(() => {
        onLogged();
        onClose();
      }, 2500);
    } catch (err) {
      console.error('[EmotionLogger] Submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save. Try again.');
      setStep('result');
    }
  };

  const emotionInfo = detectionResult
    ? (EMOTION_DISPLAY[detectionResult.dominant] || EMOTION_DISPLAY['neutral'])
    : null;

  const liveEmotionInfo = (liveResult && liveResult.faceDetected) 
    ? EMOTION_DISPLAY[liveResult.dominant] 
    : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-all duration-300 ${
        animateIn ? 'bg-black/60 backdrop-blur-sm' : 'bg-transparent'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget && step !== 'submitting' && step !== 'analyzing') {
          stopCamera();
          onClose();
        }
      }}
    >
      <div
        className={`bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden transition-all duration-500 ease-out ${
          animateIn
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-full sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
        style={{ maxHeight: '95vh' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 text-white px-5 py-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
          <div className="relative z-10">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Emotion Detection
            </h3>
            <p className="text-xs text-purple-200 mt-0.5">
              {step === 'camera' && 'Look at the camera — we\'ll detect how you feel'}
              {step === 'analyzing' && 'Analyzing your expression...'}
              {step === 'result' && 'Here\'s what we detected'}
              {step === 'medicine' && 'Is this related to a medicine?'}
              {step === 'submitting' && 'Sending to your caretaker...'}
              {step === 'success' && 'Your caretaker has been notified!'}
              {step === 'error' && 'Something went wrong'}
            </p>
          </div>
          {!['submitting', 'analyzing', 'success'].includes(step) && (
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="relative z-10 p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(95vh - 72px)' }}>

          {/* ── Camera View ── */}
          {step === 'camera' && (
            <div className="p-4 space-y-4">
              {cameraError ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                  <Camera className="w-12 h-12 mx-auto mb-3 text-red-300" />
                  <p className="text-sm text-red-700 font-medium">{cameraError}</p>
                  <button
                    onClick={handleRetake}
                    className="mt-4 px-6 py-2 bg-red-100 text-red-700 rounded-xl text-sm font-medium
                      active:scale-95 transition-transform"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  {/* Video container */}
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover mirror"
                      style={{ transform: 'scaleX(-1)' }}
                    />

                    {/* Loading overlay */}
                    {modelLoading && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
                        <Loader2 className="w-10 h-10 text-white animate-spin mb-3" />
                        <p className="text-white text-sm font-medium">Loading AI models...</p>
                        <p className="text-white/60 text-xs mt-1">This may take a moment</p>
                      </div>
                    )}

                    {/* Live emotion indicator */}
                    {!modelLoading && liveEmotionInfo && (
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2 animate-in fade-in">
                        <span className="text-xl">{liveEmotionInfo.emoji}</span>
                        <span className="text-white text-xs font-medium">{liveEmotionInfo.label}</span>
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      </div>
                    )}

                    {/* No face warning */}
                    {!modelLoading && (!liveResult || !liveResult.faceDetected) && (
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2">
                        <span className="text-sm">👤</span>
                        <span className="text-white/70 text-xs">No face detected</span>
                      </div>
                    )}

                    {/* Record indicator */}
                    {!modelLoading && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-white text-xs font-medium">LIVE</span>
                      </div>
                    )}
                  </div>

                  {/* Capture button */}
                  <button
                    onClick={handleCapture}
                    disabled={modelLoading}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-semibold
                      shadow-lg active:scale-95 transition-all hover:shadow-purple-200 hover:shadow-xl
                      disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full border-4 border-white flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full bg-white" />
                    </div>
                    Capture My Emotion
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    Position your face in the frame and tap capture. Your privacy is respected — images are processed locally.
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Analyzing ── */}
          {step === 'analyzing' && (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                  <Video className="w-12 h-12 text-purple-600 animate-pulse" />
                </div>
                <div className="absolute -inset-3 rounded-full border-2 border-purple-300 animate-ping opacity-30" />
                <div className="absolute -inset-6 rounded-full border border-purple-200 animate-ping opacity-15" style={{ animationDelay: '0.5s' }} />
              </div>
              <p className="font-bold text-gray-800 text-lg">Analyzing Expression...</p>
              <p className="text-sm text-gray-500 mt-1">Our AI is reading your facial expressions</p>
              <div className="flex gap-1 mt-4">
                {['😊', '😢', '😤', '😰', '😲', '😐', '🤢'].map((e, i) => (
                  <span
                    key={e}
                    className="text-2xl opacity-40 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {step === 'result' && detectionResult && emotionInfo && (
            <div className="p-5 space-y-4">
              {/* Detected emotion hero */}
              <div className={`${emotionInfo.bgColor} rounded-2xl p-6 border-2 ${emotionInfo.borderColor} text-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                <div className="relative z-10">
                  <span className="text-6xl block mb-3">{emotionInfo.emoji}</span>
                  <p className={`text-2xl font-bold ${emotionInfo.color} mb-1`}>
                    {emotionInfo.label}
                  </p>
                  <p className="text-sm text-gray-600">Detected from your facial expression</p>

                  {/* Wellness score bar */}
                  <div className="mt-4 max-w-xs mx-auto">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Wellness Score</span>
                      <span className={`font-bold ${emotionInfo.color}`}>
                        {detectionResult.wellnessScore}/100
                      </span>
                    </div>
                    <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          detectionResult.wellnessScore >= 70 ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                          detectionResult.wellnessScore >= 40 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                          'bg-gradient-to-r from-orange-400 to-red-500'
                        }`}
                        style={{ width: `${detectionResult.wellnessScore}%` }}
                      />
                    </div>
                  </div>

                  {/* All emotion scores */}
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {Object.entries(detectionResult.scores)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 4)
                      .map(([emotion, score]) => {
                        const info = EMOTION_DISPLAY[emotion];
                        return (
                          <div key={emotion} className="bg-white/60 rounded-lg p-2 text-center">
                            <span className="text-lg">{info?.emoji || '❓'}</span>
                            <p className="text-xs text-gray-600 font-medium mt-0.5">{Math.round(score * 100)}%</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Processing time badge */}
              <div className="flex justify-center">
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  Processed in {Math.round(detectionResult.processingTimeMs)}ms
                </span>
              </div>

              {/* Medicine relation (if they have medications) */}
              {allMedications.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-purple-500" />
                    Is this related to any medicine?
                  </p>
                  <div className="space-y-1.5">
                    {allMedications.map((med, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedMedicine(selectedMedicine?.drugName === med.drugName ? null : med)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                          selectedMedicine?.drugName === med.drugName
                            ? 'border-purple-500 bg-purple-50 shadow-sm'
                            : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          selectedMedicine?.drugName === med.drugName ? 'bg-purple-500' : 'bg-purple-100'
                        }`}>
                          <Pill className={`w-4 h-4 ${
                            selectedMedicine?.drugName === med.drugName ? 'text-white' : 'text-purple-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{med.drugName}</p>
                          <p className="text-xs text-gray-500">{med.dosage} • {med.frequency}</p>
                        </div>
                        {selectedMedicine?.drugName === med.drugName && (
                          <span className="ml-auto text-purple-600 text-xs font-medium">Selected</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note for caretaker (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Feeling this way since morning..."
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none text-sm
                    focus:border-purple-400 focus:ring-2 focus:ring-purple-100 focus:outline-none transition-colors"
                  maxLength={300}
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleRetake}
                  className="py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium text-sm
                    active:scale-95 transition-all hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake
                </button>
                <button
                  onClick={handleSubmit}
                  className="py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold text-sm
                    active:scale-95 transition-all hover:shadow-lg hover:shadow-purple-200 flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send to Caretaker
                </button>
              </div>
            </div>
          )}

          {/* ── Submitting ── */}
          {step === 'submitting' && (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center mb-4 animate-pulse">
                  <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                </div>
                <div className="absolute -inset-2 rounded-full border-2 border-purple-200 animate-ping opacity-30" />
              </div>
              <p className="font-semibold text-gray-800 text-lg">Sending...</p>
              <p className="text-sm text-gray-500 mt-1">Notifying your caretaker</p>
            </div>
          )}

          {/* ── Success ── */}
          {step === 'success' && emotionInfo && detectionResult && (
            <div className="p-10 flex flex-col items-center justify-center text-center">
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-green-600" />
                </div>
                <div className="absolute -inset-1 rounded-full border-2 border-green-300 animate-ping opacity-20" />
              </div>
              <span className="text-5xl mb-3">{emotionInfo.emoji}</span>
              <p className="font-bold text-gray-800 text-lg">Sent to Caretaker!</p>
              <p className="text-sm text-gray-500 mt-1">
                Your caretaker has been notified that you're feeling <strong>{emotionInfo.label}</strong>
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="px-4 py-2 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-700">
                    Wellness: <span className="font-bold text-lg">{detectionResult.wellnessScore}</span>/100
                  </p>
                </div>
                {selectedMedicine && (
                  <div className="px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-xs text-indigo-700">
                      <Pill className="w-3 h-3 inline mr-1" />
                      {selectedMedicine.drugName}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
