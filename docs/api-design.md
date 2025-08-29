# Payment API Design
## Unified REST API Endpoints

### Authentication
All API requests require JWT authentication in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Base URL Structure
```
Production: https://api.yourcompany.com/v1/payments
Staging: https://staging-api.yourcompany.com/v1/payments
```

### Core Payment Endpoints

#### 1. Create Payment Intent
```http
POST /payments/intents
Content-Type: application/json

{
  "amount": 10000,
  "currency": "usd",
  "payment_method_types": ["card"],
  "provider": "stripe",
  "customer_id": "cust_123456789",
  "metadata": {
    "order_id": "order_123",
    "customer_email": "customer@example.com"
  }
}
```

**Response:**
```json
{
  "id": "pi_1234567890",
  "client_secret": "pi_1234567890_secret_xyz",
  "amount": 10000,
  "currency": "usd",
  "status": "requires_payment_method",
  "provider": "stripe",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### 2. Confirm Payment
```http
POST /payments/intents/{payment_intent_id}/confirm
Content-Type: application/json

{
  "payment_method": "pm_1234567890",
  "return_url": "https://yoursite.com/payment/return"
}
```

#### 3. Capture Payment
```http
POST /payments/intents/{payment_intent_id}/capture
Content-Type: application/json

{
  "amount_to_capture": 10000
}
```

#### 4. Refund Payment
```http
POST /payments/intents/{payment_intent_id}/refunds
Content-Type: application/json

{
  "amount": 5000,
  "reason": "requested_by_customer",
  "metadata": {
    "refund_reason": "Product damaged"
  }
}
```

#### 5. Get Payment Status
```http
GET /payments/intents/{payment_intent_id}
```

**Response:**
```json
{
  "id": "pi_1234567890",
  "amount": 10000,
  "currency": "usd",
  "status": "succeeded",
  "provider": "stripe",
  "payment_method": {
    "type": "card",
    "card": {
      "brand": "visa",
      "last4": "4242"
    }
  },
  "created_at": "2024-01-01T00:00:00Z",
  "confirmed_at": "2024-01-01T00:01:00Z"
}
```

### Customer Management Endpoints

#### 1. Create Customer
```http
POST /customers
Content-Type: application/json

{
  "email": "customer@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94102",
    "country": "US"
  },
  "provider": "stripe"
}
```

#### 2. Add Payment Method
```http
POST /customers/{customer_id}/payment-methods
Content-Type: application/json

{
  "type": "card",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2025,
    "cvc": "123"
  }
}
```

### Webhook Endpoints

#### 1. Stripe Webhooks
```http
POST /webhooks/stripe
Content-Type: application/json
Stripe-Signature: t=1234567890,v1=signature

{
  "id": "evt_1234567890",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1234567890",
      "status": "succeeded"
    }
  }
}
```

#### 2. Paystack Webhooks
```http
POST /webhooks/paystack
Content-Type: application/json
X-Paystack-Signature: signature

{
  "event": "charge.success",
  "data": {
    "id": 123456789,
    "status": "success",
    "reference": "ref_1234567890"
  }
}
```

### Provider-Specific Endpoints

#### Switch Provider
```http
POST /payments/intents/{payment_intent_id}/switch-provider
Content-Type: application/json

{
  "new_provider": "paystack",
  "reason": "primary_provider_failed"
}
```

### Error Responses

All endpoints return consistent error format:
```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "payment_intent_invalid_parameter",
    "message": "Invalid payment intent parameter: amount must be positive",
    "param": "amount"
  }
}
```

### Rate Limiting
- **Standard requests**: 1000 requests per hour per API key
- **Webhook endpoints**: 10000 requests per hour
- **Rate limit headers**:
  ```
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 999
  X-RateLimit-Reset: 1609459200
  ```