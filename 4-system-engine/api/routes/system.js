// System Components API routes
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/system/components — List all system components
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM system_components ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('[System] List error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/system/components/:id — Update component status
router.put('/:id', async (req, res) => {
  try {
    const { status, version, description } = req.body;
    const fields = [];
    const values = [];

    if (status) { fields.push('status = ?'); values.push(status); }
    if (version) { fields.push('version = ?'); values.push(version); }
    if (description) { fields.push('description = ?'); values.push(description); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await pool.execute(`UPDATE system_components SET ${fields.join(', ')} WHERE component_id = ?`, values);

    res.json({ message: 'Component updated' });
  } catch (error) {
    console.error('[System] Update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
