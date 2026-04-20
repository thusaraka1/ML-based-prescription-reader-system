// Users API routes
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// POST /api/users — Create a new user profile
router.post('/', async (req, res) => {
  try {
    const { uid, name, email, role, residentId } = req.body;

    if (!uid || !name || !email || !role) {
      return res.status(400).json({ error: 'uid, name, email, and role are required' });
    }

    await pool.execute(
      'INSERT INTO users (id, name, email, role, resident_id) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), role=VALUES(role), resident_id=VALUES(resident_id)',
      [uid, name, email, role, residentId || null]
    );

    res.status(201).json({ message: 'User created', uid });
  } catch (error) {
    console.error('[Users] Create error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id — Get user profile
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[Users] Get error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id — Update user profile
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, residentId } = req.body;
    const fields = [];
    const values = [];

    if (name) { fields.push('name = ?'); values.push(name); }
    if (email) { fields.push('email = ?'); values.push(email); }
    if (role) { fields.push('role = ?'); values.push(role); }
    if (residentId !== undefined) { fields.push('resident_id = ?'); values.push(residentId); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'User updated' });
  } catch (error) {
    console.error('[Users] Update error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
