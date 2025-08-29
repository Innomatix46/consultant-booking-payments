# Performance Optimization Guide for Vercel Deployment

## Overview
This guide covers performance optimization strategies specifically for serverless deployment on Vercel, including function optimization, caching, and monitoring.

## Serverless Function Optimization

### Function Size & Cold Starts
```javascript
// ❌ Bad: Large bundle with unnecessary imports
import * as _ from 'lodash';
import moment from 'moment';
import { everything } from 'large-library';

// ✅ Good: Minimal imports, lazy loading
import { debounce } from 'lodash/debounce';
import { format } from 'date-fns';

// Lazy load heavy operations
const heavyOperation = () => import('./heavy-operation.js');
```

### Memory Management
```json
// vercel.json - Optimize memory allocation
{
  "functions": {
    "api/payments.js": {
      "memory": 256,
      "maxDuration": 30
    },
    "api/webhooks/*.js": {
      "memory": 128,
      "maxDuration": 15
    },
    "api/reports.js": {
      "memory": 512,
      "maxDuration": 60
    }
  }
}
```

### Connection Pooling & Reuse
```javascript
// Database connection optimization
let cachedConnection = null;

export async function getConnection() {
  if (cachedConnection) {
    return cachedConnection;
  }
  
  cachedConnection = await createConnection(process.env.DATABASE_URL);
  
  // Set connection timeout to prevent hanging
  setTimeout(() => {
    if (cachedConnection?.close) {
      cachedConnection.close();
      cachedConnection = null;
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  return cachedConnection;
}

// HTTP client reuse
import { Agent } from 'https';
const httpsAgent = new Agent({ keepAlive: true });

const apiClient = {
  async request(url, options) {
    return fetch(url, {
      ...options,
      agent: httpsAgent
    });
  }
};
```

## Caching Strategies

### HTTP Caching Headers
```javascript
// API response caching
export default function handler(req, res) {
  // Cache static data for 1 hour
  if (req.url.includes('/api/consultation-types')) {
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  }
  
  // Cache payment status for 5 minutes
  if (req.url.includes('/api/payment/')) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  }
  
  // No cache for sensitive endpoints
  if (req.url.includes('/api/admin')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
}
```

### In-Memory Caching
```javascript
// Simple in-memory cache with TTL
class MemoryCache {
  constructor() {
    this.cache = new Map();
  }
  
  set(key, value, ttlMs = 300000) { // 5 minutes default
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
    
    // Auto cleanup
    setTimeout(() => this.cache.delete(key), ttlMs);
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item || Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
}

const cache = new MemoryCache();

// Usage in API functions
export default async function handler(req, res) {
  const cacheKey = `consultation-types:${req.query.lang || 'en'}`;
  let consultationTypes = cache.get(cacheKey);
  
  if (!consultationTypes) {
    consultationTypes = await fetchConsultationTypes(req.query.lang);
    cache.set(cacheKey, consultationTypes, 600000); // 10 minutes
  }
  
  res.json(consultationTypes);
}
```

### Edge Caching with Vercel
```javascript
// vercel.json - Configure edge caching
{
  "routes": [
    {
      "src": "/api/public/(.*)",
      "dest": "/api/public/$1",
      "headers": {
        "cache-control": "s-maxage=86400, stale-while-revalidate"
      }
    }
  ]
}

// Use Edge Functions for better performance
// api/edge-example.js
export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  return new Response(
    JSON.stringify({ message: 'Hello from the edge!' }),
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=3600'
      }
    }
  );
}
```

## Database Optimization

### Query Optimization
```javascript
// ❌ Bad: Multiple queries
async function getAppointmentDetails(appointmentId) {
  const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
  const payment = await db.get('SELECT * FROM payments WHERE appointment_id = ?', [appointmentId]);
  const user = await db.get('SELECT * FROM users WHERE email = ?', [appointment.user_email]);
  
  return { appointment, payment, user };
}

// ✅ Good: Single join query
async function getAppointmentDetails(appointmentId) {
  return await db.get(`
    SELECT 
      a.*,
      p.status as payment_status,
      p.amount,
      u.name as user_name
    FROM appointments a
    LEFT JOIN payments p ON p.appointment_id = a.id
    LEFT JOIN users u ON u.email = a.user_email
    WHERE a.id = ?
  `, [appointmentId]);
}
```

