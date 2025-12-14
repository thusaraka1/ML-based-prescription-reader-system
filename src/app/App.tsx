import { useState } from 'react';
import { Dashboard } from './models/Dashboard';
import { Resident } from './models/Resident';
import { Prescription } from './models/Prescription';
import { Medication } from './models/Medication';
import { EmotionalState } from './models/EmotionalState';
import { Caretaker } from './models/Caretaker';
import { SystemComponent } from './models/SystemComponent';
import { User } from './models/User';
import { WelcomeScreen } from './components/WelcomeScreen';
import { SignInSignUp } from './components/SignInSignUp';
import { LoginScreen } from './components/LoginScreen';
import { PatientDashboard } from './components/PatientDashboard';
import { CaretakerDashboard } from './components/CaretakerDashboard';
import { AdminDashboard } from './components/AdminDashboard';

// Initialize dashboard with sample data
const initializeDashboard = (): Dashboard => {
  const dashboard = new Dashboard();

  // Add system components
  dashboard.addSystemComponent(new SystemComponent('SYS-001', 'OCR Engine', '2.5.1', 'Optical Character Recognition for prescription scanning', 'online'));
  dashboard.addSystemComponent(new SystemComponent('SYS-002', 'NLP Engine', '3.1.0', 'Natural Language Processing for medication extraction', 'online'));
  dashboard.addSystemComponent(new SystemComponent('SYS-003', 'Emotion AI', '1.8.2', 'Facial and vocal emotion analysis system', 'online'));

  // Create sample caretakers
  const caretaker1 = new Caretaker('CT001', 'Sarah Johnson', 'sarah.j@care.com', '555-0101', 'General Care');
  const caretaker2 = new Caretaker('CT002', 'Michael Davis', 'michael.d@care.com', '555-0102', 'Senior Care');
  const caretaker3 = new Caretaker('CT003', 'Jennifer Lee', 'jennifer.l@care.com', '555-0103', 'Medical Specialist');
  
  dashboard.addCaretaker(caretaker1);
  dashboard.addCaretaker(caretaker2);
  dashboard.addCaretaker(caretaker3);

  // Create sample residents
  const resident1 = new Resident('R001', 'Margaret Thompson', 78);
  resident1.updatePersonalDetails({
    dateOfBirth: new Date('1946-03-15'),
    address: '123 Oak Street',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62701',
    emergencyContactName: 'David Thompson',
    emergencyContactPhone: '555-1234',
    emergencyContactRelation: 'Son',
    children: ['David Thompson', 'Susan Miller'],
    roomNumber: '201',
    floorNumber: '2',
    admissionDate: new Date('2023-01-15'),
    allergies: ['Penicillin']
  });

  const resident2 = new Resident('R002', 'Robert Chen', 82);
  resident2.updatePersonalDetails({
    dateOfBirth: new Date('1942-08-22'),
    address: '456 Elm Avenue',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62702',
    emergencyContactName: 'Lisa Chen',
    emergencyContactPhone: '555-5678',
    emergencyContactRelation: 'Daughter',
    children: ['Lisa Chen', 'Michael Chen'],
    roomNumber: '305',
    floorNumber: '3',
    admissionDate: new Date('2023-03-20'),
    allergies: ['Sulfa drugs']
  });

  const resident3 = new Resident('R003', 'Elizabeth Rodriguez', 75);
  resident3.updatePersonalDetails({
    dateOfBirth: new Date('1949-11-30'),
    address: '789 Pine Road',
    city: 'Springfield',
    state: 'IL',
    zipCode: '62703',
    emergencyContactName: 'Carlos Rodriguez',
    emergencyContactPhone: '555-9012',
    emergencyContactRelation: 'Husband',
    roomNumber: '102',
    floorNumber: '1',
    admissionDate: new Date('2023-06-10')
  });

  // Assign residents to caretakers
  caretaker1.assignedResidents.push('R001');
  caretaker2.assignedResidents.push('R002', 'R003');

  // Add prescriptions
  const prescription1 = new Prescription('RX-001', new Date('2024-12-01'), 'Sarah Johnson');
  prescription1.addMedication(new Medication('Lisinopril', '10mg', 'once daily'));
  prescription1.addMedication(new Medication('Metformin', '500mg', 'twice daily'));
  resident1.addPrescription(prescription1);

  const prescription2 = new Prescription('RX-002', new Date('2024-12-10'), 'Michael Davis');
  prescription2.addMedication(new Medication('Atorvastatin', '20mg', 'once daily at bedtime'));
  resident1.addPrescription(prescription2);

  const prescription3 = new Prescription('RX-003', new Date('2024-12-05'), 'Sarah Johnson');
  prescription3.addMedication(new Medication('Aspirin', '81mg', 'once daily'));
  prescription3.addMedication(new Medication('Warfarin', '5mg', 'once daily'));
  prescription3.addMedication(new Medication('Furosemide', '40mg', 'twice daily'));
  prescription3.addMedication(new Medication('Metoprolol', '50mg', 'twice daily'));
  prescription3.addMedication(new Medication('Losartan', '100mg', 'once daily'));
  resident2.addPrescription(prescription3);

  const prescription4 = new Prescription('RX-004', new Date('2024-12-08'), 'Jennifer Lee');
  prescription4.addMedication(new Medication('Levothyroxine', '75mcg', 'once daily in morning'));
  prescription4.addMedication(new Medication('Calcium', '600mg', 'twice daily with meals'));
  resident3.addPrescription(prescription4);

  // Add emotional states
  const now = new Date();
  
  // Margaret - Good wellness trend
  resident1.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 6), 68));
  resident1.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 5), 72));
  resident1.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 4), 74));
  resident1.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 3), 78));
  resident1.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 2), 80));
  resident1.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 1), 82));
  resident1.addEmotionalState(new EmotionalState(now, 85));

  // Robert - Poor wellness (needs attention)
  resident2.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 6), 48));
  resident2.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 5), 45));
  resident2.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 4), 42));
  resident2.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 3), 38));
  resident2.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 2), 35));
  resident2.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 1), 32));
  resident2.addEmotionalState(new EmotionalState(now, 30));

  // Elizabeth - Stable, improving
  resident3.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 6), 55));
  resident3.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 5), 58));
  resident3.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 4), 62));
  resident3.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 3), 65));
  resident3.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 2), 68));
  resident3.addEmotionalState(new EmotionalState(new Date(now.getTime() - 3600000 * 1), 70));
  resident3.addEmotionalState(new EmotionalState(now, 72));

  dashboard.addResident(resident1);
  dashboard.addResident(resident2);
  dashboard.addResident(resident3);

  // Generate initial alerts
  dashboard.refreshAlerts();

  return dashboard;
};

