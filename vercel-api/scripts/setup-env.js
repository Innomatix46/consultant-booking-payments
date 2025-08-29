#!/usr/bin/env node
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const log = (message) => {
  console.log(`[SETUP] ${message}`);
};

const error = (message) => {
  console.error(`[ERROR] ${message}`);
  process.exit(1);
};

const question = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

const runVercelCommand = (command, description) => {
  log(description);
  try {
    execSync(`vercel ${command}`, { stdio: 'inherit' });
  } catch (err) {
    error(`Failed to ${description.toLowerCase()}: ${err.message}`);
  }
};

const setupEnvironmentVariables = async () => {
  log('Setting up environment variables in Vercel...');
  
  const envVars = [
    {
      name: 'NODE_ENV',
      description: 'Environment (production)',
      default: 'production'
    },
    {
      name: 'FRONTEND_URL',
      description: 'Your frontend URL (e.g., https://your-app.vercel.app)',
      required: true
    },
    {
      name: 'STRIPE_SECRET_KEY',
      description: 'Stripe Secret Key (sk_...)',
      required: true,
      secret: true
    },
    {
      name: 'STRIPE_PUBLIC_KEY',
      description: 'Stripe Public Key (pk_...)',
      required: true
    },
    {
      name: 'STRIPE_WEBHOOK_SECRET',
      description: 'Stripe Webhook Secret (whsec_...)',
      required: true,
      secret: true
    },
    {
      name: 'PAYSTACK_SECRET_KEY',
      description: 'Paystack Secret Key (sk_...)',
      required: true,
      secret: true
    },
    {
      name: 'PAYSTACK_PUBLIC_KEY',
      description: 'Paystack Public Key (pk_...)',
      required: true
    },
    {
      name: 'PAYSTACK_WEBHOOK_SECRET',
      description: 'Paystack Webhook Secret',
      required: true,
      secret: true
    }
  ];

  for (const envVar of envVars) {
    let value;
    
    if (envVar.default) {
      const input = await question(`${envVar.description} [${envVar.default}]: `);
      value = input.trim() || envVar.default;
    } else {
      do {
        value = await question(`${envVar.description}: `);
        value = value.trim();
        
        if (envVar.required && !value) {
          log(`${envVar.name} is required. Please provide a value.`);
        }
      } while (envVar.required && !value);
    }

    if (value) {
      const command = `env add ${envVar.name} ${envVar.secret ? 'production preview development' : 'production preview development'}`;
      
      try {
        // Set environment variable in Vercel
        execSync(`echo "${value}" | vercel env add ${envVar.name} production preview development`, { 
          stdio: ['pipe', 'inherit', 'inherit'],
          input: value 
        });
        log(`✓ Set ${envVar.name}`);
      } catch (err) {
        log(`⚠ Failed to set ${envVar.name}: ${err.message}`);
        log('You can set this manually in the Vercel dashboard');
      }
    }
  }
};

const main = async () => {
  log('Vercel Environment Setup');
  log('This script will help you configure environment variables for your payment API');
  log('');

  // Check if vercel CLI is installed
  try {
    execSync('vercel --version', { stdio: 'ignore' });
  } catch (err) {
    error('Vercel CLI is not installed. Please install it with: npm install -g vercel');
  }

  // Login to Vercel if needed
  try {
    execSync('vercel whoami', { stdio: 'ignore' });
  } catch (err) {
    log('Please login to Vercel...');
    runVercelCommand('login', 'Logging into Vercel');
  }

  // Link project if needed
  try {
    execSync('vercel ls', { stdio: 'ignore' });
  } catch (err) {
    log('Linking project to Vercel...');
    runVercelCommand('link', 'Linking project');
  }

  await setupEnvironmentVariables();

  log('');
  log('Environment setup completed!');
  log('');
  log('Next steps:');
  log('1. Run "npm run deploy" to deploy your API');
  log('2. Update webhook URLs in Stripe and Paystack:');
  log('   - Stripe: https://your-api.vercel.app/api/webhooks/stripe');
  log('   - Paystack: https://your-api.vercel.app/api/webhooks/paystack');
  log('3. Test your payment flows');

  rl.close();
};

main().catch(err => {
  error(err.message);
});