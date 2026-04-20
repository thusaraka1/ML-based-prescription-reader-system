import { useState, useEffect, useRef } from 'react';
import { generateMealPlan, loadSavedMealPlan, clearMealPlanCache, MealPlanRequest } from '../ml/meal-plan/MealPlanEngine';
import { WeeklyMealPlan, DailyMealPlan } from '../ml/meal-plan/MealPlan';
import { Resident } from '../models/Resident';
import { Loader2, Calendar as CalendarIcon, Info, RefreshCw, Utensils, Beaker, CheckCircle } from 'lucide-react';

interface MealPlanViewProps {
  resident: Resident;
}

export function MealPlanView({ resident }: MealPlanViewProps) {
  const [mealPlan, setMealPlan] = useState<WeeklyMealPlan | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = Monday, etc.
  const prevMedCount = useRef<number>(-1);

  const medCount = resident.getAllMedications().length;

  const buildRequest = (): MealPlanRequest => {
    const meds = resident.getAllMedications().map(m => ({
      name: m.drugName,
      dosage: m.dosage,
      frequency: m.frequency,
    }));

    return {
      residentId: resident.residentId,
      residentName: resident.name,
      age: resident.age || 70,
      medications: meds,
      allergies: resident.personalDetails.allergies || [],
      medicalHistory: resident.personalDetails.medicalHistory || '',
      dietaryRestrictions: resident.personalDetails.dietaryRestrictions || [],
    };
  };

  /**
   * Load meal plan: Try DB first, only call Gemini if nothing is saved
   * or if medications changed since the last plan was generated.
   */
  const loadMealPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try loading from database first (no Gemini API call)
      const savedPlan = await loadSavedMealPlan(resident.residentId, medCount);
      if (savedPlan) {
        setMealPlan(savedPlan);
        setLoading(false);
        return;
      }

      // No saved plan (or stale) — generate a fresh one via Gemini
      const plan = await generateMealPlan(buildRequest());
      setMealPlan(plan);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to load meal plan:', err);
      setError(err?.message || 'Failed to load meal plan');
      setLoading(false);
    }
  };

  /**
   * Force regenerate: Clear caches + DB, then call Gemini for a fresh plan.
   */
  const regenerateMealPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      clearMealPlanCache(resident.residentId);
      const plan = await generateMealPlan(buildRequest());
      setMealPlan(plan);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to regenerate meal plan:', err);
      setError(err?.message || 'Failed to regenerate meal plan');
      setLoading(false);
    }
  };

  useEffect(() => {
    // On first mount or resident change, load from DB
    // If medication count changed (new prescription), force regenerate
    if (prevMedCount.current !== -1 && prevMedCount.current !== medCount) {
      // Medication count changed — regenerate with new meds
      regenerateMealPlan();
    } else {
      loadMealPlan();
    }
    prevMedCount.current = medCount;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resident.residentId, medCount]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl shadow-sm border border-gray-100">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
        <p className="text-gray-800 font-medium">Generating Personalized Meal Plan...</p>
        <p className="text-sm text-gray-500 mt-2 text-center max-w-sm">
          Analyzing medications and dietary requirements to suggest the best meals for {resident.name}.
        </p>
      </div>
    );
  }

  if (error || !mealPlan) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <Utensils className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-800 mb-2">Meal Plan Unavailable</h3>
        <p className="text-gray-600 mb-6">{error || 'Could not generate plan.'}</p>
        <button 
          onClick={() => regenerateMealPlan()}
          className="px-6 py-2 bg-orange-500 text-white rounded-full font-medium active:scale-95 transition-transform"
        >
          Try Again
        </button>
      </div>
    );
  }

  const dayPlan: DailyMealPlan | undefined = mealPlan.days[selectedDay];

  return (
    <div className="space-y-4">
      {/* Header section */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl shadow-md p-5 text-white flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Utensils className="w-5 h-5" />
            Therapeutic Meal Plan
          </h2>
          <p className="text-sm text-orange-100 mt-1">Generated for {resident.name}</p>
        </div>
        <button 
          onClick={() => fetchMealPlan(true)}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate
        </button>
      </div>

      {/* Medication & Clinical warnings */}
      {(mealPlan.medicationConsiderations?.length > 0 || mealPlan.dietaryNotes) && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <h3 className="font-semibold text-amber-800 flex items-center gap-2 mb-2 text-sm">
            <Beaker className="w-4 h-4" /> Clinical Considerations
          </h3>
          {mealPlan.dietaryNotes && (
            <p className="text-sm text-amber-700 font-medium mb-2">{mealPlan.dietaryNotes}</p>
          )}
          <ul className="space-y-1">
            {mealPlan.medicationConsiderations.map((note, idx) => (
              <li key={idx} className="text-xs text-amber-700 flex items-start gap-1.5">
                <span className="mt-0.5">•</span> <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Day Selector */}
      <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto p-1 hide-scrollbar">
        {mealPlan.days.map((day, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedDay(idx)}
            className={`min-w-[80px] flex-1 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap px-3 ${
              selectedDay === idx 
                ? 'bg-orange-100 text-orange-700' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {day.day.substring(0, 3)}
          </button>
        ))}
      </div>

      {/* Daily Plan View */}
      {dayPlan && (
        <div className="space-y-4">
          {/* Nutrition Summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
              <span className="block text-xs text-gray-500 uppercase">Cals</span>
              <span className="block text-lg font-bold text-gray-800">{dayPlan.totalCalories}</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
              <span className="block text-xs text-gray-500 uppercase">Protein</span>
              <span className="block text-lg font-bold text-gray-800">{dayPlan.totalProtein}g</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
              <span className="block text-xs text-gray-500 uppercase">Carbs</span>
              <span className="block text-lg font-bold text-gray-800">{dayPlan.totalCarbs}g</span>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 text-center">
              <span className="block text-xs text-gray-500 uppercase">Fat</span>
              <span className="block text-lg font-bold text-gray-800">{dayPlan.totalFat}g</span>
            </div>
          </div>

          {/* Meals List */}
          <div className="space-y-3">
            {[
              { id: 'breakfast', label: 'Breakfast', meal: dayPlan.breakfast, color: 'bg-yellow-50', icon: '🌅' },
              { id: 'morningSnack', label: 'Morning Snack', meal: dayPlan.morningSnack, color: 'bg-green-50', icon: '🍎' },
              { id: 'lunch', label: 'Lunch', meal: dayPlan.lunch, color: 'bg-orange-50', icon: '🍲' },
              { id: 'afternoonSnack', label: 'Afternoon Snack', meal: dayPlan.afternoonSnack, color: 'bg-blue-50', icon: '🥨' },
              { id: 'dinner', label: 'Dinner', meal: dayPlan.dinner, color: 'bg-purple-50', icon: '🍽️' },
            ].map(({ id, label, meal, color, icon }) => (
              <div key={id} className={`rounded-xl p-4 shadow-sm border ${color.replace('bg-', 'border-').replace('50', '200')} ${color}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <span>{icon}</span> {label}
                  </span>
                  <span className="text-xs font-medium bg-black/5 px-2 py-0.5 rounded-full">{meal.calories} cal</span>
                </div>
                
                <h4 className="font-bold text-gray-800 text-base leading-tight mb-1">{meal.name}</h4>
                <p className="text-sm text-gray-600 mb-2">{meal.description}</p>
                
                {meal.rationale && (
                  <div className="mt-2 bg-white/60 rounded p-2 text-xs text-gray-700 flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 mt-0.5 text-blue-500 flex-shrink-0" />
                    <span>{meal.rationale}</span>
                  </div>
                )}
                
                {meal.tags && meal.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {meal.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-white text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
