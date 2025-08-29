# Environment Setup Guide for Vercel Deployment

## Overview
This guide walks you through setting up environment variables and configuration for deploying the consultation booking platform to Vercel.

## Environment Variables

### Required Variables (All Environments)

#### Payment Providers
```bash
# Stripe Configuration
STRIPE_SECRET_KEY="sk_live_..."  # Production: sk_live_..., Test: sk_test_...
STRIPE_WEBHOOK_SECRET="whsec_..."  # Webhook endpoint secret from Stripe dashboard

# Paystack Configuration  
PAYSTACK_SECRET_KEY="sk_live_..."  # Production: sk_live_..., Test: sk_test_...
PAYSTACK_WEBHOOK_SECRET="..."  # Webhook secret from Paystack settings
```

#### Database
```bash
# Production: PostgreSQL recommended
DATABASE_URL="postgresql://username:password@host:port/database?ssl=true"

# Development: SQLite (file-based)
DATABASE_URL="file:./consultation.db"
```

#### Security
```bash
# Strong random string for JWT signing
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters"
```

### Environment-Specific Variables

#### Production Only
```bash
# Application URLs
FRONTEND_URL="https://your-domain.vercel.app"
ALLOWED_ORIGINS="https://your-domain.vercel.app,https://www.your-domain.com"

# Error Tracking (Recommended)
SENTRY_DSN="https://your-key@sentry.io/project-id"

# Email Service (Optional)
EMAIL_SERVICE_API_KEY="your-email-api-key"
EMAIL_FROM="noreply@your-domain.com"
```

#### Development & Preview
```bash
# Local development URLs
FRONTEND_URL="http://localhost:3000"
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173"

# Debug logging
LOG_LEVEL="debug"
```

## Setup Methods

### Method 1: Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Add environment variables one by one
vercel env add STRIPE_SECRET_KEY production
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production

# List all environment variables
vercel env ls
```

### Method 2: Vercel Dashboard
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable with appropriate environment scope

### Method 3: Bulk Import
```bash
# Create .env.production file
cat > .env.production << 'EOF'
STRIPE_SECRET_KEY=sk_live_...
PAYSTACK_SECRET_KEY=sk_live_...
DATABASE_URL=postgresql://...
JWT_SECRET=your-super-secret-key
FRONTEND_URL=https://your-domain.vercel.app
ALLOWED_ORIGINS=https://your-domain.vercel.app
EOF

# Import using Vercel CLI
vercel env add production < .env.production
```

## Database Setup

### Option 1: Vercel Postgres (Recommended)
```bash
# Create Vercel Postgres database
vercel postgres create consultation-db --region fra1

# Get connection string
vercel postgres connect consultation-db

# The connection string will be automatically added to your environment
```

### Option 2: External PostgreSQL
Popular providers:
- **Supabase**: Free tier available, excellent for development
- **Railway**: Simple setup, good pricing
- **AWS RDS**: Enterprise-grade, more complex setup
- **DigitalOcean Managed Databases**: Balanced option

Example setup with Supabase:
```bash
# 1. Create account at supabase.com
# 2. Create new project
# 3. Go to Settings → Database
# 4. Copy connection string
# 5. Add to Vercel environment variables
```

### Option 3: SQLite (Development Only)
```bash
# Only use SQLite for development
DATABASE_URL="file:./consultation.db"

# Note: SQLite doesn't work well with Vercel's serverless functions
# for production due to file system limitations
```

## Payment Provider Setup

### Stripe Configuration
1. **Create Stripe Account**
   - Go to [stripe.com](https://stripe.com)
   - Complete account verification for live payments

2. **Get API Keys**
   ```bash
   # Test keys (for development)
   STRIPE_SECRET_KEY="sk_test_..."
   STRIPE_PUBLISHABLE_KEY="pk_test_..."
   
   # Live keys (for production)
   STRIPE_SECRET_KEY="sk_live_..."
   STRIPE_PUBLISHABLE_KEY="pk_live_..."
   ```

3. **Setup Webhook**
   - Go to Stripe Dashboard → Webhooks
   - Add endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### Paystack Configuration
1. **Create Paystack Account**
   - Go to [paystack.com](https://paystack.com)
   - Complete business verification

2. **Get API Keys**
   ```bash
   # Test keys
   PAYSTACK_SECRET_KEY="sk_test_..."
   PAYSTACK_PUBLIC_KEY="pk_test_..."
   
   # Live keys  
   PAYSTACK_SECRET_KEY="sk_live_..."
   PAYSTACK_PUBLIC_KEY="pk_live_..."
   ```

3. **Setup Webhook**
   - Go to Paystack Dashboard → Settings → Webhooks
   - Add URL: `https://your-domain.vercel.app/api/webhooks/paystack`
   - Copy webhook secret to `PAYSTACK_WEBHOOK_SECRET`