### Connection Optimization
```javascript
// PostgreSQL optimization
const poolConfig = {
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // 30 seconds
  connectionTimeoutMillis: 2000, // 2 seconds
  statement_timeout: 30000,   // 30 seconds
  query_timeout: 30000,       // 30 seconds
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Index optimization
const createIndexes = `
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_date_status 
  ON appointments(appointment_date, status);
  
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status_created 
  ON payments(status, created_at);
  
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_email 
  ON appointments(user_email);
`;
```

### Database Connection Pooling
```javascript
// Shared connection pool
import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}
```

## Frontend Optimization

### Code Splitting & Lazy Loading
```javascript
// React component lazy loading
import { lazy, Suspense } from 'react';

const PaymentForm = lazy(() => import('./PaymentForm'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/payment" element={<PaymentForm />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </Suspense>
  );
}
```

### Asset Optimization
```javascript
// vite.config.js - Build optimization
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          payment: ['stripe', 'paystack'],
        }
      }
    },
    cssCodeSplit: true,
    sourcemap: false, // Disable in production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
});
```

## Performance Monitoring

### Custom Performance Metrics
```javascript
// Performance monitoring middleware
export function performanceMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const metrics = {
      duration: Number(end - start) / 1000000, // Convert to ms
      memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
      statusCode: res.statusCode,
      method: req.method,
      path: req.url,
      timestamp: new Date().toISOString()
    };
    
    // Log performance metrics
    console.log(JSON.stringify({
      type: 'PERFORMANCE',
      ...metrics
    }));
    
    // Alert on slow requests
    if (metrics.duration > 5000) {
      console.warn(`Slow request detected: ${req.method} ${req.url} took ${metrics.duration}ms`);
    }
  });
  
  if (next) next();
}
```

### Database Query Performance
```javascript
// Query performance wrapper
export async function timedQuery(db, sql, params = []) {
  const start = process.hrtime.bigint();
  
  try {
    const result = await db.query(sql, params);
    const duration = Number(process.hrtime.bigint() - start) / 1000000;
    
    // Log slow queries
    if (duration > 100) { // More than 100ms
      console.warn(`Slow query (${duration}ms):`, sql.substring(0, 100));
    }
    
    return result;
  } catch (error) {
    const duration = Number(process.hrtime.bigint() - start) / 1000000;
    console.error(`Query failed (${duration}ms):`, error.message);
    throw error;
  }
}
```

## Load Testing & Benchmarking

### API Load Testing
```javascript
// tests/performance/load-test.js
import autocannon from 'autocannon';

async function runLoadTest() {
  const result = await autocannon({
    url: 'https://your-domain.vercel.app',
    connections: 10,
    pipelining: 1,
    duration: 30, // 30 seconds
    requests: [
      {
        method: 'GET',
        path: '/api/health'
      },
      {
        method: 'POST',
        path: '/api/payments',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          provider: 'stripe',
          amount: 100,
          currency: 'EUR'
        })
      }
    ]
  });
  
  console.log('Load test results:', result);
}

runLoadTest();
```

### Performance Budget
```javascript
// Performance budget configuration
const PERFORMANCE_BUDGET = {
  // Function execution time
  maxFunctionDuration: 30000, // 30 seconds
  warningFunctionDuration: 5000, // 5 seconds
  
  // Memory usage
  maxMemoryUsage: 256 * 1024 * 1024, // 256MB
  warningMemoryUsage: 128 * 1024 * 1024, // 128MB
  
  // Response times
  maxApiResponseTime: 2000, // 2 seconds
  maxDatabaseQueryTime: 500, // 500ms
  
  // Bundle sizes
  maxJSBundleSize: 500 * 1024, // 500KB
  maxCSSBundleSize: 100 * 1024, // 100KB
};

// Performance checker
export function checkPerformanceBudget(metrics) {
  const warnings = [];
  const errors = [];
  
  if (metrics.duration > PERFORMANCE_BUDGET.warningFunctionDuration) {
    warnings.push(`Function duration ${metrics.duration}ms exceeds warning threshold`);
  }
  
  if (metrics.duration > PERFORMANCE_BUDGET.maxFunctionDuration) {
    errors.push(`Function duration ${metrics.duration}ms exceeds maximum threshold`);
  }
  
  return { warnings, errors };
}
```

