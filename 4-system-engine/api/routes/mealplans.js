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

export default router;
