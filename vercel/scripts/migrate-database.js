#!/usr/bin/env node
// Database Migration Script from SQLite to Serverless Database

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MIGRATION_SQL = `
-- Create tables for serverless database
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  appointment_type TEXT NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  amount DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  appointment_id TEXT,
  provider TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

CREATE TABLE IF NOT EXISTS payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (payment_id) REFERENCES payments(id)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_appointment ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);
`;

function createMigrationFile() {
  const migrationDir = path.join(process.cwd(), 'vercel', 'migrations');
  
  if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
  const migrationFile = path.join(migrationDir, `${timestamp}_initial_schema.sql`);
  
  fs.writeFileSync(migrationFile, MIGRATION_SQL);
  console.log(`✅ Created migration file: ${migrationFile}`);
  
  return migrationFile;
}

function generateDatabaseScript() {
  const script = `
// Database initialization script for Vercel serverless functions
import { createConnection } from './database-connection.js';

export async function initializeDatabase() {
  const db = await createConnection(process.env.DATABASE_URL);
  
  // Run migrations
  const migrations = [
    \`${MIGRATION_SQL.replace(/`/g, '\\`')}\`
  ];
  
  for (const migration of migrations) {
    try {
      await db.exec(migration);
      console.log('✅ Migration applied successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }
  
  console.log('🎉 Database initialized successfully');
  return db;
}

export async function seedDatabase() {
  const db = await createConnection(process.env.DATABASE_URL);
  
  // Create default admin user (change password in production!)
  const defaultAdmin = {
    email: 'admin@consultation.com',
    password: 'admin123', // This should be changed immediately
    role: 'admin'
  };
  
  // Hash password (you'll need to implement proper password hashing)
  // const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10);
  
  try {
    await db.run(
      'INSERT OR IGNORE INTO admin_users (email, password_hash, role) VALUES (?, ?, ?)',
      [defaultAdmin.email, 'temp_hash_change_me', defaultAdmin.role]
    );
    
    console.log('✅ Default admin user created');
    console.log('⚠️ IMPORTANT: Change the default admin password immediately!');
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
  }
}
`;

  const scriptPath = path.join(process.cwd(), 'vercel', 'scripts', 'init-database.js');
  fs.writeFileSync(scriptPath, script);
  console.log(`✅ Created database initialization script: ${scriptPath}`);
}

function createDatabaseConnectionModule() {
  const connectionScript = `
// Database connection module for different database types
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import pg from 'pg';

export async function createConnection(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  if (databaseUrl.startsWith('file:') || databaseUrl.endsWith('.db')) {
    // SQLite connection
    return await createSQLiteConnection(databaseUrl);
  } else if (databaseUrl.startsWith('postgresql:') || databaseUrl.startsWith('postgres:')) {
    // PostgreSQL connection
    return await createPostgreSQLConnection(databaseUrl);
  } else {
    throw new Error('Unsupported database URL format');
  }
}

async function createSQLiteConnection(databaseUrl) {
  const filename = databaseUrl.replace('file:', '');
  
  const db = await open({
    filename,
    driver: sqlite3.Database
  });
  
  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');
  
  return db;
}

async function createPostgreSQLConnection(databaseUrl) {
  const { Client } = pg;
  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  await client.connect();
  
  // Wrap client to match sqlite interface
  return {
    async run(sql, params = []) {
      const result = await client.query(sql, params);
      return result;
    },
    
    async get(sql, params = []) {
      const result = await client.query(sql, params);
      return result.rows[0];
    },
    
    async all(sql, params = []) {
      const result = await client.query(sql, params);
      return result.rows;
    },
    
    async exec(sql) {
      await client.query(sql);
    },
    
    async close() {
      await client.end();
    }
  };
}
`;

  const connectionPath = path.join(process.cwd(), 'vercel', 'scripts', 'database-connection.js');
  fs.writeFileSync(connectionPath, connectionScript);
  console.log(`✅ Created database connection module: ${connectionPath}`);
}

function updatePackageJson() {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Add database dependencies
  packageJson.dependencies = {
    ...packageJson.dependencies,
    'sqlite': '^5.1.1',
    'sqlite3': '^5.1.6',
    'pg': '^8.11.0'
  };
  
  // Add migration scripts
  packageJson.scripts = {
    ...packageJson.scripts,
    'db:migrate': 'node vercel/scripts/migrate-database.js',
    'db:init': 'node vercel/scripts/init-database.js',
    'db:seed': 'node vercel/scripts/init-database.js --seed'
  };
  
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
  console.log('✅ Updated package.json with database dependencies');
}

function createEnvironmentTemplate() {
  const envTemplate = `# Vercel Environment Variables Template
# Copy this to .env.local for local development

# Database Configuration
DATABASE_URL="file:./consultation.db"  # SQLite for development
# DATABASE_URL="postgresql://user:password@host:port/database"  # PostgreSQL for production

# Payment Providers
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
PAYSTACK_SECRET_KEY="sk_test_..."
PAYSTACK_WEBHOOK_SECRET="..."

# Application Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
FRONTEND_URL="https://your-domain.vercel.app"
ALLOWED_ORIGINS="https://your-domain.vercel.app,https://your-custom-domain.com"

# Optional: Error Tracking
SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"

# Optional: Email Service (for notifications)
EMAIL_SERVICE_API_KEY="your-email-service-key"
EMAIL_FROM="noreply@your-domain.com"

# Optional: Monitoring
UPTIME_ROBOT_API_KEY="your-uptime-robot-key"
`;

  const envPath = path.join(process.cwd(), 'vercel', '.env.template');
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created environment template file');
}

async function main() {
  console.log('🚀 Setting up database migration for Vercel deployment...\n');
  
  try {
    // Create migration file
    createMigrationFile();
    
    // Generate database scripts
    generateDatabaseScript();
    createDatabaseConnectionModule();
    
    // Update package.json
    updatePackageJson();
    
    // Create environment template
    createEnvironmentTemplate();
    
    console.log('\n🎉 Database migration setup completed!');
    console.log('\nNext steps:');
    console.log('1. Update DATABASE_URL in Vercel dashboard to use a serverless database');
    console.log('2. Run "npm run db:init" to initialize the database schema');
    console.log('3. Update your serverless functions to use the new database connection module');
    console.log('4. Test the migration in a preview deployment before going to production');
    
  } catch (error) {
    console.error('\n💥 Migration setup failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  main();
}`;

  const migratePath = path.join(process.cwd(), 'vercel', 'scripts', 'migrate-database.js');
  fs.writeFileSync(migratePath, createMigrationFile.toString() + '\n\n' + main.toString());
  console.log(`✅ Created migration script: ${migratePath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}