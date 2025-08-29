# Payment API - Vercel Serverless Deployment

A serverless payment processing API built for Vercel, supporting both Stripe and Paystack payment providers. This API handles consultation bookings, payment processing, webhook events, and provides comprehensive payment management features.

## 🚀 Features

- **Multi-Provider Support**: Stripe and Paystack integration
- **Serverless Architecture**: Optimized for Vercel Functions
- **Security First**: Rate limiting, CORS, input validation
- **Webhook Processing**: Robust webhook handling with retry logic
- **Payment Management**: Full payment lifecycle support
- **Audit Trail**: Comprehensive logging and event tracking
- **Real-time Updates**: Webhook-driven status updates

## 📋 API Endpoints

### Payment Endpoints

- `POST /api/payments/stripe-payment-intent` - Create Stripe payment intent
- `POST /api/payments/stripe-checkout` - Create Stripe checkout session
- `POST /api/payments/paystack-initialize` - Initialize Paystack payment
- `GET /api/payments/paystack-verify?reference={ref}` - Verify Paystack payment
- `GET /api/payments/status/[paymentId]` - Get payment status
- `GET /api/payments/user/[userId]` - Get user payments
- `POST /api/payments/refund/[paymentId]` - Process refund
- `POST /api/payments/cancel/[paymentId]` - Cancel payment
- `GET /api/payments/stats` - Get payment statistics

### Webhook Endpoints

- `POST /api/webhooks/stripe` - Stripe webhook handler
- `POST /api/webhooks/paystack` - Paystack webhook handler
- `GET /api/webhooks/logs` - Get webhook logs
- `POST /api/webhooks/retry/[webhookId]` - Retry failed webhook
- `GET /api/webhooks/stats` - Get webhook statistics

### System Endpoints

- `GET /api/health` - Health check

## 🛠️ Quick Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd vercel-api
npm install
```

### 2. Environment Configuration

Copy the environment template:
```bash
cp .env.example .env.local
```

Configure your environment variables:
```env
# Frontend URL
FRONTEND_URL=https://your-frontend.vercel.app

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
PAYSTACK_WEBHOOK_SECRET=your_paystack_webhook_secret
```

### 3. Deploy to Vercel

#### Option A: Automated Setup (Recommended)
```bash
npm run setup-env  # Interactive environment setup
npm run deploy     # Deploy to preview
npm run deploy:production  # Deploy to production
```

#### Option B: Manual Setup
```bash
# Install Vercel CLI
npm install -g vercel

# Login and link project
vercel login
vercel link

# Set environment variables
vercel env add STRIPE_SECRET_KEY production preview development
vercel env add PAYSTACK_SECRET_KEY production preview development
# ... (repeat for all environment variables)

# Deploy
vercel deploy --prod
```

## 🔧 Development

### Local Development

```bash
npm run dev  # Start local development server
```

The API will be available at `http://localhost:3000/api/`

### Testing

```bash
npm test        # Run tests
npm run test:watch  # Watch mode
```

### Project Structure

```
vercel-api/
├── api/                    # Vercel API routes
│   ├── health.js          # Health check endpoint
│   ├── payments/          # Payment endpoints
│   │   ├── stripe-payment-intent.js
│   │   ├── stripe-checkout.js
│   │   ├── paystack-initialize.js
│   │   ├── paystack-verify.js
│   │   ├── status/[paymentId].js
│   │   ├── user/[userId].js
│   │   ├── refund/[paymentId].js
│   │   ├── cancel/[paymentId].js
│   │   └── stats.js
│   └── webhooks/          # Webhook endpoints
│       ├── stripe.js
│       ├── paystack.js
│       ├── logs.js
│       ├── stats.js
│       └── retry/[webhookId].js
├── lib/                   # Shared utilities
│   ├── database/          # Database connection
│   ├── middleware/        # Middleware functions
│   ├── models/           # Data models
│   ├── services/         # Payment providers
│   └── utils/            # Utilities
├── scripts/              # Deployment scripts
└── vercel.json          # Vercel configuration
```

## 🔐 Security Features

### Rate Limiting
- General API: 100 requests per 15 minutes
- Payment endpoints: 10 requests per 15 minutes
- Admin endpoints: 20 requests per 15 minutes

### Input Validation
- All endpoints use express-validator
- Sanitized input data
- SQL injection prevention

### CORS Configuration
- Configurable allowed origins
- Secure header management
- Preflight request handling

### Webhook Security
- Signature verification for all webhooks
- Replay attack prevention
- Secure payload processing

## 📊 Database

Uses SQLite with better-sqlite3 for optimal serverless performance:

- **Payments**: Payment records and metadata
- **Payment Events**: Audit trail of payment events
- **Webhook Logs**: Complete webhook processing history
- **Users**: User account information
- **Appointments**: Consultation appointments
- **Consultations**: Available consultation types

## 🌐 Webhook Configuration

After deployment, configure webhooks in your provider dashboards:

### Stripe
1. Go to Stripe Dashboard > Webhooks
2. Add endpoint: `https://your-api.vercel.app/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`
4. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Paystack
1. Go to Paystack Dashboard > Settings > Webhooks
2. Add endpoint: `https://your-api.vercel.app/api/webhooks/paystack`
3. Select events: `charge.success`, `charge.failed`
4. Copy webhook secret to `PAYSTACK_WEBHOOK_SECRET`

## 📈 Monitoring

### Health Check
```bash
curl https://your-api.vercel.app/api/health
```

### Payment Statistics
```bash
curl "https://your-api.vercel.app/api/payments/stats?startDate=2024-01-01&endDate=2024-12-31"
```

### Webhook Logs
```bash
curl "https://your-api.vercel.app/api/webhooks/logs?provider=stripe&processed=true"
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure SQLite database directory exists
   - Check file permissions in /tmp

2. **Webhook Failures**
   - Verify webhook URLs are accessible
   - Check webhook secrets match
   - Review webhook logs via API

3. **Rate Limit Issues**
   - Implement exponential backoff
   - Consider upgrading rate limits
   - Use authentication for higher limits

4. **Environment Variables**
   - Ensure all required variables are set
   - Check variable names match exactly
   - Verify secrets are not expired

### Debug Mode

Set `NODE_ENV=development` for detailed logging:
```bash
vercel env add NODE_ENV development
```

## 🤝 Support

For issues and questions:
1. Check the troubleshooting section
2. Review API logs in Vercel dashboard
3. Test with provided endpoints
4. Open an issue with detailed logs

## 📄 License

This project is licensed under the MIT License.

---

## Migration from Express.js

This serverless version maintains full compatibility with the original Express.js API:

- ✅ All endpoints preserved
- ✅ Same request/response formats
- ✅ Identical authentication
- ✅ Same webhook handling
- ✅ Database schema compatibility
- ✅ Environment variable names

Simply update your frontend to point to the new Vercel deployment URL.