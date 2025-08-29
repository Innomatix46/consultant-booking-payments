#!/usr/bin/env node
// Vercel Deployment Script with Pre-deployment Checks

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REQUIRED_FILES = [
  'vercel.json',
  'package.json',
  'index.html'
];

const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'PAYSTACK_SECRET_KEY',
  'DATABASE_URL',
  'JWT_SECRET'
];

function checkRequiredFiles() {
  console.log('📁 Checking required files...');
  
  const missing = REQUIRED_FILES.filter(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    if (!exists) {
      console.error(`❌ Missing required file: ${file}`);
    } else {
      console.log(`✅ Found: ${file}`);
    }
    return !exists;
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required files: ${missing.join(', ')}`);
  }
}

function checkEnvironmentVariables() {
  console.log('🔐 Checking environment variables...');
  
  // Load environment from .env.local if it exists
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key] = value;
      }
    });
  }
  
  const missing = REQUIRED_ENV_VARS.filter(key => {
    const exists = !!process.env[key];
    if (!exists) {
      console.error(`❌ Missing environment variable: ${key}`);
    } else {
      console.log(`✅ Found: ${key}`);
    }
    return !exists;
  });
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing environment variables: ${missing.join(', ')}`);
    console.warn('These will need to be set in Vercel dashboard or via CLI');
  }
}

function runTests() {
  console.log('🧪 Running tests...');
  
  try {
    execSync('npm test', { stdio: 'inherit' });
    console.log('✅ All tests passed');
  } catch (error) {
    console.error('❌ Tests failed');
    throw error;
  }
}

function buildProject() {
  console.log('🔨 Building project...');
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build successful');
  } catch (error) {
    console.error('❌ Build failed');
    throw error;
  }
}

function deployToVercel(environment = 'preview') {
  console.log(`🚀 Deploying to Vercel (${environment})...`);
  
  const deployCmd = environment === 'production' 
    ? 'vercel --prod --yes' 
    : 'vercel --yes';
  
  try {
    execSync(deployCmd, { stdio: 'inherit' });
    console.log(`✅ Deployment to ${environment} successful`);
  } catch (error) {
    console.error(`❌ Deployment to ${environment} failed`);
    throw error;
  }
}

function setEnvironmentVariables() {
  console.log('🔧 Setting environment variables in Vercel...');
  
  const envVars = [
    { key: 'NODE_ENV', value: 'production', target: 'production' },
    { key: 'STRIPE_SECRET_KEY', value: process.env.STRIPE_SECRET_KEY, target: 'production,preview' },
    { key: 'STRIPE_WEBHOOK_SECRET', value: process.env.STRIPE_WEBHOOK_SECRET, target: 'production,preview' },
    { key: 'PAYSTACK_SECRET_KEY', value: process.env.PAYSTACK_SECRET_KEY, target: 'production,preview' },
    { key: 'PAYSTACK_WEBHOOK_SECRET', value: process.env.PAYSTACK_WEBHOOK_SECRET, target: 'production,preview' },
    { key: 'DATABASE_URL', value: process.env.DATABASE_URL, target: 'production,preview' },
    { key: 'JWT_SECRET', value: process.env.JWT_SECRET, target: 'production,preview' },
    { key: 'FRONTEND_URL', value: process.env.FRONTEND_URL, target: 'production' },
    { key: 'ALLOWED_ORIGINS', value: process.env.ALLOWED_ORIGINS, target: 'production' }
  ];
  
  envVars.forEach(({ key, value, target }) => {
    if (value) {
      try {
        execSync(`vercel env add ${key} ${target} < <(echo "${value}")`, { 
          stdio: 'inherit',
          shell: '/bin/bash'
        });
        console.log(`✅ Set ${key} for ${target}`);
      } catch (error) {
        console.warn(`⚠️ Failed to set ${key}: ${error.message}`);
      }
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  const environment = args.includes('--production') ? 'production' : 'preview';
  const skipTests = args.includes('--skip-tests');
  const skipBuild = args.includes('--skip-build');
  const setEnv = args.includes('--set-env');
  
  try {
    console.log('🚀 Starting Vercel deployment process...\n');
    
    // Pre-deployment checks
    checkRequiredFiles();
    checkEnvironmentVariables();
    
    // Set environment variables if requested
    if (setEnv) {
      setEnvironmentVariables();
      return;
    }
    
    // Run tests unless skipped
    if (!skipTests) {
      runTests();
    }
    
    // Build project unless skipped
    if (!skipBuild) {
      buildProject();
    }
    
    // Deploy to Vercel
    deployToVercel(environment);
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify deployment at the provided URL');
    console.log('2. Test payment functionality');
    console.log('3. Monitor logs for any issues');
    console.log('4. Set up custom domain if needed');
    
  } catch (error) {
    console.error('\n💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as deploy };