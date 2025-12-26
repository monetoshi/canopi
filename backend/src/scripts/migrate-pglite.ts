/**
 * PGLite Migration Script
 * Initializes the local embedded database
 */

import { migrate } from 'drizzle-orm/pglite/migrator';
import { db, pool } from '../db/index';

async function runMigration() {
  console.log('[Migration] Starting PGLite migration...');

  try {
    // Check if we are running in PGLite mode
    // The db object in index.ts is typed as 'any', but we know it's a Drizzle instance.
    // The migrate function for PGLite expects the specific PGLite drizzle instance.
    
    // Note: If db was initialized with node-postgres, this migrator might complain or fail.
    // But since we are running this specifically for PGLite (when DATABASE_URL is missing), 
    // it should be fine.
    
    if (process.env.DATABASE_URL) {
      console.error('[Migration] ❌ Error: DATABASE_URL is present. Use "npm run db:migrate" for remote DBs.');
      process.exit(1);
    }

    console.log('[Migration] Applying migrations from ./drizzle folder...');
    
    // We pass the 'db' exported from index.ts. 
    // Ensure 'db' is the PGLite instance.
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('[Migration] ✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the pool/connection
    if (pool) {
      await pool.end();
    }
    console.log('[Migration] Database connection closed');
  }
}

runMigration();