## CDN & Static Asset Optimization

### Static Asset Optimization
```json
// vercel.json - Static asset configuration
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    },
    {
      "source": "/(.*\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2))",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000"
        }
      ]
    }
  ]
}
```

### Image Optimization
```javascript
// Use Vercel's built-in image optimization
// components/OptimizedImage.jsx
import Image from 'next/image';

export function OptimizedImage({ src, alt, width, height }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority // For above-the-fold images
      placeholder="blur" // Show blur while loading
      quality={85} // Optimize quality vs size
    />
  );
}
```

## Region & Edge Configuration

### Multi-Region Deployment
```json
// vercel.json - Region configuration
{
  "regions": ["fra1", "lhr1", "iad1"],
  "functions": {
    "api/payments.js": {
      "regions": ["fra1", "lhr1"] // EU regions for GDPR compliance
    },
    "api/webhooks/*.js": {
      "regions": ["fra1", "iad1"] // Global webhook handling
    }
  }
}
```

### Edge Function Usage
```javascript
// api/edge/geolocation.js
export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  const country = req.headers.get('x-vercel-ip-country');
  const city = req.headers.get('x-vercel-ip-city');
  
  // Customize response based on location
  const currency = country === 'DE' ? 'EUR' : 'USD';
  const language = country === 'DE' ? 'de' : 'en';
  
  return new Response(
    JSON.stringify({ currency, language, country, city }),
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=300' // Cache for 5 minutes
      }
    }
  );
}
```

## Performance Best Practices

### Function Optimization Checklist
- [ ] Minimize function bundle size
- [ ] Reuse database connections
- [ ] Implement proper caching
- [ ] Set appropriate memory limits
- [ ] Use connection pooling
- [ ] Optimize database queries
- [ ] Enable compression
- [ ] Set cache headers appropriately
- [ ] Monitor function execution times
- [ ] Use edge functions for static data

### Database Performance Checklist
- [ ] Add proper indexes
- [ ] Use connection pooling
- [ ] Optimize query structure
- [ ] Monitor slow queries
- [ ] Set query timeouts
- [ ] Use read replicas if needed
- [ ] Regular database maintenance
- [ ] Monitor connection counts

### Frontend Performance Checklist
- [ ] Code splitting implemented
- [ ] Lazy loading for routes
- [ ] Asset optimization
- [ ] Proper caching headers
- [ ] Image optimization
- [ ] Bundle size monitoring
- [ ] Performance budget defined
- [ ] Core Web Vitals monitoring

## Monitoring & Alerting

### Performance Monitoring Setup
```javascript
// Performance monitoring with Vercel Analytics
// vercel.json
{
  "analytics": {
    "enabled": true
  },
  "speedInsights": {
    "enabled": true
  }
}
```

### Custom Alerts
```javascript
// Performance alerting
export function checkPerformanceAlerts(metrics) {
  const alerts = [];
  
  // High response time alert
  if (metrics.duration > 5000) {
    alerts.push({
      type: 'HIGH_RESPONSE_TIME',
      message: `Response time ${metrics.duration}ms exceeds 5s threshold`,
      severity: 'warning'
    });
  }
  
  // High memory usage alert
  if (metrics.memoryUsage > 200 * 1024 * 1024) { // 200MB
    alerts.push({
      type: 'HIGH_MEMORY_USAGE',
      message: `Memory usage ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB exceeds 200MB threshold`,
      severity: 'critical'
    });
  }
  
  // Send alerts to monitoring service
  alerts.forEach(alert => {
    console.error(`PERFORMANCE_ALERT: ${alert.message}`);
    // Send to Slack, email, etc.
  });
  
  return alerts;
}
```

---

**Next Steps**: After implementing performance optimizations, use the [Monitoring Guide](./MONITORING_GUIDE.md) to set up comprehensive performance tracking.