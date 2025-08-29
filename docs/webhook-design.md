# Webhook Handler Design
## Event Processing Architecture

### Webhook Processing Flow

```
Provider Webhook → API Gateway → Event Validator → Event Router → Event Processor → Database → Response
                                        ↓
                                 Dead Letter Queue
                                        ↓
                                 Manual Processing
```

### Core Components

#### 1. Event Validator
Validates incoming webhooks from providers:
- Signature verification
- Timestamp validation (prevent replay attacks)
- Event type validation
- Payload structure validation

#### 2. Event Router
Routes events to appropriate processors:
- Event type mapping
- Provider-specific routing
- Load balancing across processors
- Circuit breaker for failing processors

#### 3. Event Processor
Processes validated events:
- Idempotency handling
- Database updates
- Business logic execution
- Error handling and retry

### Stripe Webhook Implementation

#### Supported Events
```javascript
const STRIPE_EVENTS = {
  // Payment Intent Events
  'payment_intent.created': processPaymentIntentCreated,
  'payment_intent.succeeded': processPaymentIntentSucceeded,
  'payment_intent.payment_failed': processPaymentIntentFailed,
  'payment_intent.canceled': processPaymentIntentCanceled,
  'payment_intent.requires_action': processPaymentIntentRequiresAction,
  
  // Payment Method Events
  'payment_method.attached': processPaymentMethodAttached,
  'payment_method.detached': processPaymentMethodDetached,
  
  // Customer Events
  'customer.created': processCustomerCreated,
  'customer.updated': processCustomerUpdated,
  'customer.deleted': processCustomerDeleted,
  
  // Charge Events
  'charge.succeeded': processChargeSucceeded,
  'charge.failed': processChargeFailed,
  'charge.dispute.created': processChargeDisputeCreated,
  
  // Refund Events
  'charge.refunded': processChargeRefunded,
  'refund.created': processRefundCreated,
  'refund.updated': processRefundUpdated
};
```

#### Stripe Webhook Handler
```javascript
class StripeWebhookHandler {
  constructor(webhookSecret) {
    this.webhookSecret = webhookSecret;
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async handleWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const payload = req.body;
    
    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        payload, sig, this.webhookSecret
      );
      
      // Check if event already processed (idempotency)
      const existingEvent = await this.getWebhookEvent(event.id);
      if (existingEvent && existingEvent.processed) {
        return res.status(200).json({ received: true });
      }
      
      // Store event for processing
      await this.storeWebhookEvent(event);
      
      // Process event asynchronously
      await this.processEvent(event);
      
      // Mark as processed
      await this.markEventProcessed(event.id);
      
      res.status(200).json({ received: true });
      
    } catch (error) {
      console.error('Stripe webhook error:', error);
      
      // Store failed event for retry
      await this.storeFailedEvent(payload, error.message);
      
      res.status(400).json({ error: error.message });
    }
  }

  async processEvent(event) {
    const handler = STRIPE_EVENTS[event.type];
    if (handler) {
      await handler(event.data.object);
    } else {
      console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }
}
```

### Paystack Webhook Implementation

#### Supported Events
```javascript
const PAYSTACK_EVENTS = {
  // Transaction Events
  'charge.success': processChargeSuccess,
  'charge.failed': processChargeFailed,
  'charge.pending': processChargePending,
  
  // Transfer Events
  'transfer.success': processTransferSuccess,
  'transfer.failed': processTransferFailed,
  
  // Customer Events
  'customeridentification.success': processCustomerVerification,
  'customeridentification.failed': processCustomerVerificationFailed,
  
  // Subscription Events (if applicable)
  'subscription.create': processSubscriptionCreate,
  'subscription.disable': processSubscriptionDisable,
  
  // Refund Events
  'refund.pending': processRefundPending,
  'refund.processed': processRefundProcessed,
  'refund.failed': processRefundFailed
};
```

#### Paystack Webhook Handler
```javascript
class PaystackWebhookHandler {
  constructor(webhookSecret) {
    this.webhookSecret = webhookSecret;
  }

  async handleWebhook(req, res) {
    const hash = crypto.createHmac('sha512', this.webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
      
    const signature = req.headers['x-paystack-signature'];
    
    try {
      // Verify webhook signature
      if (hash !== signature) {
        throw new Error('Invalid signature');
      }
      
      const event = req.body;
      
      // Check if event already processed (idempotency)
      const existingEvent = await this.getWebhookEvent(event.data.id);
      if (existingEvent && existingEvent.processed) {
        return res.status(200).json({ received: true });
      }
      
      // Store event for processing
      await this.storeWebhookEvent(event);
      
      // Process event asynchronously
      await this.processEvent(event);
      
      // Mark as processed
      await this.markEventProcessed(event.data.id);
      
      res.status(200).json({ received: true });
      
    } catch (error) {
      console.error('Paystack webhook error:', error);
      
      // Store failed event for retry
      await this.storeFailedEvent(req.body, error.message);
      
      res.status(400).json({ error: error.message });
    }
  }

  async processEvent(event) {
    const handler = PAYSTACK_EVENTS[event.event];
    if (handler) {
      await handler(event.data);
    } else {
      console.log(`Unhandled Paystack event type: ${event.event}`);
    }
  }
}
```

