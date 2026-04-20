// Emotional States API routes
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/residents/:residentId/emotions — Get emotional state history
router.get('/residents/:residentId/emotions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const [rows] = await pool.execute(
      'SELECT * FROM emotional_states WHERE resident_id = ? ORDER BY recorded_at DESC LIMIT ?',
      [req.params.residentId, limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('[Emotions] List error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/emotions — Record a new emotional state
router.post('/emotions', async (req, res) => {
  try {
    const { residentId, stateScore, emotionLabel, category, relatedMedicine, note } = req.body;

    if (!residentId || stateScore === undefined) {
      return res.status(400).json({ error: 'residentId and stateScore are required' });
    }

    if (stateScore < 0 || stateScore > 100) {
      return res.status(400).json({ error: 'stateScore must be between 0 and 100' });
    }

    // Try inserting with extended columns first
    let result;
    try {
      [result] = await pool.execute(
        'INSERT INTO emotional_states (resident_id, state_score, emotion_label, category, related_medicine, note) VALUES (?, ?, ?, ?, ?, ?)',
        [residentId, stateScore, emotionLabel || null, category || null, relatedMedicine || null, note || null]
      );
    } catch (colErr) {
      // If the extra columns don't exist yet, fall back to basic insert
      console.warn('[Emotions] Extended columns not available, using basic insert:', colErr.message);
      [result] = await pool.execute(
        'INSERT INTO emotional_states (resident_id, state_score) VALUES (?, ?)',
        [residentId, stateScore]
      );
    }

    res.status(201).json({
      message: 'Emotional state recorded',
      id: result.insertId,
      residentId,
      stateScore,
      emotionLabel: emotionLabel || null,
      category: category || null,
      relatedMedicine: relatedMedicine || null,
    });
  } catch (error) {
    console.error('[Emotions] Record error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;