## Security Considerations

### JWT Secret Generation
```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use online generator (ensure it's from a trusted source)
# https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx
```

### Environment Variable Security
- ✅ **DO**: Use different keys for different environments
- ✅ **DO**: Rotate keys regularly (quarterly recommended)
- ✅ **DO**: Use minimum required permissions
- ❌ **DON'T**: Commit secrets to Git
- ❌ **DON'T**: Share production keys via insecure channels
- ❌ **DON'T**: Use the same keys across projects

### Access Control
```bash
# Set environment variable scope appropriately
vercel env add SECRET_KEY production    # Production only
vercel env add SECRET_KEY preview       # Preview deployments only
vercel env add SECRET_KEY development   # Development only
```

## Testing Configuration

### Local Development
```bash
# Create .env.local for local testing
cp vercel/.env.template .env.local

# Edit values for local development
# Use test API keys, local database, etc.
```

### Environment Validation
```bash
# Test environment variables
node -e "
const required = ['STRIPE_SECRET_KEY', 'DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing:', missing);
  process.exit(1);
} else {
  console.log('✅ All required variables present');
}
"
```

### Health Check
```bash
# Test deployment health
curl https://your-domain.vercel.app/api/health

# Should return status: "healthy" for successful setup
```

## Common Issues & Solutions

### Issue 1: Database Connection Failed
```bash
# Check DATABASE_URL format
echo $DATABASE_URL

# Test connection manually
node -e "
import pg from 'pg';
const client = new pg.Client(process.env.DATABASE_URL);
client.connect().then(() => console.log('✅ Connected')).catch(console.error);
"
```

### Issue 2: Payment Webhook Verification Failed
```bash
# Verify webhook secret is correct
# Check webhook URL in payment provider dashboard
# Ensure HTTPS is used (not HTTP)

# Test webhook locally with ngrok
npm install -g ngrok
ngrok http 3000
# Use ngrok URL for webhook testing
```

### Issue 3: CORS Issues
```bash
# Check ALLOWED_ORIGINS matches your domain exactly
# Include both www and non-www versions if needed
ALLOWED_ORIGINS="https://example.com,https://www.example.com"
```

### Issue 4: Environment Variables Not Loading
```bash
# List current environment variables
vercel env ls

# Re-deploy to apply new environment variables
vercel --prod --force
```

## Environment Migration

### From Development to Production
```bash
# 1. Backup development database
pg_dump $DEV_DATABASE_URL > dev_backup.sql

# 2. Setup production database
vercel postgres create prod-consultation-db

# 3. Migrate schema (not data) to production
psql $PROD_DATABASE_URL < schema.sql

# 4. Update environment variables
vercel env add DATABASE_URL production
vercel env add STRIPE_SECRET_KEY production  # Use live keys
vercel env add FRONTEND_URL production

# 5. Deploy
vercel --prod
```

### Environment Promotion
```bash
# Copy environment from preview to production
vercel env ls preview > preview_env.txt
# Manually review and add to production with appropriate values
```

## Monitoring Setup

### Error Tracking with Sentry
```bash
# 1. Create Sentry account
# 2. Create new project
# 3. Get DSN from project settings
# 4. Add to environment variables
vercel env add SENTRY_DSN production

# 5. Verify integration
curl https://your-domain.vercel.app/api/health
# Check Sentry dashboard for events
```

### Uptime Monitoring
```bash
# Setup uptime monitoring for:
# - https://your-domain.vercel.app/api/health
# - https://your-domain.vercel.app/api/payments (POST with test data)
# - https://your-domain.vercel.app/ (main app)

# Popular services:
# - UptimeRobot (free tier available)
# - Pingdom
# - StatusCake
```

## Backup & Recovery

### Environment Variables Backup
```bash
# Export all environment variables
vercel env ls production --json > env_backup_$(date +%Y%m%d).json

# Store securely (not in Git repository)
```

### Database Backup
```bash
# Regular database backups
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script
crontab -e
# Add: 0 2 * * * pg_dump $DATABASE_URL > /backups/daily_$(date +\%Y\%m\%d).sql
```

---

**Next Steps**: After setting up environment variables, proceed to the [Deployment Guide](./DEPLOYMENT_GUIDE.md) for the complete deployment process.