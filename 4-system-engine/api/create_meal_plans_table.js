import pool from './db.js';

async function createTable() {
  try {
    console.log('Creating meal_plans table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS meal_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        resident_id VARCHAR(50) NOT NULL,
        plan_json LONGTEXT NOT NULL COMMENT 'Full WeeklyMealPlan JSON',
        medication_count INT DEFAULT 0 COMMENT 'Number of medications when plan was generated',
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (resident_id) REFERENCES residents(resident_id) ON DELETE CASCADE,
        INDEX idx_meal_plan_resident (resident_id),
        UNIQUE KEY uq_resident_meal_plan (resident_id)
      );
    `);
    console.log('Table created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to create table:', error);
    process.exit(1);
  }
}

createTable();
