#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const log = (message) => {
  console.log(`[DEPLOY] ${message}`);
};

const error = (message) => {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
};

const runCommand = (command, description) => {
  log(description);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (err) {
    error(`Failed to ${description.toLowerCase()}: ${err.message}`);
  }
};

const checkEnvironmentVariables = () => {
  log('Checking environment variables...');
  
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'PAYSTACK_SECRET_KEY',
    'FRONTEND_URL'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
  
  log('Environment variables check passed');
};

const checkFiles = () => {
  log('Checking required files...');
  
  const requiredFiles = [
    'vercel.json',
    'package.json',
    'api/health.js'
  ];

  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  log('File check passed');
};

const main = () => {
  log('Starting Vercel deployment process...');
  
  // Pre-deployment checks
  checkFiles();
  checkEnvironmentVariables();
  
  // Install dependencies
  runCommand('npm install', 'Installing dependencies');
  
  // Run tests if they exist
  if (fs.existsSync('package.json')) {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (packageJson.scripts && packageJson.scripts.test) {
      log('Running tests...');
      try {
        runCommand('npm test', 'Running tests');
      } catch (err) {
        log('Tests failed, but continuing with deployment...');
      }
    }
  }
  
  // Deploy to Vercel
  const deploymentType = process.argv.includes('--production') ? 'production' : 'preview';
  const deployCommand = deploymentType === 'production' ? 'vercel --prod' : 'vercel';
  
  runCommand(deployCommand, `Deploying to Vercel (${deploymentType})`);
  
  log('Deployment completed successfully!');
  log('');
  log('Next steps:');
  log('1. Update your webhook URLs in Stripe and Paystack dashboards');
  log('2. Test payment flows in the deployed environment');
  log('3. Monitor logs for any issues');
};

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/deploy.js [options]

Options:
  --production    Deploy to production (default: preview)
  --help, -h      Show this help message

Examples:
  node scripts/deploy.js              # Deploy to preview
  node scripts/deploy.js --production # Deploy to production
  `);
  process.exit(0);
}

main();