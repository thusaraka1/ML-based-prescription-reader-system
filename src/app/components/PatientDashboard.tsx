import { useState } from 'react';
import { Resident } from '../models/Resident';
import { Dashboard } from '../models/Dashboard';
import { User } from '../models/User';
import { Appointment } from '../models/Appointment';
import { 
  Pill, 
  Heart, 
  Utensils, 
  AlertCircle, 
  Calendar,
  Clock,
  Activity,
  Upload,
  User as UserIcon,
  Home,
  Phone,
  Users,
  MapPin,
  FileText
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { PrescriptionUpload } from './PrescriptionUpload';
import { AppointmentBooking } from './AppointmentBooking';

interface PatientDashboardProps {
  user: User;
  resident: Resident;
  dashboard: Dashboard;
  onLogout: () => void;
  onRefresh: () => void;
}

export function PatientDashboard({ user, resident, dashboard, onLogout, onRefresh }: PatientDashboardProps) {
  const [activeView, setActiveView] = useState<'home' | 'medications' | 'emotions' | 'appointments' | 'profile'>('home');
  const [showPrescriptionUpload, setShowPrescriptionUpload] = useState(false);
  const [showAppointmentBooking, setShowAppointmentBooking] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const latestEmotion = resident.getLatestEmotionalState();
  const upcomingMedications = resident.getAllMedications().slice(0, 3);
  const appointments = dashboard.getAppointmentsForResident(resident.residentId);
  const upcomingAppointments = appointments.filter(a => a.status === 'scheduled' && a.appointmentDate >= new Date());
  
  const emotionChartData = resident.emotionalStates
    .slice(-7)
    .map(state => ({
      time: state.timestamp.toLocaleDateString([], { weekday: 'short' }),
      score: state.stateScore
    }));

  const handlePrescriptionUpload = (doctorName: string) => {
    dashboard.processPrescriptionImage(resident.residentId, 'mock-image', doctorName);
    setShowPrescriptionUpload(false);
    onRefresh();
  };

  const handleBookAppointment = (doctorName: string, specialization: string, date: Date, time: string, reason: string) => {
    const appointment = new Appointment(
      `APT-${Date.now()}`,
      resident.residentId,
      resident.name,
      doctorName,
      specialization,
      date,
      time,
      reason
    );
    dashboard.addAppointment(appointment);
    setShowAppointmentBooking(false);
    onRefresh();
  };

  const [profileForm, setProfileForm] = useState({
    address: resident.personalDetails.address || '',
    city: resident.personalDetails.city || '',
    state: resident.personalDetails.state || '',
    zipCode: resident.personalDetails.zipCode || '',
    emergencyContactName: resident.personalDetails.emergencyContactName || '',
    emergencyContactPhone: resident.personalDetails.emergencyContactPhone || '',
    emergencyContactRelation: resident.personalDetails.emergencyContactRelation || '',
  });

  const handleSaveProfile = () => {
    resident.updatePersonalDetails(profileForm);
    setIsEditingProfile(false);
    onRefresh();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 pb-20">
      {/* Header - Mobile Optimized */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-300 to-purple-300 flex items-center justify-center text-white font-semibold text-lg">
              {resident.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs text-gray-600">Welcome,</p>
              <p className="font-semibold text-gray-800 text-sm">{resident.name.split(' ')[0]}</p>
            </div>
          </div>
          <button onClick={onLogout} className="text-xs text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            Logout
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeView === 'home' && (
          <div className="space-y-4">
            {/* Greeting */}
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-gray-800 mb-1">Hello!</h1>
              <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                Your Wellness Matters <Heart className="w-4 h-4 text-red-400 fill-red-400" />
              </p>
            </div>

            {/* Quick Actions - Mobile Grid */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveView('medications')}
                className="bg-white rounded-2xl p-4 shadow-md border border-blue-100 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-2 mx-auto">
                  <Pill className="w-6 h-6 text-blue-600" />
                </div>
                <p className="font-semibold text-gray-800 text-center text-sm">My Medicines</p>
                <p className="text-xs text-gray-500 text-center mt-0.5">{upcomingMedications.length} active</p>
              </button>

              <button
                onClick={() => setActiveView('emotions')}
                className="bg-white rounded-2xl p-4 shadow-md border border-purple-100 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-2 mx-auto">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <p className="font-semibold text-gray-800 text-center text-sm">How I Feel</p>
                <p className="text-xs text-gray-500 text-center mt-0.5">
                  {latestEmotion?.getEmotionalLevel() || 'Track now'}
                </p>
              </button>

              <button
                onClick={() => setActiveView('appointments')}
                className="bg-white rounded-2xl p-4 shadow-md border border-green-100 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-2 mx-auto">
                  <Calendar className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-semibold text-gray-800 text-center text-sm">Appointments</p>
                <p className="text-xs text-gray-500 text-center mt-0.5">{upcomingAppointments.length} upcoming</p>
              </button>

              <button
                onClick={() => setShowPrescriptionUpload(true)}
                className="bg-white rounded-2xl p-4 shadow-md border border-orange-100 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-2 mx-auto">
                  <Upload className="w-6 h-6 text-orange-600" />
                </div>
                <p className="font-semibold text-gray-800 text-center text-sm">Upload Rx</p>
                <p className="text-xs text-gray-500 text-center mt-0.5">Scan now</p>
              </button>
            </div>

            {/* Room Info Card */}
            {resident.personalDetails.roomNumber && (
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-2xl p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-900 mb-1">Your Room</p>
                    <p className="text-2xl font-bold text-blue-900">
                      Room {resident.personalDetails.roomNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-blue-900 mb-1">Floor</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {resident.personalDetails.floorNumber}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Today's Summary */}
            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 text-base">Today's Summary</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Medications taken</span>
                  <span className="font-semibold text-blue-600">2 / {upcomingMedications.length}</span>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Emotional wellness</span>
                  <span className={`font-semibold ${
                    (latestEmotion?.stateScore || 0) >= 70 ? 'text-green-600' : 
                    (latestEmotion?.stateScore || 0) >= 40 ? 'text-yellow-600' : 
                    'text-orange-600'
                  }`}>
                    {latestEmotion?.getEmotionalLevel() || 'Not tracked'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Next appointment</span>
                  <span className="font-semibold text-gray-800 text-sm">
                    {upcomingAppointments.length > 0 
                      ? upcomingAppointments[0].appointmentDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
                      : 'None scheduled'
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Emotion Chart */}
            {emotionChartData.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-3 text-base">Your Wellness Trend</h3>
                
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={emotionChartData}>
                    <XAxis dataKey="time" style={{ fontSize: '10px' }} />
                    <YAxis domain={[0, 100]} hide />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#8b5cf6" 
                      strokeWidth={2}
                      dot={{ fill: '#8b5cf6', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeView === 'medications' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-800">My Medications</h2>
              <button
                onClick={() => setShowPrescriptionUpload(true)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium active:scale-95 transition-transform"
              >
                Upload New
              </button>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-blue-900">Next Dose In</span>
                <Clock className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-900">04:30:15</p>
            </div>

            {resident.prescriptions.map(prescription => (
              <div key={prescription.prescriptionId}>
                {prescription.medications.map((med, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 mb-3">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Pill className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800 text-base mb-1">{med.drugName}</h3>
                        <p className="text-sm text-gray-600 mb-1">{med.frequency}</p>
                        <p className="text-xs text-gray-500">Dosage: {med.dosage}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button className="py-2 bg-green-100 text-green-700 rounded-lg font-medium text-xs active:scale-95 transition-transform">
                        Taken
                      </button>
                      <button className="py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-xs active:scale-95 transition-transform">
                        Skip
                      </button>
                      <button className="py-2 bg-orange-100 text-orange-700 rounded-lg font-medium text-xs active:scale-95 transition-transform">
                        Remind
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeView === 'emotions' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-800">How You're Feeling</h2>

            <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-6 text-center border border-purple-200">
              <p className="text-sm text-purple-900 mb-2">Current Emotional State</p>
              <p className="text-5xl font-bold text-purple-900 mb-2">
                {latestEmotion?.stateScore || '--'}
              </p>
              <p className="text-purple-700 font-medium">{latestEmotion?.getEmotionalLevel() || 'No data'}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-3 text-base">This Week</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={emotionChartData}>
                  <XAxis dataKey="time" style={{ fontSize: '11px' }} />
                  <YAxis domain={[0, 100]} style={{ fontSize: '11px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <button className="w-full py-4 bg-purple-500 text-white rounded-2xl font-semibold shadow-md active:scale-95 transition-transform">
              Log How I Feel Now
            </button>
          </div>
        )}

        {activeView === 'appointments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-800">Appointments</h2>
              <button
                onClick={() => setShowAppointmentBooking(true)}
                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium active:scale-95 transition-transform"
              >
                Book New
              </button>
            </div>

            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map(apt => (
                <div key={apt.appointmentId} className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800 text-base mb-1">Dr. {apt.doctorName}</h3>
                      <p className="text-sm text-gray-600 mb-1">{apt.specialization}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {apt.appointmentDate.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {apt.appointmentTime}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">Reason: {apt.reason}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button className="py-2 bg-blue-100 text-blue-700 rounded-lg font-medium text-xs active:scale-95 transition-transform">
                      Reschedule
                    </button>
                    <button className="py-2 bg-red-100 text-red-700 rounded-lg font-medium text-xs active:scale-95 transition-transform">
                      Cancel
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-600 mb-4">No upcoming appointments</p>
                <button
                  onClick={() => setShowAppointmentBooking(true)}
                  className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium active:scale-95 transition-transform"
                >
                  Book Your First Appointment
                </button>
              </div>
            )}
          </div>
        )}

        {activeView === 'profile' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-gray-800">My Profile</h2>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium active:scale-95 transition-transform"
                >
                  Edit Info
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100 space-y-4">
              {/* Basic Info */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UserIcon className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-800">Basic Information</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Name</span>
                    <span className="font-medium text-gray-800">{resident.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Age</span>
                    <span className="font-medium text-gray-800">{resident.age} years</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Resident ID</span>
                    <span className="font-medium text-gray-800">{resident.residentId}</span>
                  </div>
                  {resident.personalDetails.dateOfBirth && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Date of Birth</span>
                      <span className="font-medium text-gray-800">
                        {resident.personalDetails.dateOfBirth.toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Address */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Home className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-gray-800">Address</h3>
                </div>
                {isEditingProfile ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Street Address"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="City"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        type="text"
                        placeholder="State"
                        value={profileForm.state}
                        onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="ZIP Code"
                      value={profileForm.zipCode}
                      onChange={(e) => setProfileForm({ ...profileForm, zipCode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">
                    {resident.personalDetails.address || 'Not provided'}<br />
                    {resident.personalDetails.city && `${resident.personalDetails.city}, `}
                    {resident.personalDetails.state} {resident.personalDetails.zipCode}
                  </div>
                )}
              </div>

              {/* Emergency Contact */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-gray-800">Emergency Contact</h3>
                </div>
                {isEditingProfile ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={profileForm.emergencyContactName}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="tel"
                      placeholder="Contact Phone"
                      value={profileForm.emergencyContactPhone}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Relation"
                      value={profileForm.emergencyContactRelation}
                      onChange={(e) => setProfileForm({ ...profileForm, emergencyContactRelation: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-800 font-medium">
                      {resident.personalDetails.emergencyContactName || 'Not provided'}
                    </p>
                    <p className="text-gray-600">
                      {resident.personalDetails.emergencyContactPhone}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Relation: {resident.personalDetails.emergencyContactRelation}
                    </p>
                  </div>
                )}
              </div>

              {/* Save/Cancel Buttons */}
              {isEditingProfile && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => setIsEditingProfile(false)}
                    className="py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-medium text-sm active:scale-95 transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProfile}
                    className="py-2 bg-blue-500 text-white rounded-lg font-medium text-sm active:scale-95 transition-transform"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation - Mobile Optimized */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-area-bottom">
        <div className="px-2 py-2">
          <div className="flex justify-around">
            <button
              onClick={() => setActiveView('home')}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-0 ${
                activeView === 'home' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500'
              }`}
            >
              <Heart className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs">Home</span>
            </button>
            <button
              onClick={() => setActiveView('medications')}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-0 ${
                activeView === 'medications' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500'
              }`}
            >
              <Pill className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs">Meds</span>
            </button>
            <button
              onClick={() => setActiveView('appointments')}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-0 ${
                activeView === 'appointments' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500'
              }`}
            >
              <Calendar className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs">Appts</span>
            </button>
            <button
              onClick={() => setActiveView('emotions')}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-0 ${
                activeView === 'emotions' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500'
              }`}
            >
              <Activity className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs">Feel</span>
            </button>
            <button
              onClick={() => setActiveView('profile')}
              className={`flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors min-w-0 ${
                activeView === 'profile' 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500'
              }`}
            >
              <UserIcon className="w-5 h-5 flex-shrink-0" />
              <span className="text-xs">Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPrescriptionUpload && (
        <PrescriptionUpload
          residentName={resident.name}
          residentId={resident.residentId}
          onUpload={handlePrescriptionUpload}
          onClose={() => setShowPrescriptionUpload(false)}
        />
      )}

      {showAppointmentBooking && (
        <AppointmentBooking
          residentName={resident.name}
          residentId={resident.residentId}
          onBook={handleBookAppointment}
          onClose={() => setShowAppointmentBooking(false)}
        />
      )}
    </div>
  );
}
