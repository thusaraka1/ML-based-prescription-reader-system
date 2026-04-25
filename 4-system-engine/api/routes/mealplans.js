// Meal Plans API routes
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

/**
 * GET /api/residents/:residentId/meal-plan
 * Retrieve the saved meal plan for a resident.
 */
router.get('/residents/:residentId/meal-plan', async (req, res) => {
  try {
    const { residentId } = req.params;

    const [rows] = await pool.execute(
      'SELECT plan_json, medication_count, generated_at FROM meal_plans WHERE resident_id = ?',
      [residentId]
    );

    if (rows.length === 0) {
      return res.json({ plan: null });
    }

    const row = rows[0];
    const plan = JSON.parse(row.plan_json);
    plan.generatedAt = row.generated_at;

    return res.json({
      plan,
      medicationCount: row.medication_count,
      generatedAt: row.generated_at,
    });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).json({ error: 'Failed to fetch meal plan' });
  }
});

/**
 * POST /api/residents/:residentId/meal-plan
 * Save/update a meal plan for a resident (upsert).
 */
router.post('/residents/:residentId/meal-plan', async (req, res) => {
  try {
    const { residentId } = req.params;
    const { plan, medicationCount } = req.body;

    if (!plan) {
      return res.status(400).json({ error: 'Missing plan data' });
    }

    const planJson = JSON.stringify(plan);

    // Upsert — insert or replace existing plan for this resident
    await pool.execute(
      `INSERT INTO meal_plans (resident_id, plan_json, medication_count, generated_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         plan_json = VALUES(plan_json),
         medication_count = VALUES(medication_count),
         generated_at = NOW()`,
      [residentId, planJson, medicationCount || 0]
    );

    res.json({ message: 'Meal plan saved', residentId });
  } catch (error) {
    console.error('Error saving meal plan:', error);
    res.status(500).json({ error: 'Failed to save meal plan' });
  }
});

/**
 * DELETE /api/residents/:residentId/meal-plan
 * Delete the saved meal plan (to force regeneration).
 */
router.delete('/residents/:residentId/meal-plan', async (req, res) => {
  try {
    const { residentId } = req.params;
    await pool.execute('DELETE FROM meal_plans WHERE resident_id = ?', [residentId]);
    res.json({ message: 'Meal plan deleted', residentId });
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    res.status(500).json({ error: 'Failed to delete meal plan' });
  }
});
/**
 * DRUG-FOOD INTERACTION RULES used by the fallback meal builder.
 */
const DRUG_RULES = [
  { pattern: /warfarin/i, avoid: ['spinach', 'kale'], note: 'Limit vitamin-K-rich greens (maintain consistency for Warfarin therapy)' },
  { pattern: /statin|atorvastatin|rosuvastatin|simvastatin/i, avoid: ['grapefruit'], note: 'Avoid grapefruit — it inhibits statin metabolism' },
  { pattern: /metformin/i, avoid: [], note: 'Prefer low-glycemic foods to support blood-sugar control with Metformin' },
  { pattern: /lisinopril|enalapril|ramipril|ace.?inhibitor|losartan|valsartan/i, avoid: [], note: 'Follow a low-sodium diet for blood-pressure management' },
  { pattern: /levothyroxine/i, avoid: [], note: 'Take Levothyroxine on an empty stomach; avoid calcium/coffee within 4 h' },
  { pattern: /diuretic|furosemide|hydrochlorothiazide/i, avoid: [], note: 'Include potassium-rich foods (banana, orange) to offset diuretic losses' },
  { pattern: /aspirin/i, avoid: [], note: 'Take Aspirin with food to reduce GI irritation' },
  { pattern: /metoprolol|atenolol|propranolol|beta.?blocker/i, avoid: [], note: 'Consistent meal timing supports stable beta-blocker absorption' },
];

/**
 * Build a varied, medication-aware 7-day fallback meal plan.
 */
