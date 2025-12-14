import { useState } from 'react';
import { Upload, Camera, X, FileText, Sparkles, Loader } from 'lucide-react';

interface PrescriptionUploadProps {
  residentName: string;
  residentId?: string;
  onUpload: (doctorName: string, imageFile: File | null) => void;
  onClose: () => void;
}

export function PrescriptionUpload({ residentName, residentId, onUpload, onClose }: PrescriptionUploadProps) {
  const [doctorName, setDoctorName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'camera'>('file');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim()) return;

    setProcessing(true);
    
    // Simulate OCR and NLP processing
    setTimeout(() => {
      onUpload(doctorName, selectedFile);
      setProcessing(false);
    }, 2000);
  };

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
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
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
                  PNG, JPG, PDF up to 10MB
                </p>
              </label>
            )}
          </div>

          {/* AI Processing Info */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-1">AI-Powered Processing</h4>
                <p className="text-sm text-blue-800">
                  Our advanced OCR engine will scan and extract text from your prescription image. 
                  Then, our NLP system will automatically identify medications, dosages, and frequencies.
                </p>
              </div>
            </div>
          </div>

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
            <button
              type="submit"
              disabled={processing || !doctorName.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Process with AI
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
