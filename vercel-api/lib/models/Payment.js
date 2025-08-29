import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection.js';

class Payment {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.appointment_id = data.appointment_id;
    this.user_id = data.user_id;
    this.consultation_id = data.consultation_id;
    this.provider = data.provider;
    this.provider_payment_id = data.provider_payment_id;
    this.provider_customer_id = data.provider_customer_id;
    this.amount = data.amount;
    this.currency = data.currency || 'USD';
    this.status = data.status || 'pending';
    this.payment_method = data.payment_method;
    this.customer_email = data.customer_email;
    this.customer_name = data.customer_name;
    this.metadata = data.metadata;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  async save() {
    const db = getDatabase();
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO payments (
        id, appointment_id, user_id, consultation_id, provider,
        provider_payment_id, provider_customer_id, amount, currency,
        status, payment_method, customer_email, customer_name,
        metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run([
      this.id,
      this.appointment_id,
      this.user_id,
      this.consultation_id,
      this.provider,
      this.provider_payment_id,
      this.provider_customer_id,
      this.amount,
      this.currency,
      this.status,
      this.payment_method,
      this.customer_email,
      this.customer_name,
      typeof this.metadata === 'object' ? JSON.stringify(this.metadata) : this.metadata,
      this.created_at || now,
      now
    ]);

    if (!this.created_at) {
      this.created_at = now;
    }
    this.updated_at = now;

    return this;
  }

  async updateStatus(status, metadata = null) {
    this.status = status;
    this.updated_at = new Date().toISOString();
    
    if (metadata) {
      this.metadata = typeof metadata === 'object' ? JSON.stringify(metadata) : metadata;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE payments 
      SET status = ?, updated_at = ?, metadata = ?
      WHERE id = ?
    `);

    stmt.run([this.status, this.updated_at, this.metadata, this.id]);
    return this;
  }

  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM payments WHERE id = ?');
    const row = stmt.get([id]);
    
    if (!row) return null;
    
    return new Payment({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    });
  }

  static findByProviderPaymentId(providerId) {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM payments WHERE provider_payment_id = ?');
    const row = stmt.get([providerId]);
    
    if (!row) return null;
    
    return new Payment({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    });
  }

  static findByUserId(userId, limit = 10, offset = 0) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM payments 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all([userId, limit, offset]);
    
    return rows.map(row => new Payment({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  }

  static getPaymentStats(startDate, endDate) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT 
        provider,
        status,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        currency
      FROM payments
      WHERE created_at BETWEEN ? AND ?
      GROUP BY provider, status, currency
      ORDER BY provider, status
    `);

    return stmt.all([startDate, endDate]);
  }

  static async createPayment(paymentData) {
    const payment = new Payment(paymentData);
    await payment.save();
    return payment;
  }

  toJSON() {
    return {
      id: this.id,
      appointment_id: this.appointment_id,
      user_id: this.user_id,
      consultation_id: this.consultation_id,
      provider: this.provider,
      provider_payment_id: this.provider_payment_id,
      provider_customer_id: this.provider_customer_id,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      payment_method: this.payment_method,
      customer_email: this.customer_email,
      customer_name: this.customer_name,
      metadata: typeof this.metadata === 'string' ? JSON.parse(this.metadata) : this.metadata,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

export default Payment;