### Event Processing Patterns

#### 1. Payment Intent Success Processing
```javascript
async function processPaymentIntentSucceeded(paymentIntent) {
  const transaction = await db.transaction();
  
  try {
    // Update payment intent status
    await PaymentIntent.update({
      status: 'succeeded',
      confirmed_at: new Date()
    }, {
      where: { external_id: paymentIntent.id },
      transaction
    });
    
    // Create successful transaction record
    await Transaction.create({
      id: generateId(),
      payment_intent_id: paymentIntent.id,
      type: 'payment',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'succeeded',
      provider: 'stripe',
      provider_transaction_id: paymentIntent.latest_charge,
      processed_at: new Date()
    }, { transaction });
    
    // Update customer's payment methods if needed
    if (paymentIntent.payment_method) {
      await updateCustomerPaymentMethod(paymentIntent);
    }
    
    // Send confirmation notifications
    await sendPaymentConfirmation(paymentIntent);
    
    // Trigger business logic (order fulfillment, etc.)
    await triggerPostPaymentWorkflow(paymentIntent);
    
    await transaction.commit();
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

#### 2. Payment Failure Processing
```javascript
async function processPaymentIntentFailed(paymentIntent) {
  const transaction = await db.transaction();
  
  try {
    // Update payment intent status
    await PaymentIntent.update({
      status: 'payment_failed',
      last_error: paymentIntent.last_payment_error?.message
    }, {
      where: { external_id: paymentIntent.id },
      transaction
    });
    
    // Create failed transaction record
    await Transaction.create({
      id: generateId(),
      payment_intent_id: paymentIntent.id,
      type: 'payment',
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      provider: 'stripe',
      failure_code: paymentIntent.last_payment_error?.code,
      failure_message: paymentIntent.last_payment_error?.message,
      processed_at: new Date()
    }, { transaction });
    
    // Send failure notification
    await sendPaymentFailureNotification(paymentIntent);
    
    // Trigger retry logic if applicable
    await schedulePaymentRetry(paymentIntent);
    
    await transaction.commit();
    
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

### Retry Mechanism

#### Exponential Backoff Strategy
```javascript
class WebhookRetryHandler {
  constructor() {
    this.retryDelays = [1, 5, 15, 30, 60]; // minutes
  }

  async scheduleRetry(eventId, retryCount) {
    const delay = this.retryDelays[Math.min(retryCount, this.retryDelays.length - 1)];
    const nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
    
    await WebhookEvent.update({
      retry_count: retryCount + 1,
      next_retry_at: nextRetryAt
    }, {
      where: { id: eventId }
    });
    
    // Schedule background job
    await scheduleBackgroundJob('webhook-retry', { eventId }, delay * 60);
  }

  async processRetries() {
    const pendingRetries = await WebhookEvent.findAll({
      where: {
        processed: false,
        retry_count: { [Op.lt]: { max_retries: 3 }},
        next_retry_at: { [Op.lte]: new Date() }
      }
    });

    for (const event of pendingRetries) {
      try {
        await this.reprocessEvent(event);
        await this.markEventProcessed(event.id);
      } catch (error) {
        await this.scheduleRetry(event.id, event.retry_count);
      }
    }
  }
}
```

### Security Best Practices

#### 1. Signature Verification
```javascript
function verifyWebhookSignature(payload, signature, secret, provider) {
  switch (provider) {
    case 'stripe':
      return stripe.webhooks.constructEvent(payload, signature, secret);
    case 'paystack':
      const hash = crypto.createHmac('sha512', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      return hash === signature;
    default:
      throw new Error('Unsupported provider');
  }
}
```

#### 2. Timestamp Validation
```javascript
function validateTimestamp(timestamp, toleranceSeconds = 300) {
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - timestamp) <= toleranceSeconds;
}
```

#### 3. Rate Limiting
```javascript
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many webhook requests from this IP'
});
```

### Monitoring and Alerting

#### Webhook Health Metrics
- Success rate per provider
- Processing time percentiles
- Retry rates
- Dead letter queue size
- Signature verification failures

#### Alert Conditions
- Webhook success rate < 95%
- Processing time > 5 seconds (P95)
- Dead letter queue > 100 events
- Consecutive failures > 10

#### Dashboard Queries
```sql
-- Webhook success rate by provider (last 24 hours)
SELECT 
  provider,
  COUNT(*) as total_events,
  SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) as successful_events,
  (SUM(CASE WHEN processed = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100 as success_rate
FROM webhook_events 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY provider;
```