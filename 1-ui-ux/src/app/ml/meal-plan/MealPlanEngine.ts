/**
 * Meal Plan Engine
 * Uses Gemini API to generate personalized, medication-aware weekly meal plans.
 * Plans are persisted to MySQL so they don't require an API call on every page load.
 */

import { getGeminiModel, isGeminiEnabled, callWithRetry } from '../nlp/geminiService';
import { WeeklyMealPlan, DailyMealPlan, MealItem, createEmptyMealPlan } from './MealPlan';
import { MEAL_PLAN_SYSTEM_PROMPT, buildMealPlanPrompt, buildMealRegenerationPrompt } from './mealPlanPrompts';
import { mealPlansApi } from '../../services/apiService';

// In-memory cache (session only — DB is the source of truth)
const mealPlanCache = new Map<string, WeeklyMealPlan>();

export interface MealPlanRequest {
  residentId: string;
  residentName: string;
  age: number;
  medications: { name: string; dosage: string; frequency: string }[];
  allergies: string[];
  medicalHistory: string;
  dietaryRestrictions: string[];
  calorieTarget?: number;
}

/**
 * Load a saved meal plan from the database.
 * Returns null if no plan exists or if the medication count has changed.
 */
export async function loadSavedMealPlan(
  residentId: string,
  currentMedCount: number
): Promise<WeeklyMealPlan | null> {
  // Check in-memory cache first
  const cached = mealPlanCache.get(residentId);
  if (cached) {
    return cached;
  }

  try {
    const response = await mealPlansApi.getForResident(residentId);

    if (!response.plan) {
      console.log(`[MealPlan] No saved plan found for resident ${residentId}`);
      return null;
    }

    // If medication count has changed, the saved plan is stale
    if (response.medicationCount !== undefined && response.medicationCount !== currentMedCount) {
      console.log(
        `[MealPlan] Saved plan is stale (meds: ${response.medicationCount} → ${currentMedCount}), will regenerate`
      );
      return null;
    }

    console.log(`[MealPlan] ✅ Loaded saved plan from database (generated: ${response.generatedAt})`);
    mealPlanCache.set(residentId, response.plan);
    return response.plan;
  } catch (error) {
    console.warn('[MealPlan] Failed to load from DB, will generate fresh:', error);
    return null;
  }
}

/**
 * Generate a new meal plan using Gemini and save it to the database.
 */
export async function generateMealPlan(request: MealPlanRequest): Promise<WeeklyMealPlan> {
  if (!isGeminiEnabled()) {
    console.warn('[MealPlan] Gemini not configured, returning demo meal plan');
    return generateDemoMealPlan(request);
  }

  console.log(`[MealPlan] Preparing to generate plan for ${request.residentName}. Including ${request.medications.length} active medications:`, request.medications.map(m => m.name).join(', '));

  try {
    const prompt = buildMealPlanPrompt({
      name: request.residentName,
      age: request.age,
      medications: request.medications,
      allergies: request.allergies,
      medicalHistory: request.medicalHistory,
      dietaryRestrictions: request.dietaryRestrictions,
      calorieTarget: request.calorieTarget,
    });

    console.log(`[MealPlan] Generating meal plan for ${request.residentName}...`);

    const result = await callWithRetry(
      m => m.generateContent([
        { text: MEAL_PLAN_SYSTEM_PROMPT },
        { text: prompt },
      ]),
      { maxRetries: 4, timeoutMs: 120000 }
    );

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Gemini response did not contain valid JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    const mealPlan: WeeklyMealPlan = {
      residentId: request.residentId,
      residentName: request.residentName,
      generatedAt: new Date(),
      days: parsed.days || [],
      dietaryNotes: parsed.dietaryNotes || '',
      medicationConsiderations: parsed.medicationConsiderations || [],
      calorieTarget: parsed.calorieTarget || request.calorieTarget || 2000,
      specialDiet: parsed.specialDiet || request.dietaryRestrictions,
    };

    // Cache in memory
    mealPlanCache.set(request.residentId, mealPlan);

    // Save to database (fire and forget — don't block the UI)
    const medCount = request.medications.length;
    mealPlansApi.save(request.residentId, mealPlan, medCount).then(() => {
      console.log(`[MealPlan] ✅ Saved plan to database for ${request.residentName}`);
    }).catch(err => {
      console.warn('[MealPlan] Failed to save to DB (plan still available in memory):', err);
    });

    console.log(`[MealPlan] Generated ${mealPlan.days.length}-day plan for ${request.residentName}`);
    return mealPlan;

  } catch (error: any) {
    console.error('[MealPlan] Generation failed:', error);
    throw new Error('Gemini API failed to generate meal plan: ' + (error.message || 'Unknown error'));
  }
}

/**
 * Regenerate a single meal within an existing plan.
 */
