import { useEffect, useState } from 'react';
import { User } from '../models/User';
import { Heart, Loader, UserPlus } from 'lucide-react';
import {
  signUp,
  signIn,
} from '../services/firebaseAuthService';
import { caretakersApi } from '../services/apiService';

interface SignInSignUpProps {
  onComplete: (user: User) => void;
}

interface CaretakerOption {
  caretaker_id: string;
  name: string;
  specialization?: string;
}

export function SignInSignUp({ onComplete }: SignInSignUpProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [loadingCaretakers, setLoadingCaretakers] = useState(false);
  const [caretakers, setCaretakers] = useState<CaretakerOption[]>([]);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    residentId: '',
    caretakerId: '',
  });

  useEffect(() => {
    if (mode !== 'signup') {
      return;
    }

    let mounted = true;
    const loadCaretakers = async () => {
      setLoadingCaretakers(true);
      try {
        const data = await caretakersApi.getAll();
        if (mounted) {
          setCaretakers(data || []);
        }
      } catch (err) {
        console.error('[SignUp] Failed to load caretakers:', err);
        if (mounted) {
          setError('Unable to load caretakers right now. Please try again.');
        }
      } finally {
        if (mounted) {
          setLoadingCaretakers(false);
        }
      }
    };

    loadCaretakers();

    return () => {
      mounted = false;
    };
  }, [mode]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const appUser = await signIn(formData.email, formData.password);
      const user: User = {
        userId: appUser.uid,
        name: appUser.name,
        email: appUser.email,
        role: appUser.role,
        residentId: appUser.residentId,
      };
      onComplete(user);
    } catch (err: any) {
      console.error('[SignIn] Error:', err);
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(err.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match!');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!formData.caretakerId) {
      setError('Please select a caretaker.');
      return;
    }

    setLoading(true);

    try {
      const appUser = await signUp(
        formData.email,
        formData.password,
        formData.name,
        formData.caretakerId,
        formData.residentId || undefined
      );

      const user: User = {
        userId: appUser.uid,
        name: appUser.name,
        email: appUser.email,
        role: appUser.role,
        residentId: appUser.residentId,
      };
      onComplete(user);
    } catch (err: any) {
      console.error('[SignUp] Error:', err);
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/weak-password') {
        setError('Password is too weak. Use at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError(err.message || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="text-center mb-6">
            <div className="inline-flex p-3 bg-rose-100 rounded-full mb-3">
              <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">CareConnect Access</h2>
            <p className="text-sm text-gray-600 mt-1">One login for admin, caretaker, and patient</p>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
                mode === 'signin' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              }`}
              disabled={loading}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
              }}
              className={`py-2 text-sm font-semibold rounded-lg transition-colors ${
                mode === 'signup' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'
              }`}
              disabled={loading}
            >
              Patient Register
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
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
                  disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
              />
            </div>

            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Choose Caretaker</label>
                  <div className="relative">
                    <select
                      value={formData.caretakerId}
                      onChange={(e) => setFormData({ ...formData, caretakerId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      required
                      disabled={loading || loadingCaretakers || caretakers.length === 0}
                    >
                      <option value="">
                        {loadingCaretakers
                          ? 'Loading caretakers...'
                          : caretakers.length === 0
                            ? 'No caretakers available'
                            : 'Select a caretaker'}
                      </option>
                      {caretakers.map((caretaker) => (
                        <option key={caretaker.caretaker_id} value={caretaker.caretaker_id}>
                          {caretaker.name}
                          {caretaker.specialization ? ` (${caretaker.specialization})` : ''}
                        </option>
                      ))}
                    </select>
                    <UserPlus className="w-4 h-4 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Resident ID (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.residentId}
                    onChange={(e) => setFormData({ ...formData, residentId: e.target.value })}
                    placeholder="Leave blank to auto-create"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    If you already have a resident ID, enter it. Otherwise one is created automatically.
                  </p>
                </div>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || (mode === 'signup' && loadingCaretakers)}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold text-sm shadow-md active:scale-98 transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {mode === 'signin' ? 'Signing In...' : 'Creating Patient Account...'}
                  </>
                ) : (
                  mode === 'signin' ? 'Sign In' : 'Create Patient Account'
                )}
              </button>
            </div>
          </form>


        </div>
      </div>
    </div>
  );
}