function buildFallbackPlan(medicationStr) {
  const meds = (medicationStr || '').toLowerCase();

  // Detect applicable drug-food notes
  const clinicalNotes = [];
  DRUG_RULES.forEach(rule => {
    if (rule.pattern.test(meds)) clinicalNotes.push(rule.note);
  });
  if (clinicalNotes.length === 0) {
    clinicalNotes.push(`Plan created for medications: ${medicationStr || 'none specified'}.`);
  }
  clinicalNotes.push('Take medications with meals to reduce stomach upset.');
  clinicalNotes.push('Stay hydrated — aim for 8 glasses of water daily.');

  // 7 unique daily menus
  const weekMenus = [
    // Monday
    [
      { id: 'breakfast', label: 'Breakfast', name: 'Oatmeal with Berries', calories: '350', description: 'Rolled oats with fresh blueberries, honey, and almond milk.', rationale: 'Low-glycemic complex carbs for sustained morning energy.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Apple & Almond Butter', calories: '180', description: 'Sliced apple with a tablespoon of almond butter.', rationale: 'Fibre + healthy fats keep blood sugar stable.' },
      { id: 'lunch', label: 'Lunch', name: 'Grilled Chicken Salad', calories: '420', description: 'Mixed greens, grilled chicken breast, cherry tomatoes, light vinaigrette.', rationale: 'High protein, balanced nutrients for midday energy.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Greek Yogurt', calories: '120', description: 'Plain greek yogurt with a drizzle of honey.', rationale: 'Probiotics support gut health and calcium intake.' },
      { id: 'dinner', label: 'Dinner', name: 'Baked Salmon & Quinoa', calories: '550', description: 'Oven-baked salmon with steamed quinoa and asparagus.', rationale: 'Omega-3 fatty acids reduce inflammation.' },
    ],
    // Tuesday
    [
      { id: 'breakfast', label: 'Breakfast', name: 'Whole-Wheat Pancakes', calories: '380', description: 'Fluffy whole-wheat pancakes with sliced banana and a drizzle of maple syrup.', rationale: 'Complex carbs with potassium-rich banana.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Mixed Nuts', calories: '160', description: 'A small handful of almonds, walnuts, and cashews.', rationale: 'Heart-healthy unsaturated fats.' },
      { id: 'lunch', label: 'Lunch', name: 'Turkey & Avocado Wrap', calories: '450', description: 'Whole-wheat wrap with sliced turkey, avocado, lettuce, and mustard.', rationale: 'Lean protein with heart-healthy monounsaturated fat.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Carrot Sticks & Hummus', calories: '130', description: 'Baby carrots served with classic hummus.', rationale: 'High fibre snack with plant protein.' },
      { id: 'dinner', label: 'Dinner', name: 'Herb-Roasted Chicken & Sweet Potato', calories: '520', description: 'Roasted chicken thigh with baked sweet potato and steamed green beans.', rationale: 'Balanced macros with vitamin A from sweet potato.' },
    ],
    // Wednesday
    [
      { id: 'breakfast', label: 'Breakfast', name: 'Veggie Omelette', calories: '340', description: 'Three-egg omelette with bell peppers, mushrooms, and low-fat cheese.', rationale: 'High protein start supports medication absorption.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Banana & Peanut Butter', calories: '190', description: 'Medium banana with a tablespoon of peanut butter.', rationale: 'Potassium-rich — helpful if taking diuretics.' },
      { id: 'lunch', label: 'Lunch', name: 'Lentil Soup & Whole-Grain Roll', calories: '400', description: 'Hearty red lentil soup with a crusty whole-grain roll.', rationale: 'Plant protein and iron with high fibre.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Cottage Cheese & Pineapple', calories: '140', description: 'Low-fat cottage cheese topped with pineapple chunks.', rationale: 'Calcium and vitamin C without excessive sodium.' },
      { id: 'dinner', label: 'Dinner', name: 'Grilled Tilapia & Brown Rice', calories: '480', description: 'Seasoned grilled tilapia served with brown rice and sautéed spinach.', rationale: 'Lean fish provides protein without saturated fat.' },
    ],
    // Thursday
    [
      { id: 'breakfast', label: 'Breakfast', name: 'Smoothie Bowl', calories: '360', description: 'Blended mango, banana, and yogurt topped with granola and chia seeds.', rationale: 'Antioxidant-rich start with omega-3 from chia.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Rice Cakes & Avocado', calories: '170', description: 'Two rice cakes topped with mashed avocado and a pinch of sea salt.', rationale: 'Low-sodium snack with heart-healthy fats.' },
      { id: 'lunch', label: 'Lunch', name: 'Chicken Stir-Fry', calories: '440', description: 'Chicken breast stir-fried with broccoli, bell peppers, and low-sodium soy sauce over jasmine rice.', rationale: 'Balanced meal with lean protein and vegetables.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Orange Slices', calories: '90', description: 'Two medium oranges, peeled and segmented.', rationale: 'Vitamin C supports immune function.' },
      { id: 'dinner', label: 'Dinner', name: 'Beef & Vegetable Stew', calories: '530', description: 'Slow-cooked lean beef with potatoes, carrots, celery, and herbs.', rationale: 'Iron-rich meal with root vegetables for sustained energy.' },
    ],
    // Friday
    [
      { id: 'breakfast', label: 'Breakfast', name: 'Avocado Toast & Egg', calories: '370', description: 'Whole-grain toast topped with mashed avocado and a poached egg.', rationale: 'Healthy fats and protein for morning medication absorption.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Trail Mix', calories: '175', description: 'Mix of dried cranberries, sunflower seeds, and dark chocolate chips.', rationale: 'Antioxidants from dark chocolate, iron from seeds.' },
      { id: 'lunch', label: 'Lunch', name: 'Mediterranean Grain Bowl', calories: '460', description: 'Farro with chickpeas, cucumber, tomato, feta, and olive oil lemon dressing.', rationale: 'Mediterranean diet linked to cardiovascular benefits.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Celery & Cream Cheese', calories: '110', description: 'Celery sticks filled with light cream cheese.', rationale: 'Low-calorie snack that keeps you full.' },
      { id: 'dinner', label: 'Dinner', name: 'Shrimp Pasta Primavera', calories: '510', description: 'Whole-wheat pasta with sautéed shrimp, zucchini, tomatoes, and garlic olive oil.', rationale: 'Lean seafood protein with complex carbs.' },
    ],
    // Saturday
    [
      { id: 'breakfast', label: 'Breakfast', name: 'Blueberry Muffin & Yogurt', calories: '330', description: 'Homemade whole-wheat blueberry muffin with a side of plain yogurt.', rationale: 'Antioxidants from blueberries support overall health.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Edamame', calories: '150', description: 'Steamed edamame pods lightly salted.', rationale: 'Plant protein and fibre from soy beans.' },
      { id: 'lunch', label: 'Lunch', name: 'Tuna Salad Sandwich', calories: '430', description: 'Whole-grain bread with tuna, light mayo, lettuce, and tomato.', rationale: 'Omega-3 from tuna supports brain and heart health.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Pear Slices', calories: '100', description: 'One ripe pear, sliced.', rationale: 'High fibre fruit that is gentle on digestion.' },
      { id: 'dinner', label: 'Dinner', name: 'Grilled Lamb Chop & Couscous', calories: '540', description: 'Herb-marinated lamb chop with fluffy couscous and roasted vegetables.', rationale: 'Iron and zinc from lamb support immune function.' },
    ],
    // Sunday
    [
      { id: 'breakfast', label: 'Breakfast', name: 'French Toast', calories: '380', description: 'Whole-wheat french toast with mixed berries and a dusting of cinnamon.', rationale: 'Cinnamon may support healthy blood-sugar levels.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Peach & Cottage Cheese', calories: '140', description: 'Sliced peach with a scoop of low-fat cottage cheese.', rationale: 'Calcium and vitamin A in a light snack.' },
      { id: 'lunch', label: 'Lunch', name: 'Veggie Burger & Side Salad', calories: '440', description: 'Grilled veggie patty on a whole-grain bun with a side garden salad.', rationale: 'Plant-based protein with high fibre.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Dark Chocolate Square', calories: '100', description: 'Two squares of 70% dark chocolate.', rationale: 'Rich in flavonoids that support cardiovascular health.' },
      { id: 'dinner', label: 'Dinner', name: 'Baked Cod & Roasted Potatoes', calories: '500', description: 'Lemon-herb baked cod with roasted baby potatoes and steamed broccoli.', rationale: 'Low-fat white fish with potassium-rich potatoes.' },
    ],
  ];

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const days = {};
  dayNames.forEach((d, i) => { days[d] = { meals: weekMenus[i] }; });

  return {
    clinicalNotes,
    nutrition: { calories: 1620, protein: '85g', carbs: '165g', fat: '48g' },
    days,
  };
}

