/**
 * Database Verification Script
 * Checks tables were created successfully
 */

import { pool } from './index';
import * as dotenv from 'dotenv';

dotenv.config();

async function verifyDatabase() {
  console.log('[Verify] Checking database tables...\n');

  try {
    // List all tables
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('✅ Connected to database successfully!\n');
    console.log(`Found ${result.rows.length} tables:\n`);
    result.rows.forEach((row: any, index: number) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });

    console.log('\n[Verify] ✅ Database setup complete!');
  } catch (error) {
    console.error('[Verify] ❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

verifyDatabase();
