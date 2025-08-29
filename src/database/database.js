import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../database/payments.db');
const dbDir = dirname(dbPath);

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    logger.error('Error opening database:', err);
  } else {
    logger.info('Connected to SQLite database');
  }
});

// Enable foreign key constraints
db.run('PRAGMA foreign_keys = ON');

export const initializeDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) logger.error('Error creating users table:', err);
      });

      // Consultations table
      db.run(`
        CREATE TABLE IF NOT EXISTS consultations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          duration INTEGER NOT NULL DEFAULT 30,
          price INTEGER NOT NULL,
          stripe_price_id TEXT,
          paystack_plan_code TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) logger.error('Error creating consultations table:', err);
      });

      // Appointments table
      db.run(`
        CREATE TABLE IF NOT EXISTS appointments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          consultation_id TEXT NOT NULL,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
          payment_id TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (consultation_id) REFERENCES consultations(id),
          FOREIGN KEY (payment_id) REFERENCES payments(id)
        )
      `, (err) => {
        if (err) logger.error('Error creating appointments table:', err);
      });

      // Payments table
      db.run(`
        CREATE TABLE IF NOT EXISTS payments (
          id TEXT PRIMARY KEY,
          appointment_id TEXT,
          user_id TEXT NOT NULL,
          consultation_id TEXT NOT NULL,
          provider TEXT NOT NULL CHECK(provider IN ('stripe', 'paystack')),
          provider_payment_id TEXT UNIQUE,
          provider_customer_id TEXT,
          amount INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')),
          payment_method TEXT,
          customer_email TEXT,
          customer_name TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (consultation_id) REFERENCES consultations(id),
          FOREIGN KEY (appointment_id) REFERENCES appointments(id)
        )
      `, (err) => {
        if (err) logger.error('Error creating payments table:', err);
      });

      // Payment events table for audit trail
      db.run(`
        CREATE TABLE IF NOT EXISTS payment_events (
          id TEXT PRIMARY KEY,
          payment_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_data TEXT,
          webhook_id TEXT,
          processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (payment_id) REFERENCES payments(id)
        )
      `, (err) => {
        if (err) logger.error('Error creating payment_events table:', err);
      });

      // Webhook logs table
      db.run(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_id TEXT UNIQUE,
          payload TEXT NOT NULL,
          signature TEXT,
          processed BOOLEAN DEFAULT FALSE,
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          logger.error('Error creating webhook_logs table:', err);
          reject(err);
        } else {
          logger.info('Database tables initialized successfully');
          resolve();
        }
      });

      // Create indexes for better performance
      db.run('CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments(appointment_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_payments_provider_payment_id ON payments(provider_payment_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON webhook_logs(event_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id)');
    });
  });
};

export default db;