/**
 * Clinical nutritionist system prompt (mirrors the web app's MealPlanEngine).
 */
const SYSTEM_PROMPT = `You are a certified clinical nutritionist and registered dietitian with expertise in drug-food interactions and therapeutic nutrition.

KEY PRINCIPLES:
1. SAFETY FIRST — Never suggest foods with dangerous interactions with the patient's medications
2. Ensure adequate caloric intake (roughly 1600-2000 kcal/day for elderly patients)
3. Balance macronutrients (protein, carbs, fats) across all meals
4. Infer the patient's likely underlying medical conditions from their medications
5. Include diverse, practical meal options — every day should be DIFFERENT

CRITICAL DRUG-FOOD INTERACTIONS:
- Warfarin: Limit vitamin K foods (spinach, kale, broccoli) — maintain consistency
- Metformin: Prefer low-glycemic foods, avoid refined sugars
- Lisinopril/ACE Inhibitors: Low sodium diet, moderate potassium
- Statins (Atorvastatin, etc.): Avoid grapefruit and grapefruit juice
- Levothyroxine: Avoid calcium-rich foods and coffee within 4 hours of dosing
- Diuretics: May need potassium-rich foods (bananas, oranges) unless potassium-sparing
- Aspirin: Take with food to reduce GI irritation`;

