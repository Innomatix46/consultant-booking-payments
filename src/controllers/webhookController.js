import StripeService from '../services/stripeService.js';
import PaystackService from '../services/paystackService.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/database.js';

class WebhookController {
  static async handleStripeWebhook(req, res) {
    const signature = req.headers['stripe-signature'];
    const eventBody = req.body;

    try {
      // Log incoming webhook
      const webhookLogId = uuidv4();
      await this.logWebhook({
        id: webhookLogId,
        provider: 'stripe',
        event_type: 'unknown',
        event_id: 'unknown',
        payload: JSON.stringify(eventBody),
        signature: signature
      });

      // Process the webhook
      const result = await StripeService.handleWebhookEvent(eventBody, signature);

      // Update webhook log as processed
      await this.updateWebhookLog(webhookLogId, true, null);

      logger.info('Stripe webhook processed successfully');
      res.status(200).json(result);

    } catch (error) {
      logger.error('Error processing Stripe webhook:', error);
      
      // Update webhook log with error
      await this.updateWebhookLog(
        webhookLogId || uuidv4(),
        false,
        error.message
      );

      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async handlePaystackWebhook(req, res) {
    const signature = req.headers['x-paystack-signature'];
    const eventBody = req.body;

    try {
      // Log incoming webhook
      const webhookLogId = uuidv4();
      await this.logWebhook({
        id: webhookLogId,
        provider: 'paystack',
        event_type: eventBody.event || 'unknown',
        event_id: eventBody.data?.id || eventBody.data?.reference || 'unknown',
        payload: JSON.stringify(eventBody),
        signature: signature
      });

      // Process the webhook
      const result = await PaystackService.handleWebhookEvent(eventBody, signature);

      // Update webhook log as processed
      await this.updateWebhookLog(webhookLogId, true, null);

      logger.info('Paystack webhook processed successfully');
      res.status(200).json(result);

    } catch (error) {
      logger.error('Error processing Paystack webhook:', error);
      
      // Update webhook log with error
      await this.updateWebhookLog(
        webhookLogId || uuidv4(),
        false,
        error.message
      );

      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getWebhookLogs(req, res) {
    try {
      const {
        provider,
        processed,
        limit = 50,
        offset = 0,
        startDate,
        endDate
      } = req.query;

      let query = 'SELECT * FROM webhook_logs WHERE 1=1';
      const params = [];

      if (provider) {
        query += ' AND provider = ?';
        params.push(provider);
      }

      if (processed !== undefined) {
        query += ' AND processed = ?';
        params.push(processed === 'true');
      }

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const logs = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) {
            logger.error('Error fetching webhook logs:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

      // Parse payload JSON for each log
      const formattedLogs = logs.map(log => ({
        ...log,
        payload: this.safeJSONParse(log.payload)
      }));

      res.status(200).json({
        success: true,
        message: 'Webhook logs retrieved successfully',
        data: {
          logs: formattedLogs,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: formattedLogs.length
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching webhook logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch webhook logs'
      });
    }
  }

  static async retryWebhook(req, res) {
    try {
      const { webhookId } = req.params;

      // Get webhook log
      const log = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM webhook_logs WHERE id = ?', [webhookId], (err, row) => {
          if (err) {
            logger.error('Error fetching webhook log:', err);
            reject(err);
          } else {
            resolve(row);
          }
        });
      });

      if (!log) {
        return res.status(404).json({
          success: false,
          message: 'Webhook log not found'
        });
      }

      if (log.processed) {
        return res.status(400).json({
          success: false,
          message: 'Webhook has already been processed successfully'
        });
      }

      const payload = this.safeJSONParse(log.payload);
      let result;

      if (log.provider === 'stripe') {
        result = await StripeService.handleWebhookEvent(payload, log.signature);
      } else if (log.provider === 'paystack') {
        result = await PaystackService.handleWebhookEvent(payload, log.signature);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported webhook provider'
        });
      }

      // Update webhook log as processed
      await this.updateWebhookLog(webhookId, true, null);

      logger.info(`Webhook ${webhookId} retry successful`);
      res.status(200).json({
        success: true,
        message: 'Webhook retried successfully',
        data: result
      });

    } catch (error) {
      logger.error('Error retrying webhook:', error);
      
      // Update webhook log with new error
      await this.updateWebhookLog(req.params.webhookId, false, error.message);

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getWebhookStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      let query = `
        SELECT 
          provider,
          event_type,
          processed,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM webhook_logs
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY provider, event_type, processed, DATE(created_at) ORDER BY date DESC';

      const stats = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) {
            logger.error('Error fetching webhook stats:', err);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

      // Organize stats by provider
      const organizedStats = stats.reduce((acc, stat) => {
        if (!acc[stat.provider]) {
          acc[stat.provider] = {};
        }
        if (!acc[stat.provider][stat.event_type]) {
          acc[stat.provider][stat.event_type] = {
            processed: 0,
            failed: 0,
            total: 0
          };
        }

        if (stat.processed) {
          acc[stat.provider][stat.event_type].processed += stat.count;
        } else {
          acc[stat.provider][stat.event_type].failed += stat.count;
        }
        acc[stat.provider][stat.event_type].total += stat.count;

        return acc;
      }, {});

      res.status(200).json({
        success: true,
        message: 'Webhook statistics retrieved successfully',
        data: {
          stats: organizedStats,
          period: { startDate, endDate }
        }
      });

    } catch (error) {
      logger.error('Error fetching webhook stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch webhook statistics'
      });
    }
  }

  // Helper methods
  static async logWebhook(webhookData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO webhook_logs (
          id, provider, event_type, event_id, payload, signature
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(query, [
        webhookData.id,
        webhookData.provider,
        webhookData.event_type,
        webhookData.event_id,
        webhookData.payload,
        webhookData.signature
      ], function(err) {
        if (err) {
          logger.error('Error logging webhook:', err);
          reject(err);
        } else {
          resolve(webhookData);
        }
      });
    });
  }

  static async updateWebhookLog(webhookId, processed, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE webhook_logs 
        SET processed = ?, error_message = ?
        WHERE id = ?
      `;

      db.run(query, [processed, errorMessage, webhookId], function(err) {
        if (err) {
          logger.error('Error updating webhook log:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  static safeJSONParse(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      logger.warn('Failed to parse JSON:', jsonString);
      return jsonString;
    }
  }
}

export default WebhookController;