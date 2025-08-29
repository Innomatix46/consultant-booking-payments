import db from '../database/database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

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
    this.metadata = typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {});
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(paymentData) {
    const payment = new Payment(paymentData);
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO payments (
          id, appointment_id, user_id, consultation_id, provider, 
          provider_payment_id, provider_customer_id, amount, currency, 
          status, payment_method, customer_email, customer_name, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
        payment.id,
        payment.appointment_id,
        payment.user_id,
        payment.consultation_id,
        payment.provider,
        payment.provider_payment_id,
        payment.provider_customer_id,
        payment.amount,
        payment.currency,
        payment.status,
        payment.payment_method,
        payment.customer_email,
        payment.customer_name,
        payment.metadata
      ], function(err) {
        if (err) {
          logger.error('Error creating payment:', err);
          reject(err);
        } else {
          logger.info(`Payment created with ID: ${payment.id}`);
          resolve(payment);
        }
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM payments WHERE id = ?', [id], (err, row) => {
        if (err) {
          logger.error('Error finding payment by ID:', err);
          reject(err);
        } else if (row) {
          resolve(new Payment(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByProviderPaymentId(providerPaymentId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM payments WHERE provider_payment_id = ?', [providerPaymentId], (err, row) => {
        if (err) {
          logger.error('Error finding payment by provider payment ID:', err);
          reject(err);
        } else if (row) {
          resolve(new Payment(row));
        } else {
          resolve(null);
        }
      });
    });
  }

  static async findByUserId(userId, limit = 10, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT p.*, c.title as consultation_title, c.duration 
        FROM payments p
        JOIN consultations c ON p.consultation_id = c.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;

      db.all(query, [userId, limit, offset], (err, rows) => {
        if (err) {
          logger.error('Error finding payments by user ID:', err);
          reject(err);
        } else {
          const payments = rows.map(row => new Payment(row));
          resolve(payments);
        }
      });
    });
  }

  async updateStatus(status, additionalData = {}) {
    return new Promise((resolve, reject) => {
      const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const values = [status];

      // Handle additional data updates
      if (additionalData.provider_payment_id) {
        updates.push('provider_payment_id = ?');
        values.push(additionalData.provider_payment_id);
      }

      if (additionalData.provider_customer_id) {
        updates.push('provider_customer_id = ?');
        values.push(additionalData.provider_customer_id);
      }

      if (additionalData.payment_method) {
        updates.push('payment_method = ?');
        values.push(additionalData.payment_method);
      }

      if (additionalData.metadata) {
        updates.push('metadata = ?');
        values.push(typeof additionalData.metadata === 'string' ? 
                   additionalData.metadata : JSON.stringify(additionalData.metadata));
      }

      values.push(this.id);

      const query = `UPDATE payments SET ${updates.join(', ')} WHERE id = ?`;

      db.run(query, values, function(err) {
        if (err) {
          logger.error('Error updating payment status:', err);
          reject(err);
        } else {
          logger.info(`Payment ${this.id} status updated to ${status}`);
          resolve(this);
        }
      });
    });
  }

  static async getPaymentStats(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          provider,
          status,
          COUNT(*) as count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM payments
        WHERE created_at BETWEEN ? AND ?
        GROUP BY provider, status
      `;

      db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          logger.error('Error getting payment stats:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  toJSON() {
    const obj = { ...this };
    if (typeof obj.metadata === 'string') {
      try {
        obj.metadata = JSON.parse(obj.metadata);
      } catch (e) {
        logger.warn('Invalid JSON in payment metadata:', obj.metadata);
        obj.metadata = {};
      }
    }
    return obj;
  }
}

export default Payment;