/**
 * POST /api/generate-meal-plan
 * Use Gemini to generate a therapeutic meal plan based on medications.
 * Always returns a valid plan (falls back to a default if Gemini fails).
 */
router.post('/generate-meal-plan', async (req, res) => {
  try {
    const { prompt, medications } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // Try Gemini
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[MealPlan] No Gemini API key — returning fallback plan');
      return res.json({ plan: buildFallbackPlan(medications), source: 'fallback' });
    }

    let plan = null;

    // Use gemini-2.5-flash (current supported model), with gemini-2.5-pro as fallback
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro'];

    for (const modelName of modelsToTry) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: SYSTEM_PROMPT,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.8,
          },
        });

        console.log(`[MealPlan] Trying model: ${modelName}...`);

        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 90000)),
        ]);

        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn(`[MealPlan] ${modelName}: Could not find JSON in response`);
          continue;
        }

        const raw = JSON.parse(jsonMatch[0]);
        console.log(`[MealPlan] ${modelName} raw keys:`, Object.keys(raw).join(', '));
        plan = normalizePlan(raw, medications);
        const dayCount = Object.keys(plan.days || {}).length;
        console.log(`[MealPlan] ✅ Normalized plan: ${dayCount} days using ${modelName}`);
        
        // If normalization produced too few days, try next model
        if (dayCount < 3) {
          console.warn(`[MealPlan] ${modelName}: Only ${dayCount} days normalized — trying next model`);
          plan = null;
          continue;
        }
        break; // success — stop trying models
      } catch (modelErr) {
        console.warn(`[MealPlan] ${modelName} failed: ${modelErr.message}`);
      }
    }

    if (plan && Object.keys(plan.days || {}).length >= 3) {
      return res.json({ plan, source: 'gemini' });
    }

    // All models failed — return fallback
    console.warn('[MealPlan] All Gemini models failed — returning fallback plan');
    return res.json({ plan: buildFallbackPlan(medications), source: 'fallback' });
  } catch (error) {
    console.error('[MealPlan] Generation error:', error.message);
    // Even on unexpected errors, return a fallback plan so the client always gets data
    return res.json({ plan: buildFallbackPlan(req.body?.medications), source: 'fallback' });
  }
});

/**
 * Normalize any Gemini response into the mobile app's expected format.
 * Handles: days as array or object, various meal field names, missing top-level keys.
 */
