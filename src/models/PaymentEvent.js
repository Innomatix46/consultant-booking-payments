import db from '../database/database.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

class PaymentEvent {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.payment_id = data.payment_id;
    this.event_type = data.event_type;
    this.event_data = typeof data.event_data === 'string' ? data.event_data : JSON.stringify(data.event_data || {});
    this.webhook_id = data.webhook_id;
    this.processed_at = data.processed_at;
  }

  static async create(eventData) {
    const event = new PaymentEvent(eventData);
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO payment_events (
          id, payment_id, event_type, event_data, webhook_id
        ) VALUES (?, ?, ?, ?, ?)
      `;

      db.run(query, [
        event.id,
        event.payment_id,
        event.event_type,
        event.event_data,
        event.webhook_id
      ], function(err) {
        if (err) {
          logger.error('Error creating payment event:', err);
          reject(err);
        } else {
          logger.info(`Payment event created: ${event.event_type} for payment ${event.payment_id}`);
          resolve(event);
        }
      });
    });
  }

  static async findByPaymentId(paymentId, limit = 50) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM payment_events 
        WHERE payment_id = ? 
        ORDER BY processed_at DESC 
        LIMIT ?
      `;

      db.all(query, [paymentId, limit], (err, rows) => {
        if (err) {
          logger.error('Error finding payment events:', err);
          reject(err);
        } else {
          const events = rows.map(row => new PaymentEvent(row));
          resolve(events);
        }
      });
    });
  }

  static async getEventStats(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          event_type,
          COUNT(*) as count,
          DATE(processed_at) as date
        FROM payment_events
        WHERE processed_at BETWEEN ? AND ?
        GROUP BY event_type, DATE(processed_at)
        ORDER BY date DESC
      `;

      db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          logger.error('Error getting event stats:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  toJSON() {
    const obj = { ...this };
    if (typeof obj.event_data === 'string') {
      try {
        obj.event_data = JSON.parse(obj.event_data);
      } catch (e) {
        logger.warn('Invalid JSON in event data:', obj.event_data);
        obj.event_data = {};
      }
    }
    return obj;
  }
}

export default PaymentEvent;