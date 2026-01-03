/**
 * Database Connection
 * Supports both PostgreSQL (via pg) and Local Embedded Postgres (via PGLite)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from './schema';
import path from 'path';
import fs from 'fs';
import { getDataDir } from '../utils/paths.util';

// Load environment variables
dotenv.config();

let db: any;
let pool: any = null;
let pglite: any = null;

const isProduction = process.env.NODE_ENV === 'production';
const hasDatabaseUrl = !!process.env.DATABASE_URL;

if (hasDatabaseUrl) {
  // ---------------------------------------------------------
  // Option 1: Standard PostgreSQL Connection (Supabase/Cloud)
  // ---------------------------------------------------------
  console.log('[Database] 🔌 Connecting to remote PostgreSQL...');
  
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 10000,
    ssl: isProduction ? { rejectUnauthorized: true } : { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });

  pool.on('error', (err: any) => {
    console.error('[Database] Unexpected error on idle client', err);
  });

  db = drizzle(pool, { schema });

  // Test connection
  pool.query('SELECT NOW()', (err: any, res: any) => {
    if (err) {
      console.error('[Database] ❌ Connection failed:', err.message);
    } else {
      console.log('[Database] ✅ Connected to Remote PostgreSQL');
    }
  });

} else {
  // ---------------------------------------------------------
  // Option 2: Local Embedded PGLite (Development/Local/Desktop)
  // ---------------------------------------------------------
  console.log('[Database] 📂 using Local Embedded Database (PGLite)');
  
  // Use centralized data directory (handles Electron/Prod paths)
  const dataDir = path.join(getDataDir(), 'pglite');
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initialize PGLite instance
  try {
    pglite = new PGlite(dataDir);
    db = drizzlePglite(pglite, { schema });
    console.log(`[Database] ✅ Local database active at: ${dataDir}`);
  } catch (e: any) {
    console.error(`[Database] ❌ Failed to initialize PGLite at ${dataDir}:`, e);
    // Fallback or rethrow? For now rethrow but logged.
    throw e;
  }

  // Mock pool interface for compatibility
  pool = {
    query: async (text: string, params: any[], callback: any) => {
      // Handle callback style if provided (backwards compat)
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      
      try {
        const res = await pglite.query(text, params);
        if (callback) callback(null, res);
        return res;
      } catch (err) {
        if (callback) callback(err, null);
        throw err;
      }
    },
    on: () => {},
    end: async () => {
      console.log('[Database] Closing PGLite...');
      await pglite.close();
    },
  };

  console.log(`[Database] ✅ Local database active at: ${dataDir}`);
}

// Export pool and db
export { pool, db };

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (pool) {
    console.log('[Database] Closing connection...');
    await pool.end();
  }
});
