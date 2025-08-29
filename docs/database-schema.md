# Database Schema Design
## Payment System Data Model

### Schema Overview

The database schema is designed for:
- Multi-provider payment support
- Complete audit trail
- Scalable architecture
- Data consistency and integrity

### Core Tables

#### 1. payment_intents
```sql
CREATE TABLE payment_intents (
  id VARCHAR(255) PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL, -- Provider's payment intent ID
  provider ENUM('stripe', 'paystack') NOT NULL,
  amount INTEGER NOT NULL, -- Amount in smallest currency unit
  currency VARCHAR(3) NOT NULL,
  status ENUM(
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'succeeded',
    'canceled',
    'requires_capture'
  ) NOT NULL DEFAULT 'requires_payment_method',
  
  -- Customer information
  customer_id VARCHAR(255),
  customer_email VARCHAR(255),
  
  -- Payment method details
  payment_method_id VARCHAR(255),
  payment_method_type VARCHAR(50),
  
  -- Metadata and tracking
  metadata JSON,
  client_secret VARCHAR(255),
  return_url TEXT,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  confirmed_at TIMESTAMP NULL,
  canceled_at TIMESTAMP NULL,
  
  -- Indexes
  INDEX idx_provider_external_id (provider, external_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  
  -- Foreign key constraints
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
```

#### 2. customers
```sql
CREATE TABLE customers (
  id VARCHAR(255) PRIMARY KEY,
  stripe_customer_id VARCHAR(255) UNIQUE,
  paystack_customer_id VARCHAR(255) UNIQUE,
  
  -- Personal information (encrypted)
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  
  -- Address information
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(2),
  
  -- Account status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  UNIQUE INDEX idx_email (email),
  INDEX idx_stripe_customer_id (stripe_customer_id),
  INDEX idx_paystack_customer_id (paystack_customer_id),
  INDEX idx_created_at (created_at)
);
```

#### 3. payment_methods
```sql
CREATE TABLE payment_methods (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  provider ENUM('stripe', 'paystack') NOT NULL,
  external_id VARCHAR(255) NOT NULL, -- Provider's payment method ID
  
  -- Payment method details
  type ENUM('card', 'bank_account', 'wallet') NOT NULL,
  
  -- Card details (for display purposes only)
  card_brand VARCHAR(20),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  card_country VARCHAR(2),
  
  -- Bank account details
  bank_name VARCHAR(100),
  account_last4 VARCHAR(4),
  
  -- Status and metadata
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSON,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_customer_id (customer_id),
  INDEX idx_provider_external_id (provider, external_id),
  INDEX idx_type (type),
  
  -- Foreign key constraints
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
```

#### 4. transactions
```sql
CREATE TABLE transactions (
  id VARCHAR(255) PRIMARY KEY,
  payment_intent_id VARCHAR(255) NOT NULL,
  type ENUM('payment', 'refund', 'capture', 'cancel') NOT NULL,
  
  -- Transaction details
  amount INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status ENUM('pending', 'succeeded', 'failed', 'canceled') NOT NULL,
  
  -- Provider information
  provider ENUM('stripe', 'paystack') NOT NULL,
  provider_transaction_id VARCHAR(255),
  provider_charge_id VARCHAR(255),
  
  -- Error handling
  failure_code VARCHAR(100),
  failure_message TEXT,
  
  -- Metadata
  metadata JSON,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  
  -- Indexes
  INDEX idx_payment_intent_id (payment_intent_id),
  INDEX idx_provider_transaction_id (provider, provider_transaction_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  
  -- Foreign key constraints
  FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id) ON DELETE CASCADE
);
```

#### 5. webhook_events
```sql
CREATE TABLE webhook_events (
  id VARCHAR(255) PRIMARY KEY,
  provider ENUM('stripe', 'paystack') NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL, -- Provider's event ID
  
  -- Event data
  data JSON NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP NULL,
  
  -- Retry mechanism
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMP NULL,
  
  -- Error tracking
  last_error TEXT NULL,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  UNIQUE INDEX idx_provider_event_id (provider, event_id),
  INDEX idx_event_type (event_type),
  INDEX idx_processed (processed),
  INDEX idx_next_retry_at (next_retry_at),
  INDEX idx_created_at (created_at)
);
```

#### 6. audit_logs
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  
  -- Entity information
  entity_type ENUM('payment_intent', 'customer', 'payment_method', 'transaction') NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  
  -- Action details
  action VARCHAR(50) NOT NULL, -- create, update, delete, confirm, capture, refund
  old_values JSON,
  new_values JSON,
  
  -- User and system context
  user_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Provider context
  provider ENUM('stripe', 'paystack'),
  provider_request_id VARCHAR(255),
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id)
);
```

### Additional Configuration Tables

#### 7. provider_configurations
```sql
CREATE TABLE provider_configurations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  provider ENUM('stripe', 'paystack') NOT NULL,
  environment ENUM('live', 'test') NOT NULL,
  
  -- Configuration settings
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 1, -- For failover ordering
  
  -- API configuration (encrypted)
  api_key_encrypted TEXT NOT NULL,
  webhook_secret_encrypted TEXT NOT NULL,
  
  -- Feature flags
  supports_3d_secure BOOLEAN DEFAULT TRUE,
  supports_recurring BOOLEAN DEFAULT TRUE,
  
  -- Rate limiting
  rate_limit_per_second INTEGER DEFAULT 100,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  UNIQUE INDEX idx_provider_environment (provider, environment)
);
```

### Database Indexes Strategy

#### Performance Indexes
- **payment_intents**: Composite index on (status, created_at) for dashboard queries
- **transactions**: Composite index on (created_at, status) for reporting
- **webhook_events**: Composite index on (processed, next_retry_at) for retry processing
- **audit_logs**: Partitioned by month for efficient querying

#### Data Integrity
- Foreign key constraints ensure referential integrity
- Unique constraints prevent duplicate records
- Check constraints validate enum values and data ranges

### Data Encryption Strategy

#### Sensitive Data Fields (AES-256 Encryption)
- Customer email addresses
- Payment method tokens
- Provider API keys
- Webhook secrets

#### PII Data Handling
- Customer names and addresses are encrypted at rest
- Credit card information is never stored (only tokens)
- Audit logs exclude sensitive payment data

### Backup and Recovery

#### Daily Backups
- Full database backup at 2 AM UTC
- Transaction log backups every 15 minutes
- Cross-region backup replication

#### Point-in-Time Recovery
- 30-day retention for transaction logs
- Automated recovery testing monthly