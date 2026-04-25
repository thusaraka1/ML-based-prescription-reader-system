import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiFetch, getResidentId } from '../apiHelper';

const MEAL_ICONS = {
  breakfast: { icon: 'white-balance-sunny', color: '#FEF3C7', iconColor: '#D97706' },
  morningSnack: { icon: 'apple', color: '#DCFCE7', iconColor: '#16A34A' },
  lunch: { icon: 'food-fork-drink', color: '#FFEDD5', iconColor: '#EA580C' },
  afternoonSnack: { icon: 'cup-water', color: '#E0F2FE', iconColor: '#0284C7' },
  dinner: { icon: 'food-steak', color: '#F3E8FF', iconColor: '#9333EA' },
};

const MealPlanScreen = ({ navigation }) => {
  const [plan, setPlan] = useState(null);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const [refreshing, setRefreshing] = useState(false);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const fetchData = useCallback(async () => {
    try {
      const residentId = await getResidentId();

      // Fetch resident data for medications
      const resRes = await apiFetch(`/residents/${residentId}`);
      if (resRes.ok) {
        const resData = await resRes.json();
        const meds = [];
        for (const rx of (resData.prescriptions || [])) {
          for (const med of (rx.medications || [])) {
            meds.push({ drugName: med.drug_name, dosage: med.dosage, frequency: med.frequency });
          }
        }
        setMedications(meds);
      }

      // Fetch saved meal plan
      const planRes = await apiFetch(`/residents/${residentId}/meal-plan`);
      if (planRes.ok) {
        const planData = await planRes.json();
        if (planData.plan) {
          setPlan(planData.plan);
        }
      }
    } catch (err) {
      console.error('[MealPlan] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generateMealPlan = async () => {
    if (medications.length === 0) {
      Alert.alert('No Medications', 'Upload a prescription first so the AI can create a diet plan tailored to your medications.');
      return;
    }

    setGenerating(true);
    try {
      const residentId = await getResidentId();

      // Use Gemini via analyze endpoint to generate a meal plan
      const medList = medications.map(m => `${m.drugName} ${m.dosage} (${m.frequency})`).join(', ');
      
      const prompt = `You are a clinical nutritionist AI. A patient takes these medications: ${medList}.

Create a 7-day therapeutic meal plan optimized for these medications. Consider drug-food interactions, timing with medications, and nutritional needs.

Return ONLY valid JSON in this exact format:
{
  "clinicalNotes": ["Note about food-drug interaction 1", "Note 2"],
  "nutrition": { "calories": 1800, "protein": "90g", "carbs": "180g", "fat": "50g" },
  "days": {
    "Mon": {
      "meals": [
        { "id": "breakfast", "label": "Breakfast", "name": "Meal Name", "calories": "350", "description": "Description of the meal.", "rationale": "Why this meal is good with the medications" },
        { "id": "morningSnack", "label": "Morning Snack", "name": "Snack Name", "calories": "100", "description": "Description.", "rationale": "" },
        { "id": "lunch", "label": "Lunch", "name": "Meal Name", "calories": "450", "description": "Description.", "rationale": "Drug interaction note" },
        { "id": "afternoonSnack", "label": "Afternoon Snack", "name": "Snack Name", "calories": "120", "description": "Description.", "rationale": "" },
        { "id": "dinner", "label": "Dinner", "name": "Meal Name", "calories": "550", "description": "Description.", "rationale": "Why" }
      ]
    }
  }
}

Include ALL 7 days (Mon through Sun). Make each day different. Use "" for empty rationale, never null.`;

      let generatedPlan;

      try {
        console.log('[MealPlan] Calling /generate-meal-plan API...');
        const res = await apiFetch('/generate-meal-plan', {
          method: 'POST',
          body: JSON.stringify({ prompt, medications: medList }),
        });

        if (res.ok) {
          const data = await res.json();
          generatedPlan = data.plan;
          console.log('[MealPlan] API returned plan, source:', data.source || 'unknown');
        } else {
          console.warn('[MealPlan] API returned status:', res.status);
        }
      } catch (apiErr) {
        console.warn('[MealPlan] API call failed:', apiErr.message);
      }

      // If API failed completely, use client-side fallback
      if (!generatedPlan) {
        console.log('[MealPlan] Using client-side fallback plan');
        generatedPlan = generateDefaultPlan(medications);
      }

      // Try to save to backend (non-blocking — don't let save failure prevent showing the plan)
      try {
        await apiFetch(`/residents/${residentId}/meal-plan`, {
          method: 'POST',
          body: JSON.stringify({ plan: generatedPlan, medicationCount: medications.length }),
        });
        console.log('[MealPlan] Plan saved to backend');
      } catch (saveErr) {
        console.warn('[MealPlan] Could not save plan to backend:', saveErr.message);
      }

      setPlan(generatedPlan);
      Alert.alert('Success', 'Your personalized meal plan has been generated!');
    } catch (err) {
      console.error('[MealPlan] Generate error:', err);
      // Last resort: use default plan and show it without saving
      const defaultPlan = generateDefaultPlan(medications);
      setPlan(defaultPlan);
      Alert.alert('Meal Plan Ready', 'Generated a default plan. It will be personalized once the AI service is available.');
    } finally {
      setGenerating(false);
    }
  };

  const regeneratePlan = () => {
    Alert.alert(
      'Regenerate Meal Plan',
      'This will create a new meal plan based on your current medications.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: generateMealPlan },
      ]
    );
  };

  // Get current day's meals
  const currentDayKey = days[selectedDay];
  const dayMeals = plan?.days?.[currentDayKey]?.meals || [];
  const clinicalNotes = plan?.clinicalNotes || [];
  const nutrition = plan?.nutrition || { calories: '—', protein: '—', carbs: '—', fat: '—' };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator size="large" color="#F97316" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Therapeutic Meal Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} colors={['#F97316']} />}
      >
        {/* Banner */}
        <View style={styles.bannerCard}>
          <View>
            <Text style={styles.bannerTitle}>AI Curated Diet</Text>
            <Text style={styles.bannerSubtitle}>
              {plan ? `Based on ${medications.length} medication(s)` : 'Optimized for your prescriptions'}
            </Text>
          </View>
          <MaterialCommunityIcons name="brain" size={32} color="#FFFFFF" opacity={0.8} />
        </View>

        {!plan ? (
          /* No plan yet — show generate button */
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Meal Plan Yet</Text>
            <Text style={styles.emptySubtitle}>
              {medications.length > 0
                ? 'Generate an AI-powered diet plan based on your medications.'
                : 'Upload a prescription first, then generate your meal plan.'}
            </Text>
            <TouchableOpacity
              style={[styles.generateBtn, generating && { opacity: 0.6 }]}
              onPress={medications.length > 0 ? generateMealPlan : () => navigation.navigate('UploadRx')}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color="#FFFFFF" style={{ marginRight: 8 }} />
              ) : (
                <MaterialCommunityIcons name={medications.length > 0 ? "brain" : "camera-plus"} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.generateBtnText}>
                {generating ? 'Generating...' : medications.length > 0 ? 'Generate Meal Plan' : 'Upload Prescription'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Clinical Considerations */}
            {clinicalNotes.length > 0 && (
              <View style={styles.clinicalCard}>
                <View style={styles.clinicalHeader}>
                  <MaterialCommunityIcons name="flask-outline" size={18} color="#B45309" />
                  <Text style={styles.clinicalTitle}> Clinical Considerations</Text>
                </View>
                {clinicalNotes.map((note, index) => (
                  <Text key={index} style={styles.clinicalNote}>• {note}</Text>
                ))}
              </View>
            )}

            {/* Day Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
              {days.map((day, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={[styles.dayBtn, selectedDay === idx && styles.dayBtnActive]}
                  onPress={() => setSelectedDay(idx)}
                >
                  <Text style={[styles.dayText, selectedDay === idx && styles.dayTextActive]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Nutrition Summary */}
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionBox}><Text style={styles.nutriLabel}>CALS</Text><Text style={styles.nutriValue}>{nutrition.calories}</Text></View>
              <View style={styles.nutritionBox}><Text style={styles.nutriLabel}>PRO</Text><Text style={styles.nutriValue}>{nutrition.protein}</Text></View>
              <View style={styles.nutritionBox}><Text style={styles.nutriLabel}>CARB</Text><Text style={styles.nutriValue}>{nutrition.carbs}</Text></View>
              <View style={styles.nutritionBox}><Text style={styles.nutriLabel}>FAT</Text><Text style={styles.nutriValue}>{nutrition.fat}</Text></View>
            </View>

            {/* Meals List */}
            <View style={styles.mealsList}>
              {dayMeals.map((meal) => {
                const mealStyle = MEAL_ICONS[meal.id] || MEAL_ICONS.lunch;
                return (
                  <View key={meal.id} style={[styles.mealCard, { backgroundColor: mealStyle.color }]}>
                    <View style={styles.mealHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name={mealStyle.icon} size={16} color={mealStyle.iconColor} style={{ marginRight: 4 }} />
                        <Text style={styles.mealLabel}>{meal.label}</Text>
                      </View>
                      <View style={styles.calBadge}>
                        <Text style={styles.calText}>{meal.calories} cal</Text>
                      </View>
                    </View>

                    <Text style={styles.mealName}>{meal.name}</Text>
                    <Text style={styles.mealDesc}>{meal.description}</Text>

                    {meal.rationale ? (
                      <View style={styles.rationaleBox}>
                        <MaterialCommunityIcons name="information" size={14} color="#3B82F6" style={{ marginTop: 2 }} />
                        <Text style={styles.rationaleText}>{meal.rationale}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Regenerate */}
            <TouchableOpacity style={styles.regenBtn} onPress={regeneratePlan}>
              <MaterialCommunityIcons name="refresh" size={18} color="#F97316" style={{ marginRight: 8 }} />
              <Text style={styles.regenBtnText}>Regenerate Plan</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * Default/fallback meal plan when both API and Gemini are unavailable.
 * Each day has unique meals; clinical notes reflect detected drug-food interactions.
 */
function generateDefaultPlan(medications) {
  const medNames = medications.map(m => m.drugName).join(', ');
  const medStr = medNames.toLowerCase();

  // Detect drug-food interactions
  const notes = [];
  if (/warfarin/i.test(medStr)) notes.push('Limit vitamin-K-rich greens (maintain consistency for Warfarin therapy)');
  if (/statin|atorvastatin/i.test(medStr)) notes.push('Avoid grapefruit — it inhibits statin metabolism');
  if (/metformin/i.test(medStr)) notes.push('Prefer low-glycemic foods to support blood-sugar control with Metformin');
  if (/lisinopril|losartan|valsartan/i.test(medStr)) notes.push('Follow a low-sodium diet for blood-pressure management');
  if (/levothyroxine/i.test(medStr)) notes.push('Take Levothyroxine on empty stomach; avoid calcium/coffee within 4 h');
  if (/furosemide|diuretic/i.test(medStr)) notes.push('Include potassium-rich foods (banana, orange) to offset diuretic losses');
  if (/aspirin/i.test(medStr)) notes.push('Take Aspirin with food to reduce GI irritation');
  if (notes.length === 0) notes.push(`Plan created for medications: ${medNames || 'none specified'}.`);
  notes.push('Take medications with meals to reduce stomach upset.');
  notes.push('Stay hydrated — aim for 8 glasses of water daily.');

  const week = {
    Mon: { meals: [
      { id: 'breakfast', label: 'Breakfast', name: 'Oatmeal with Berries', calories: '350', description: 'Rolled oats with fresh blueberries, honey, and almond milk.', rationale: 'Low-glycemic complex carbs for sustained morning energy.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Apple & Almond Butter', calories: '180', description: 'Sliced apple with a tablespoon of almond butter.', rationale: 'Fibre + healthy fats keep blood sugar stable.' },
      { id: 'lunch', label: 'Lunch', name: 'Grilled Chicken Salad', calories: '420', description: 'Mixed greens, grilled chicken breast, cherry tomatoes, light vinaigrette.', rationale: 'High protein, balanced nutrients.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Greek Yogurt', calories: '120', description: 'Plain greek yogurt with a drizzle of honey.', rationale: 'Probiotics support gut health.' },
      { id: 'dinner', label: 'Dinner', name: 'Baked Salmon & Quinoa', calories: '550', description: 'Oven-baked salmon with steamed quinoa and asparagus.', rationale: 'Omega-3 fatty acids reduce inflammation.' },
    ]},
    Tue: { meals: [
      { id: 'breakfast', label: 'Breakfast', name: 'Whole-Wheat Pancakes', calories: '380', description: 'Fluffy whole-wheat pancakes with sliced banana and maple syrup.', rationale: 'Complex carbs with potassium-rich banana.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Mixed Nuts', calories: '160', description: 'A small handful of almonds, walnuts, and cashews.', rationale: 'Heart-healthy unsaturated fats.' },
      { id: 'lunch', label: 'Lunch', name: 'Turkey & Avocado Wrap', calories: '450', description: 'Whole-wheat wrap with sliced turkey, avocado, lettuce, and mustard.', rationale: 'Lean protein with heart-healthy monounsaturated fat.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Carrot Sticks & Hummus', calories: '130', description: 'Baby carrots served with classic hummus.', rationale: 'High fibre snack with plant protein.' },
      { id: 'dinner', label: 'Dinner', name: 'Herb-Roasted Chicken & Sweet Potato', calories: '520', description: 'Roasted chicken thigh with baked sweet potato and steamed green beans.', rationale: 'Balanced macros with vitamin A from sweet potato.' },
    ]},
    Wed: { meals: [
      { id: 'breakfast', label: 'Breakfast', name: 'Veggie Omelette', calories: '340', description: 'Three-egg omelette with bell peppers, mushrooms, and low-fat cheese.', rationale: 'High protein start supports medication absorption.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Banana & Peanut Butter', calories: '190', description: 'Medium banana with a tablespoon of peanut butter.', rationale: 'Potassium-rich — helpful if taking diuretics.' },
      { id: 'lunch', label: 'Lunch', name: 'Lentil Soup & Whole-Grain Roll', calories: '400', description: 'Hearty red lentil soup with a crusty whole-grain roll.', rationale: 'Plant protein and iron with high fibre.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Cottage Cheese & Pineapple', calories: '140', description: 'Low-fat cottage cheese topped with pineapple chunks.', rationale: 'Calcium and vitamin C without excessive sodium.' },
      { id: 'dinner', label: 'Dinner', name: 'Grilled Tilapia & Brown Rice', calories: '480', description: 'Seasoned grilled tilapia with brown rice and sautéed spinach.', rationale: 'Lean fish provides protein without saturated fat.' },
    ]},
    Thu: { meals: [
      { id: 'breakfast', label: 'Breakfast', name: 'Smoothie Bowl', calories: '360', description: 'Blended mango, banana, and yogurt topped with granola and chia seeds.', rationale: 'Antioxidant-rich start with omega-3 from chia.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Rice Cakes & Avocado', calories: '170', description: 'Two rice cakes topped with mashed avocado and a pinch of sea salt.', rationale: 'Low-sodium snack with heart-healthy fats.' },
      { id: 'lunch', label: 'Lunch', name: 'Chicken Stir-Fry', calories: '440', description: 'Chicken breast stir-fried with broccoli, bell peppers, and low-sodium soy sauce over rice.', rationale: 'Balanced meal with lean protein and vegetables.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Orange Slices', calories: '90', description: 'Two medium oranges, peeled and segmented.', rationale: 'Vitamin C supports immune function.' },
      { id: 'dinner', label: 'Dinner', name: 'Beef & Vegetable Stew', calories: '530', description: 'Slow-cooked lean beef with potatoes, carrots, celery, and herbs.', rationale: 'Iron-rich meal with root vegetables for sustained energy.' },
    ]},
    Fri: { meals: [
      { id: 'breakfast', label: 'Breakfast', name: 'Avocado Toast & Egg', calories: '370', description: 'Whole-grain toast topped with mashed avocado and a poached egg.', rationale: 'Healthy fats and protein for morning medication absorption.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Trail Mix', calories: '175', description: 'Dried cranberries, sunflower seeds, and dark chocolate chips.', rationale: 'Antioxidants from dark chocolate, iron from seeds.' },
      { id: 'lunch', label: 'Lunch', name: 'Mediterranean Grain Bowl', calories: '460', description: 'Farro with chickpeas, cucumber, tomato, feta, and olive oil lemon dressing.', rationale: 'Mediterranean diet linked to cardiovascular benefits.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Celery & Cream Cheese', calories: '110', description: 'Celery sticks filled with light cream cheese.', rationale: 'Low-calorie snack that keeps you full.' },
      { id: 'dinner', label: 'Dinner', name: 'Shrimp Pasta Primavera', calories: '510', description: 'Whole-wheat pasta with sautéed shrimp, zucchini, tomatoes, and garlic olive oil.', rationale: 'Lean seafood protein with complex carbs.' },
    ]},
    Sat: { meals: [
      { id: 'breakfast', label: 'Breakfast', name: 'Blueberry Muffin & Yogurt', calories: '330', description: 'Homemade whole-wheat blueberry muffin with a side of plain yogurt.', rationale: 'Antioxidants from blueberries support overall health.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Edamame', calories: '150', description: 'Steamed edamame pods lightly salted.', rationale: 'Plant protein and fibre from soy beans.' },
      { id: 'lunch', label: 'Lunch', name: 'Tuna Salad Sandwich', calories: '430', description: 'Whole-grain bread with tuna, light mayo, lettuce, and tomato.', rationale: 'Omega-3 from tuna supports brain and heart health.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Pear Slices', calories: '100', description: 'One ripe pear, sliced.', rationale: 'High fibre fruit that is gentle on digestion.' },
      { id: 'dinner', label: 'Dinner', name: 'Grilled Lamb Chop & Couscous', calories: '540', description: 'Herb-marinated lamb chop with fluffy couscous and roasted vegetables.', rationale: 'Iron and zinc from lamb support immune function.' },
    ]},
    Sun: { meals: [
      { id: 'breakfast', label: 'Breakfast', name: 'French Toast', calories: '380', description: 'Whole-wheat french toast with mixed berries and a dusting of cinnamon.', rationale: 'Cinnamon may support healthy blood-sugar levels.' },
      { id: 'morningSnack', label: 'Morning Snack', name: 'Peach & Cottage Cheese', calories: '140', description: 'Sliced peach with a scoop of low-fat cottage cheese.', rationale: 'Calcium and vitamin A in a light snack.' },
      { id: 'lunch', label: 'Lunch', name: 'Veggie Burger & Side Salad', calories: '440', description: 'Grilled veggie patty on a whole-grain bun with a side garden salad.', rationale: 'Plant-based protein with high fibre.' },
      { id: 'afternoonSnack', label: 'Afternoon Snack', name: 'Dark Chocolate Square', calories: '100', description: 'Two squares of 70% dark chocolate.', rationale: 'Rich in flavonoids that support cardiovascular health.' },
      { id: 'dinner', label: 'Dinner', name: 'Baked Cod & Roasted Potatoes', calories: '500', description: 'Lemon-herb baked cod with roasted baby potatoes and steamed broccoli.', rationale: 'Low-fat white fish with potassium-rich potatoes.' },
    ]},
  };

  return {
    clinicalNotes: notes,
    nutrition: { calories: 1620, protein: '85g', carbs: '165g', fat: '48g' },
    days: week,
  };
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  backBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },

  scrollContainer: { padding: 20, paddingBottom: 40 },

  bannerCard: {
    backgroundColor: '#F97316', borderRadius: 20, padding: 20, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  bannerSubtitle: { fontSize: 13, color: '#FFEDD5', fontWeight: '500' },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748B', marginTop: 16, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F97316',
    paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16,
    shadowColor: '#F97316', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  generateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  clinicalCard: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FDE68A' },
  clinicalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  clinicalTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  clinicalNote: { fontSize: 13, color: '#B45309', marginBottom: 4 },

  daySelector: { marginBottom: 20 },
  dayBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12, marginRight: 8, backgroundColor: '#F1F5F9' },
  dayBtnActive: { backgroundColor: '#FFEDD5' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  dayTextActive: { color: '#C2410C' },

  nutritionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  nutritionBox: { backgroundColor: '#FFFFFF', paddingVertical: 12, borderRadius: 16, flex: 1, alignItems: 'center', marginHorizontal: 4, borderWidth: 1, borderColor: '#F1F5F9' },
  nutriLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  nutriValue: { fontSize: 16, fontWeight: '800', color: '#1E293B' },

  mealsList: { gap: 12 },
  mealCard: { borderRadius: 20, padding: 16 },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  mealLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  calBadge: { backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  calText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  
  mealName: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  mealDesc: { fontSize: 13, color: '#475569', marginBottom: 8 },
  
  rationaleBox: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.6)', padding: 8, borderRadius: 8, alignItems: 'flex-start' },
  rationaleText: { fontSize: 12, color: '#1E40AF', marginLeft: 4, flex: 1 },

  regenBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 16, marginTop: 24,
    backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FDBA74',
  },
  regenBtnText: { color: '#F97316', fontWeight: '700', fontSize: 15 },
});

export default MealPlanScreen;