export default function App() {
  const [dashboard] = useState<Dashboard>(() => initializeDashboard());
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'auth' | 'demo-login' | 'app'>('welcome');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleWelcomeContinue = () => {
    setCurrentScreen('auth');
  };

  const handleAuthComplete = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('app');
  };

  const handleShowDemoLogin = () => {
    setCurrentScreen('demo-login');
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentScreen('app');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentScreen('auth');
  };

  const handleRefresh = () => {
    dashboard.refreshAlerts();
    setRefreshKey(prev => prev + 1);
  };

  // Show welcome screen
  if (currentScreen === 'welcome') {
    return <WelcomeScreen onContinue={handleWelcomeContinue} />;
  }

  // Show auth (sign in/sign up) screen
  if (currentScreen === 'auth') {
    return <SignInSignUp onComplete={handleAuthComplete} />;
  }

  // Show demo login screen
  if (currentScreen === 'demo-login') {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Show app if user is logged in
  if (currentScreen === 'app' && currentUser) {
    // Route to appropriate dashboard based on user role
    if (currentUser.role === 'patient') {
      const resident = dashboard.getResident(currentUser.residentId || '');
      if (!resident) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-red-50">
            <div className="text-center">
              <p className="text-red-800 font-semibold">Error: Resident record not found</p>
              <button
                onClick={handleLogout}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg"
              >
                Return to Login
              </button>
            </div>
          </div>
        );
      }
      return (
        <PatientDashboard
          key={refreshKey}
          user={currentUser}
          resident={resident}
          dashboard={dashboard}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
        />
      );
    }

    if (currentUser.role === 'caretaker') {
      return (
        <CaretakerDashboard
          key={refreshKey}
          user={currentUser}
          dashboard={dashboard}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
        />
      );
    }

    if (currentUser.role === 'admin') {
      return (
        <AdminDashboard
          key={refreshKey}
          user={currentUser}
          dashboard={dashboard}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
        />
      );
    }
  }

  return null;
}