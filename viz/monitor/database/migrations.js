import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class DatabaseMigrator {
  constructor(db) {
    this.db = db;
  }

  initializeDatabase() {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    this.db.exec('BEGIN TRANSACTION');
    
    try {
      for (const statement of statements) {
        this.db.exec(statement);
      }
      
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_version (
          version INTEGER PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      this.db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(1);
      
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw new Error(`Database initialization failed: ${error.message}`);
    }
  }

  getCurrentVersion() {
    try {
      const result = this.db.prepare('SELECT MAX(version) as version FROM schema_version').get();
      return result?.version || 0;
    } catch {
      return 0;
    }
  }

  needsInitialization() {
    try {
      const result = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions'").get();
      return !result;
    } catch {
      return true;
    }
  }
}

export function initializeDatabase(dbPath) {
  const db = new Database(dbPath);
  const migrator = new DatabaseMigrator(db);
  
  if (migrator.needsInitialization()) {
    migrator.initializeDatabase();
  }
  
  return db;
}
