// Health Check Endpoint for Vercel Deployment
import { healthCheck } from '../config/monitoring.js';
import { createConnection } from '../scripts/database-connection.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const checks = {
    server: { status: 'unknown', message: '' },
    database: { status: 'unknown', message: '' },
    environment: { status: 'unknown', message: '' },
    external: { status: 'unknown', message: '' }
  };

  let overallStatus = 'healthy';
  let httpStatus = 200;

  try {
    // Basic server health
    const serverHealth = healthCheck();
    checks.server = {
      status: 'healthy',
      message: 'Server is running',
      details: {
        uptime: serverHealth.uptime,
        memory: serverHealth.memory,
        version: serverHealth.version,
        commit: serverHealth.commit
      }
    };
  } catch (error) {
    checks.server = {
      status: 'unhealthy',
      message: 'Server health check failed',
      error: error.message
    };
    overallStatus = 'degraded';
  }

  // Database connectivity check
  try {
    if (process.env.DATABASE_URL) {
      const db = await createConnection(process.env.DATABASE_URL);
      
      // Simple query to test connection
      await db.get('SELECT 1 as test');
      
      checks.database = {
        status: 'healthy',
        message: 'Database connection successful',
        type: process.env.DATABASE_URL.startsWith('postgresql:') ? 'PostgreSQL' : 'SQLite'
      };
      
      // Close connection if it has close method
      if (typeof db.close === 'function') {
        await db.close();
      }
    } else {
      checks.database = {
        status: 'warning',
        message: 'No database URL configured'
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      message: 'Database connection failed',
      error: error.message
    };
    overallStatus = 'unhealthy';
    httpStatus = 503;
  }

  // Environment variables check
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'PAYSTACK_SECRET_KEY',
    'JWT_SECRET'
  ];

  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missingEnvVars.length === 0) {
    checks.environment = {
      status: 'healthy',
      message: 'All required environment variables present',
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    };
  } else {
    checks.environment = {
      status: 'unhealthy',
      message: `Missing required environment variables: ${missingEnvVars.join(', ')}`,
      missing: missingEnvVars
    };
    overallStatus = 'unhealthy';
    httpStatus = 503;
  }

  // External services check (basic connectivity)
  try {
    const externalChecks = [];
    
    // Check Stripe API connectivity
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripeResponse = await fetch('https://api.stripe.com/v1/balance', {
          headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
          }
        });
        
        if (stripeResponse.ok) {
          externalChecks.push({ service: 'Stripe', status: 'healthy' });
        } else {
          externalChecks.push({ 
            service: 'Stripe', 
            status: 'unhealthy',
            error: `HTTP ${stripeResponse.status}`
          });
        }
      } catch (error) {
        externalChecks.push({ 
          service: 'Stripe', 
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    // Check Paystack API connectivity
    if (process.env.PAYSTACK_SECRET_KEY) {
      try {
        const paystackResponse = await fetch('https://api.paystack.co/bank', {
          headers: {
            'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
          }
        });
        
        if (paystackResponse.ok) {
          externalChecks.push({ service: 'Paystack', status: 'healthy' });
        } else {
          externalChecks.push({ 
            service: 'Paystack', 
            status: 'unhealthy',
            error: `HTTP ${paystackResponse.status}`
          });
        }
      } catch (error) {
        externalChecks.push({ 
          service: 'Paystack', 
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    const unhealthyServices = externalChecks.filter(check => check.status === 'unhealthy');
    
    if (unhealthyServices.length === 0) {
      checks.external = {
        status: 'healthy',
        message: 'All external services accessible',
        services: externalChecks
      };
    } else {
      checks.external = {
        status: 'degraded',
        message: `${unhealthyServices.length} external service(s) unavailable`,
        services: externalChecks
      };
      if (overallStatus === 'healthy') overallStatus = 'degraded';
    }
  } catch (error) {
    checks.external = {
      status: 'unknown',
      message: 'External services check failed',
      error: error.message
    };
    if (overallStatus === 'healthy') overallStatus = 'degraded';
  }

  const healthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
    info: {
      service: 'consultation-booking-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      region: process.env.VERCEL_REGION || 'unknown',
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'unknown'
    }
  };

  // Add performance metrics if available
  if (process.hrtime) {
    const [seconds, nanoseconds] = process.hrtime();
    healthResponse.performance = {
      uptime: process.uptime(),
      responseTime: (seconds * 1000 + nanoseconds / 1000000).toFixed(2) + 'ms',
      memory: process.memoryUsage()
    };
  }

  return res.status(httpStatus).json(healthResponse);
}