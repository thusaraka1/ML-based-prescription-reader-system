import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '../../.env') });

async function setupDatabase() {
  try {
    const dbPassword = process.env.MYSQL_PASSWORD || 'Nadun@123';
    console.log("Connecting to MySQL...");
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: dbPassword,
      multipleStatements: true, // Required to execute the whole schema file at once
    });
    
    console.log("SUCCESS: Connected!");

    const schemaPath = path.join(process.cwd(), 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log("Executing schema.sql to create fresh database, tables, and seed columns...");
    await connection.query(schemaSql);
    
    // Explicitly mention the tables and columns that were created
    await connection.query('USE careconnect;');
    const [tables] = await connection.query('SHOW TABLES;');
    
    console.log("\n======================================");
    console.log("FRESH DATABASE CREATED SUCCESSFULLY");
    console.log("======================================\n");
    console.log("Verified Tables and Columns:");
    
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
      
      const columnNames = columns.map((col) => col.Field).join(', ');
      console.log(` ✅ Table \x1b[36m${tableName}\x1b[0m created with columns:`);
      console.log(`    \x1b[32m[${columnNames}]\x1b[0m`);
    }
    
    console.log("\nSUCCESS: All columns seeded and database setup complete!");
    await connection.end();
    process.exit(0);

  } catch (err) {
    console.error("ERROR:", err.message);
    process.exit(1);
  }
}

setupDatabase();
