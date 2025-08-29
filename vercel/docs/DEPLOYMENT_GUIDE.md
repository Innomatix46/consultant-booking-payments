# Vercel Deployment Guide

## Overview
This guide covers the complete deployment process for the consultation booking platform on Vercel, including environment setup, database migration, and production configuration.

## Prerequisites
- [Vercel CLI](https://vercel.com/cli) installed globally
- Node.js 18+ installed
- Git repository connected to Vercel
- Payment provider accounts (Stripe, Paystack)
- Database service account (PostgreSQL recommended for production)

## Quick Start

### 1. Install Vercel CLI
```bash
npm install -g vercel
vercel login
```

### 2. Link Project to Vercel
```bash
vercel link
```

### 3. Set Environment Variables
```bash
# Copy and edit the environment template
cp vercel/.env.template .env.local

# Or set directly in Vercel
vercel env add STRIPE_SECRET_KEY production
vercel env add DATABASE_URL production
# ... add all required variables
```

### 4. Deploy
```bash
# Preview deployment
npm run deploy:preview

# Production deployment
npm run deploy:production
```

## Environment Variables

### Required Variables
```env
# Payment Providers
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Security
JWT_SECRET=your-super-secret-key

# Application URLs
FRONTEND_URL=https://your-domain.vercel.app
ALLOWED_ORIGINS=https://your-domain.vercel.app
```

### Optional Variables
```env
# Error Tracking
SENTRY_DSN=https://...@sentry.io/...

# Email Service
EMAIL_SERVICE_API_KEY=...
EMAIL_FROM=noreply@your-domain.com

# Monitoring
UPTIME_ROBOT_API_KEY=...
```

## Database Setup

### Development (SQLite)
```bash
# Use local SQLite for development
DATABASE_URL="file:./consultation.db"
npm run db:init
npm run db:seed
```

### Production (PostgreSQL)
1. **Create PostgreSQL Database**
   ```bash
   # Using Vercel Postgres
   vercel postgres create consultation-db

   # Or use external provider (Railway, Supabase, etc.)
   # Get connection string and add to environment variables
   ```

2. **Run Migrations**
   ```bash
   npm run db:migrate
   npm run db:init
   ```

3. **Verify Database Connection**
   ```bash
   vercel dev
   # Test API endpoints locally
   ```

## Deployment Process

### Automated Deployment (Recommended)
```bash
# Use the deployment script
node vercel/scripts/deploy.js --production

# Or with custom options
node vercel/scripts/deploy.js --production --skip-tests
```

### Manual Deployment
```bash
# 1. Run tests
npm test

# 2. Build project
npm run build

# 3. Deploy to preview
vercel

# 4. Deploy to production
vercel --prod
```

## Configuration Files

### vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.html",
      "use": "@vercel/static"
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### API Routes Structure
```
vercel/
└── api/
    ├── payments.js          # Payment processing
    ├── webhooks/
    │   ├── stripe.js       # Stripe webhooks
    │   └── paystack.js     # Paystack webhooks
    └── appointments.js     # Appointment management
```

## Security Configuration

### Headers
- CORS policy configured for allowed origins
- Security headers (HSTS, CSP, X-Frame-Options)
- Rate limiting implemented

### Environment Security
- Never commit secrets to git
- Use Vercel environment variables
- Rotate keys regularly
- Enable webhook signature verification

## Performance Optimization

### Function Configuration
```json
{
  "functions": {
    "api/**/*.js": {
      "memory": 256,
      "maxDuration": 30
    }
  }
}
```

### Caching Strategy
- Static assets cached automatically
- API responses with appropriate cache headers
- Database query optimization

### Regions Configuration
```json
{
  "regions": ["fra1", "lhr1", "iad1"]
}
```

## Monitoring & Error Tracking

### Sentry Integration
```javascript
// Add to serverless functions
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

### Vercel Analytics
```bash
# Enable analytics
vercel analytics
```

### Custom Monitoring
```javascript
// Add to critical endpoints
console.log('Payment processed:', {
  paymentId,
  amount,
  provider,
  timestamp: new Date().toISOString()
});
```

## Custom Domains & SSL

### Add Custom Domain
```bash
vercel domains add your-domain.com
vercel domains verify your-domain.com
```

### SSL Configuration
- Automatic SSL certificates via Let's Encrypt
- Custom certificates supported
- Redirect HTTP to HTTPS enabled

## Testing Procedures

### Pre-deployment Testing
```bash
# Run all tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Security tests
npm run test:security
```

### Staging Environment Testing
```bash
# Deploy to preview
vercel

# Test with staging data
# - Payment flows
# - Webhook handling
# - Database operations
# - Error scenarios
```

### Production Validation
```bash
# Health check
curl https://your-domain.vercel.app/api/health

# Payment test (use test keys)
curl -X POST https://your-domain.vercel.app/api/payments \
  -H "Content-Type: application/json" \
  -d '{"provider":"stripe","amount":100,"currency":"EUR"}'
```

## Rollback Procedures

### Automatic Rollback
```bash
# Rollback to previous deployment
vercel rollback
```

### Manual Rollback
```bash
# List deployments
vercel list

# Promote specific deployment
vercel promote <deployment-url>
```

### Database Rollback
```sql
-- Backup before migrations
pg_dump $DATABASE_URL > backup.sql

-- Rollback schema changes if needed
-- (Create rollback migrations)
```

## Environment Management

### Branch Deployments
- `main` branch → Production
- `develop` branch → Preview
- Feature branches → Preview

### Environment-specific Configuration
```javascript
const config = {
  development: {
    LOG_LEVEL: 'debug',
    RATE_LIMIT_MAX: 1000
  },
  preview: {
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 500
  },
  production: {
    LOG_LEVEL: 'error',
    RATE_LIMIT_MAX: 100
  }
};
```

## CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main, develop]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loading**
   ```bash
   # Check environment variables
   vercel env ls
   
   # Add missing variables
   vercel env add VARIABLE_NAME production
   ```

2. **Database Connection Failures**
   ```bash
   # Test database connection
   node -e "
   import { createConnection } from './vercel/scripts/database-connection.js';
   createConnection(process.env.DATABASE_URL).then(() => 
     console.log('✅ Database connected')
   ).catch(console.error);
   "
   ```

3. **Function Timeout Issues**
   ```json
   // Increase timeout in vercel.json
   {
     "functions": {
       "api/**/*.js": {
         "maxDuration": 60
       }
     }
   }
   ```

4. **CORS Issues**
   ```javascript
   // Check allowed origins
   const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
   ```

### Getting Help
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- Check deployment logs: `vercel logs <deployment-url>`
- Monitor function logs in Vercel dashboard

## Maintenance Tasks

### Regular Maintenance
- Monitor error rates and performance
- Update dependencies monthly
- Rotate API keys quarterly
- Review and update security headers
- Database cleanup and optimization

### Performance Monitoring
```bash
# Check function performance
vercel logs --since=1h

# Monitor error rates
# Use Sentry or Vercel Analytics
```

## Cost Optimization

### Function Optimization
- Minimize cold start times
- Optimize memory usage
- Use appropriate timeout settings
- Cache frequently accessed data

### Bandwidth Optimization
- Enable compression
- Optimize asset sizes
- Use CDN for static assets
- Implement efficient caching strategies

---

For additional support or questions, refer to the project documentation or contact the development team.