export async function regenerateMeal(
  plan: WeeklyMealPlan,
  dayIndex: number,
  mealType: 'breakfast' | 'morningSnack' | 'lunch' | 'afternoonSnack' | 'dinner',
  reason?: string
): Promise<MealItem> {
  if (!isGeminiEnabled()) {
    throw new Error('Gemini API is not configured');
  }

  const day = plan.days[dayIndex];
  if (!day) throw new Error(`Invalid day index: ${dayIndex}`);

  const currentMeal = day[mealType];
  const medications = plan.medicationConsiderations;

  const prompt = buildMealRegenerationPrompt(
    mealType,
    day.day,
    currentMeal.name,
    medications,
    [],
    reason
  );

  const result = await callWithRetry(
    m => m.generateContent([
      { text: MEAL_PLAN_SYSTEM_PROMPT },
      { text: prompt },
    ]),
    { maxRetries: 4, timeoutMs: 90000 }
  );

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Gemini response did not contain valid JSON');
  }

  const newMeal = JSON.parse(jsonMatch[0]) as MealItem;

  // Update the plan in cache
  day[mealType] = newMeal;

  // Recalculate daily totals
  const meals = [day.breakfast, day.morningSnack, day.lunch, day.afternoonSnack, day.dinner];
  day.totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  day.totalProtein = meals.reduce((s, m) => s + (m.protein || 0), 0);
  day.totalCarbs = meals.reduce((s, m) => s + (m.carbs || 0), 0);
  day.totalFat = meals.reduce((s, m) => s + (m.fat || 0), 0);

  return newMeal;
}

/**
 * Clear the cached meal plan for a resident (to force regeneration).
 * Clears both in-memory cache and the database.
 */
export function clearMealPlanCache(residentId: string): void {
  mealPlanCache.delete(residentId);
  // Also delete from DB (fire and forget)
  mealPlansApi.delete(residentId).catch(() => {
    // Silently ignore — DB delete is best-effort
  });
}

/**
 * Generate a demo meal plan when Gemini is not available.
 */
function generateDemoMealPlan(request: MealPlanRequest): WeeklyMealPlan {
  const plan = createEmptyMealPlan(request.residentId, request.residentName);

  const demoMeals: Record<string, MealItem> = {
    breakfast: {
      name: 'Oatmeal with Fresh Berries',
      description: 'Steel-cut oats topped with blueberries, sliced almonds, and a drizzle of honey',
      calories: 320,
      protein: 10,
      carbs: 55,
      fat: 6,
      fiber: 8,
      rationale: 'Low-glycemic complex carbs for sustained energy',
      warnings: [],
      tags: ['low-glycemic', 'high-fiber'],
    },
    morningSnack: {
      name: 'Greek Yogurt with Walnuts',
      description: 'Plain Greek yogurt with a handful of walnuts and cinnamon',
      calories: 180,
      protein: 15,
      carbs: 12,
      fat: 10,
      fiber: 1,
      rationale: 'High protein snack for stable blood sugar',
      warnings: [],
      tags: ['high-protein'],
    },
    lunch: {
      name: 'Grilled Chicken & Quinoa Bowl',
      description: 'Grilled chicken breast over quinoa with roasted vegetables and lemon-herb dressing',
      calories: 480,
      protein: 35,
      carbs: 45,
      fat: 15,
      fiber: 6,
      rationale: 'Balanced macronutrient profile with lean protein',
      warnings: [],
      tags: ['balanced', 'high-protein'],
    },
    afternoonSnack: {
      name: 'Apple with Almond Butter',
      description: 'Sliced apple with 2 tablespoons of natural almond butter',
      calories: 200,
      protein: 5,
      carbs: 25,
      fat: 10,
      fiber: 5,
      rationale: 'Fiber-rich fruit paired with healthy fats',
      warnings: [],
      tags: ['heart-healthy', 'high-fiber'],
    },
    dinner: {
      name: 'Baked Salmon with Steamed Vegetables',
      description: 'Herb-crusted baked salmon with steamed broccoli, carrots, and brown rice',
      calories: 520,
      protein: 38,
      carbs: 40,
      fat: 20,
      fiber: 7,
      rationale: 'Omega-3 rich fish for heart health and anti-inflammatory benefits',
      warnings: [],
      tags: ['omega-3', 'anti-inflammatory', 'heart-healthy'],
    },
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  plan.days = dayNames.map(day => ({
    day,
    breakfast: { ...demoMeals.breakfast },
    morningSnack: { ...demoMeals.morningSnack },
    lunch: { ...demoMeals.lunch },
    afternoonSnack: { ...demoMeals.afternoonSnack },
    dinner: { ...demoMeals.dinner },
    totalCalories: 1700,
    totalProtein: 103,
    totalCarbs: 177,
    totalFat: 61,
  }));

  plan.dietaryNotes = 'This is a demo meal plan. Configure your Gemini API key in .env for personalized, medication-aware meal planning.';
  plan.medicationConsiderations = request.medications.length > 0
    ? [`Medications detected: ${request.medications.map(m => m.name).join(', ')} — personalized plan requires Gemini API`]
    : ['No medications — standard balanced diet'];
  plan.calorieTarget = request.calorieTarget || 2000;

  return plan;
}
