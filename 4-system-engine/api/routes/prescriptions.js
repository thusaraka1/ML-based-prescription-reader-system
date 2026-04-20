// Prescriptions API routes
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/residents/:residentId/prescriptions — List prescriptions for a resident
router.get('/residents/:residentId/prescriptions', async (req, res) => {
  try {
    const [prescriptions] = await pool.execute(
      'SELECT * FROM prescriptions WHERE resident_id = ? ORDER BY date_issued DESC',
      [req.params.residentId]
    );

    for (const rx of prescriptions) {
      const [meds] = await pool.execute(
        'SELECT * FROM medications WHERE prescription_id = ?',
        [rx.prescription_id]
      );
      rx.medications = meds;
    }

    res.json(prescriptions);
  } catch (error) {
    console.error('[Prescriptions] List error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/prescriptions — Create prescription with medications
router.post('/prescriptions', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { prescriptionId, residentId, dateIssued, doctorName, imageUrl, imagePath, medications } = req.body;

    if (!prescriptionId || !residentId || !dateIssued) {
      return res.status(400).json({ error: 'prescriptionId, residentId, and dateIssued are required' });
    }

    await connection.beginTransaction();

    // Insert prescription
    await connection.execute(
      'INSERT INTO prescriptions (prescription_id, resident_id, date_issued, doctor_name, image_url, image_path) VALUES (?, ?, ?, ?, ?, ?)',
      [prescriptionId, residentId, dateIssued, doctorName || null, imageUrl || null, imagePath || null]
    );

    // Insert medications
    if (medications && medications.length > 0) {
      for (const med of medications) {
        await connection.execute(
          'INSERT INTO medications (prescription_id, drug_name, dosage, frequency) VALUES (?, ?, ?, ?)',
          [prescriptionId, med.drugName, med.dosage || '', med.frequency || '']
        );
      }
    }

    await connection.commit();

    res.status(201).json({
      message: 'Prescription created',
      prescriptionId,
      medicationsCount: medications?.length || 0,
    });
  } catch (error) {
    await connection.rollback();
    console.error('[Prescriptions] Create error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/prescriptions/:prescriptionId/medications — mark one medication as finished
router.delete('/prescriptions/:prescriptionId/medications', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { prescriptionId } = req.params;
    const { medicationId, drugName, dosage, frequency } = req.body || {};

    if (!medicationId && !drugName) {
      return res.status(400).json({ error: 'medicationId or drugName is required' });
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS finished_medications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        resident_id VARCHAR(50) NOT NULL,
        prescription_id VARCHAR(50) NOT NULL,
        drug_name VARCHAR(255) NOT NULL,
        dosage VARCHAR(100) DEFAULT NULL,
        frequency VARCHAR(255) DEFAULT NULL,
        finished_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (resident_id) REFERENCES residents(resident_id) ON DELETE CASCADE,
        FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
        INDEX idx_finished_resident_time (resident_id, finished_at)
      )
    `);

    await connection.beginTransaction();

    const [prescriptionRows] = await connection.execute(
      'SELECT resident_id FROM prescriptions WHERE prescription_id = ? LIMIT 1',
      [prescriptionId]
    );

    if (!prescriptionRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Prescription not found' });
    }

    const residentId = prescriptionRows[0].resident_id;
    let medicationRow;

    if (medicationId) {
      const [rows] = await connection.execute(
        'SELECT id, drug_name, dosage, frequency FROM medications WHERE id = ? AND prescription_id = ? LIMIT 1',
        [medicationId, prescriptionId]
      );
      medicationRow = rows[0];
    } else {
      const [rows] = await connection.execute(
        'SELECT id, drug_name, dosage, frequency FROM medications WHERE prescription_id = ? AND drug_name = ? AND dosage = ? AND frequency = ? LIMIT 1',
        [prescriptionId, drugName, dosage || '', frequency || '']
      );
      medicationRow = rows[0];
    }

    if (!medicationRow) {
      await connection.rollback();
      return res.status(404).json({ error: 'Medication not found' });
    }

    const finishedAt = new Date();
    const [insertResult] = await connection.execute(
      'INSERT INTO finished_medications (resident_id, prescription_id, drug_name, dosage, frequency, finished_at) VALUES (?, ?, ?, ?, ?, ?)',
      [residentId, prescriptionId, medicationRow.drug_name, medicationRow.dosage || '', medicationRow.frequency || '', finishedAt]
    );

    await connection.execute(
      'DELETE FROM medications WHERE id = ? AND prescription_id = ? LIMIT 1',
      [medicationRow.id, prescriptionId]
    );

    await connection.commit();

    res.json({
      message: 'Medication marked as finished',
      finishedMedication: {
        id: insertResult.insertId,
        residentId,
        prescriptionId,
        drugName: medicationRow.drug_name,
        dosage: medicationRow.dosage || '',
        frequency: medicationRow.frequency || '',
        finishedAt: finishedAt.toISOString(),
      },
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // ignore rollback errors
    }
    console.error('[Prescriptions] Finish medication error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// DELETE /api/prescriptions/:id — Delete prescription (cascade deletes medications)
router.delete('/prescriptions/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM prescriptions WHERE prescription_id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Prescription not found' });
    }

    res.json({ message: 'Prescription deleted' });
  } catch (error) {
    console.error('[Prescriptions] Delete error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
