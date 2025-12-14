import { useState } from 'react';
import { User } from '../models/User';
import { Shield, Users, Heart } from 'lucide-react';

type UserRole = 'patient' | 'caretaker' | 'admin';

interface SignInSignUpProps {
  onComplete: (user: User) => void;
}

export function SignInSignUp({ onComplete }: SignInSignUpProps) {
  const [mode, setMode] = useState<'choice' | 'signin' | 'signup'>('choice');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    residentId: ''
  });

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple demo authentication
    const user: User = {
      userId: `U-${Date.now()}`,
      name: formData.name || 'Demo User',
      email: formData.email,
      role: selectedRole!,
      residentId: selectedRole === 'patient' ? (formData.residentId || 'R001') : undefined
    };
    onComplete(user);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    const user: User = {
      userId: `U-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      role: selectedRole!,
      residentId: selectedRole === 'patient' ? `R-${Date.now()}` : undefined
    };
    onComplete(user);
  };

  if (mode === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-white rounded-full shadow-lg mb-4">
              <Heart className="w-12 h-12 text-red-400 fill-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h1>
            <p className="text-sm text-gray-600">Sign in or create an account</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setMode('signin')}
              className="w-full py-4 bg-white border-2 border-blue-500 text-blue-600 rounded-xl font-semibold text-base shadow-sm active:scale-98 transition-transform"
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-base shadow-md active:scale-98 transition-transform"
            >
              Sign Up
            </button>
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <button
          onClick={() => {
            setMode('choice');
            setSelectedRole(null);
            setFormData({ name: '', email: '', password: '', confirmPassword: '', residentId: '' });
          }}
          className="text-sm text-blue-600 mb-4"
        >
          ← Back
        </button>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>

          {!selectedRole ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">Select your role:</p>
              
              <button
                onClick={() => setSelectedRole('patient')}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Patient</p>
                    <p className="text-xs text-gray-500">Track your health and wellness</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('caretaker')}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Caretaker</p>
                    <p className="text-xs text-gray-500">Manage resident care</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedRole('admin')}
                className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">Administrator</p>
                    <p className="text-xs text-gray-500">Supervise operations</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}

              {mode === 'signup' && selectedRole === 'patient' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Resident ID (if existing patient)
                  </label>
                  <input
                    type="text"
                    value={formData.residentId}
                    onChange={(e) => setFormData({ ...formData, residentId: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold text-sm shadow-md active:scale-98 transition-transform"
                >
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
              </div>

              {mode === 'signin' && (
                <p className="text-center text-xs text-gray-600">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setSelectedRole(null);
                    }}
                    className="text-blue-600 font-medium"
                  >
                    Sign Up
                  </button>
                </p>
              )}
            </form>
          )}
        </div>

        {/* Demo Login Option */}
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              const demoUser: User = {
                userId: 'DEMO',
                name: selectedRole === 'patient' ? 'Margaret Thompson' : 
                      selectedRole === 'caretaker' ? 'Sarah Johnson' : 
                      'Admin User',
                email: `demo.${selectedRole}@care.com`,
                role: selectedRole || 'patient',
                residentId: selectedRole === 'patient' ? 'R001' : undefined
              };
              onComplete(demoUser);
            }}
            className="text-xs text-gray-500 underline"
            disabled={!selectedRole}
          >
            {selectedRole ? 'or try demo account' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
