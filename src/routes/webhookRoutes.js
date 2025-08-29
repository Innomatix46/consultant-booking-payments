import express from 'express';
import WebhookController from '../controllers/webhookController.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// Webhook endpoints (no authentication required - verified by signature)
router.post(
  '/stripe',
  WebhookController.handleStripeWebhook
);

router.post(
  '/paystack',
  WebhookController.handlePaystackWebhook
);

// Admin webhook management routes
router.get(
  '/logs',
  adminMiddleware,
  WebhookController.getWebhookLogs
);

router.post(
  '/retry/:webhookId',
  adminMiddleware,
  WebhookController.retryWebhook
);

router.get(
  '/stats',
  adminMiddleware,
  WebhookController.getWebhookStats
);

// Webhook health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook service is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      stripe: '/webhooks/stripe',
      paystack: '/webhooks/paystack'
    }
  });
});

export default router;