function normalizePlan(raw, medicationStr) {
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const FULL_TO_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
  const MEAL_ORDER = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'];
  const MEAL_LABELS = { breakfast: 'Breakfast', morningSnack: 'Morning Snack', lunch: 'Lunch', afternoonSnack: 'Afternoon Snack', dinner: 'Dinner' };

  // Normalize a single meal object into the mobile app format
  function normMeal(m, fallbackId) {
    const id = m.id || fallbackId || 'meal';
    return {
      id,
      label: m.label || MEAL_LABELS[id] || m.type || m.mealType || id,
      name: m.name || m.title || m.description?.split('.')[0]?.substring(0, 40) || 'Meal',
      calories: String(m.calories || m.kcal || '—'),
      description: m.description || m.details || '',
      rationale: m.rationale || m.reason || m.notes || '',
    };
  }

  // Normalize days
  let days = {};

  if (raw.days) {
    if (Array.isArray(raw.days)) {
      // days is an array like [{ day: "Monday", breakfast: {...}, ... }]
      raw.days.forEach((dayObj, idx) => {
        const dayKey = FULL_TO_SHORT[dayObj.day] || DAY_NAMES[idx] || `Day${idx}`;
        const meals = [];
        // Check if meals are in a "meals" array or as direct properties
        if (dayObj.meals && Array.isArray(dayObj.meals)) {
          dayObj.meals.forEach((m, mi) => meals.push(normMeal(m, MEAL_ORDER[mi])));
        } else {
          MEAL_ORDER.forEach(slot => {
            if (dayObj[slot]) meals.push(normMeal(dayObj[slot], slot));
          });
        }
        // Pad to 5 meals if needed
        while (meals.length < 5) {
          const slot = MEAL_ORDER[meals.length];
          meals.push({ id: slot, label: MEAL_LABELS[slot], name: '—', calories: '—', description: '', rationale: '' });
        }
        days[dayKey] = { meals };
      });
    } else {
      // days is an object like { Mon: { meals: [...] } } or { Mon: { breakfast: {...} } }
      for (const [key, val] of Object.entries(raw.days)) {
        const dayKey = FULL_TO_SHORT[key] || key;
        const meals = [];
        if (val.meals && Array.isArray(val.meals)) {
          val.meals.forEach((m, mi) => meals.push(normMeal(m, MEAL_ORDER[mi])));
        } else {
          MEAL_ORDER.forEach(slot => {
            if (val[slot]) meals.push(normMeal(val[slot], slot));
          });
        }
        while (meals.length < 5) {
          const slot = MEAL_ORDER[meals.length];
          meals.push({ id: slot, label: MEAL_LABELS[slot], name: '—', calories: '—', description: '', rationale: '' });
        }
        days[dayKey] = { meals };
      }
    }
  }

  // Also handle case where day keys are at the top level (Mon/Monday directly on raw)
  if (Object.keys(days).length === 0) {
    for (const fullName of Object.keys(FULL_TO_SHORT)) {
      if (raw[fullName]) {
        const dayKey = FULL_TO_SHORT[fullName];
        const val = raw[fullName];
        const meals = [];
        if (val.meals && Array.isArray(val.meals)) {
          val.meals.forEach((m, mi) => meals.push(normMeal(m, MEAL_ORDER[mi])));
        } else {
          MEAL_ORDER.forEach(slot => { if (val[slot]) meals.push(normMeal(val[slot], slot)); });
        }
        while (meals.length < 5) {
          const slot = MEAL_ORDER[meals.length];
          meals.push({ id: slot, label: MEAL_LABELS[slot], name: '—', calories: '—', description: '', rationale: '' });
        }
        days[dayKey] = { meals };
      }
    }
    // Also check short names
    for (const short of DAY_NAMES) {
      if (raw[short] && !days[short]) {
        const val = raw[short];
        const meals = [];
        if (val.meals && Array.isArray(val.meals)) {
          val.meals.forEach((m, mi) => meals.push(normMeal(m, MEAL_ORDER[mi])));
        } else {
          MEAL_ORDER.forEach(slot => { if (val[slot]) meals.push(normMeal(val[slot], slot)); });
        }
        while (meals.length < 5) {
          const slot = MEAL_ORDER[meals.length];
          meals.push({ id: slot, label: MEAL_LABELS[slot], name: '—', calories: '—', description: '', rationale: '' });
        }
        days[short] = { meals };
      }
    }
  }

  // Clinical notes
  let clinicalNotes = raw.clinicalNotes || raw.clinical_notes || raw.dietaryNotes || raw.notes || [];
  if (typeof clinicalNotes === 'string') clinicalNotes = [clinicalNotes];
  if (raw.medicationConsiderations) {
    const mc = Array.isArray(raw.medicationConsiderations) ? raw.medicationConsiderations : [raw.medicationConsiderations];
    clinicalNotes = [...clinicalNotes, ...mc];
  }
  if (clinicalNotes.length === 0) {
    clinicalNotes = [`AI-generated plan for: ${medicationStr || 'your medications'}.`];
  }

  // Nutrition
  const nutrition = raw.nutrition || {
    calories: raw.calorieTarget || 1800,
    protein: raw.totalProtein || '85g',
    carbs: raw.totalCarbs || '180g',
    fat: raw.totalFat || '50g',
  };

  return { clinicalNotes, nutrition, days };
}

export default router;
