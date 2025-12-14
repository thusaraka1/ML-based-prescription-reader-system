import { Heart, Sparkles, Shield, Users } from 'lucide-react';

interface WelcomeScreenProps {
  onContinue: () => void;
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Animated Logo */}
        <div className="mb-6 relative">
          <div className="inline-block relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-xl opacity-50 animate-pulse" />
            <div className="relative bg-white rounded-full p-6 shadow-xl">
              <Heart className="w-16 h-16 text-red-400 fill-red-400 animate-pulse" />
            </div>
          </div>
          <div className="absolute -top-2 -right-2">
            <Sparkles className="w-8 h-8 text-yellow-400 fill-yellow-400 animate-bounce" />
          </div>
        </div>

        {/* Welcome Message */}
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">
            Welcome to <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">CareConnect</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-700 font-medium">
            Your Wellness Journey Starts Here
          </p>
          <p className="text-sm md:text-base text-gray-600 max-w-md mx-auto leading-relaxed px-2">
            We're here to make healthcare simple, caring, and connected. 
            Whether you're a patient, caretaker, or administrator, we've got you covered.
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white/80 backdrop-blur rounded-xl p-3 shadow-md border border-blue-200">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Heart className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1 text-xs">Patient Care</h3>
            <p className="text-xs text-gray-600">Track health</p>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-xl p-3 shadow-md border border-green-200">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1 text-xs">Caretaker</h3>
            <p className="text-xs text-gray-600">Manage care</p>
          </div>

          <div className="bg-white/80 backdrop-blur rounded-xl p-3 shadow-md border border-purple-200">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-800 mb-1 text-xs">Admin</h3>
            <p className="text-xs text-gray-600">Supervise all</p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={onContinue}
          className="group relative px-8 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold text-base shadow-xl hover:shadow-2xl active:scale-95 transition-all duration-300"
        >
          <span className="relative z-10 flex items-center gap-2 justify-center">
            Get Started
            <Heart className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>

        {/* Footer Text */}
        <p className="mt-6 text-xs text-gray-500">
          Powered by AI • Driven by Care • Built for You
        </p>
      </div>
    </div>
  );
}