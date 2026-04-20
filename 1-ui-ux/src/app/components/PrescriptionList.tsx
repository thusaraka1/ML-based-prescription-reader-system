import { Prescription } from '../models/Prescription';
import { FileText, Trash2, Calendar, UserRound } from 'lucide-react';

interface PrescriptionListProps {
  prescriptions: Prescription[];
  onDelete?: (prescriptionId: string) => void;
}

export function PrescriptionList({ prescriptions, onDelete }: PrescriptionListProps) {
  if (prescriptions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No prescriptions on file</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prescriptions.map(prescription => (
        <div key={prescription.prescriptionId} className="border rounded-lg p-4 bg-white">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Prescription {prescription.prescriptionId}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <UserRound className="w-3 h-3" />
                  <span>Dr. {prescription.doctorName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{prescription.dateIssued.toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            {onDelete && (
              <button
                onClick={() => onDelete(prescription.prescriptionId)}
                className="p-2 hover:bg-red-50 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>

          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium text-gray-700">Medications:</p>
            {prescription.medications.map((med, idx) => (
              <div key={idx} className="pl-4 py-2 border-l-2 border-blue-200 bg-blue-50">
                <p className="font-medium text-sm">{med.drugName}</p>
                <p className="text-xs text-gray-600">
                  Dosage: {med.dosage} • Frequency: {med.frequency}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
