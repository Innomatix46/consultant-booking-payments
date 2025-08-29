#!/bin/bash
# Setup secrets for payment system - PCI compliant
# This script should be run in a secure environment with proper access controls

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Environment validation
if [[ "${NODE_ENV:-}" != "production" && "${NODE_ENV:-}" != "staging" ]]; then
    echo -e "${RED}Error: NODE_ENV must be set to 'production' or 'staging'${NC}"
    exit 1
fi

# Check required tools
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}kubectl is required but not installed${NC}"; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo -e "${RED}openssl is required but not installed${NC}"; exit 1; }

NAMESPACE="payment-system"
ENVIRONMENT="${NODE_ENV}"

echo -e "${GREEN}Setting up secrets for payment system (${ENVIRONMENT})${NC}"

# Function to generate secure random strings
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to create or update secret
create_secret() {
    local name=$1
    local value=$2
    local description=$3
    
    echo -e "${YELLOW}Creating secret: ${description}${NC}"
    
    # Check if secret exists
    if kubectl get secret "${name}" -n "${NAMESPACE}" >/dev/null 2>&1; then
        echo -e "${YELLOW}Secret ${name} already exists, updating...${NC}"
        kubectl delete secret "${name}" -n "${NAMESPACE}"
    fi
    
    # Create new secret
    kubectl create secret generic "${name}" \
        --from-literal=value="${value}" \
        --namespace="${NAMESPACE}" \
        --dry-run=client -o yaml | \
    kubectl apply -f -
    
    # Add security labels
    kubectl label secret "${name}" \
        security-tier=high \
        compliance=pci-dss \
        environment="${ENVIRONMENT}" \
        -n "${NAMESPACE}" \
        --overwrite
        
    echo -e "${GREEN}✓ Secret ${name} created successfully${NC}"
}

# Create namespace if it doesn't exist
if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
    echo -e "${YELLOW}Creating namespace ${NAMESPACE}${NC}"
    kubectl create namespace "${NAMESPACE}"
fi

# Generate or prompt for secrets
echo -e "${YELLOW}Setting up application secrets...${NC}"

# Database URL - should be provided via environment or prompt
if [[ -z "${DATABASE_URL:-}" ]]; then
    read -s -p "Enter DATABASE_URL: " DATABASE_URL
    echo
fi

# Stripe secret key - should be provided via environment or prompt
if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
    read -s -p "Enter Stripe Secret Key: " STRIPE_SECRET_KEY
    echo
fi

# Webhook secret - should be provided via environment or prompt
if [[ -z "${WEBHOOK_SECRET:-}" ]]; then
    read -s -p "Enter Stripe Webhook Secret: " WEBHOOK_SECRET
    echo
fi

# Generate JWT secret if not provided
JWT_SECRET="${JWT_SECRET:-$(generate_secret)}"
REDIS_PASSWORD="${REDIS_PASSWORD:-$(generate_secret)}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-$(generate_secret)}"

# Create all secrets
create_secret "db-url" "${DATABASE_URL}" "Database connection string"
create_secret "stripe-secret" "${STRIPE_SECRET_KEY}" "Stripe secret key"
create_secret "jwt-secret" "${JWT_SECRET}" "JWT signing secret"
create_secret "webhook-secret" "${WEBHOOK_SECRET}" "Webhook validation secret"
create_secret "redis-password" "${REDIS_PASSWORD}" "Redis authentication password"
create_secret "grafana-password" "${GRAFANA_PASSWORD}" "Grafana admin password"

# Generate TLS certificates (for development/testing - use proper CA in production)
if [[ "${ENVIRONMENT}" != "production" ]]; then
    echo -e "${YELLOW}Generating self-signed TLS certificate for ${ENVIRONMENT}...${NC}"
    
    # Create temporary directory for certificates
    CERT_DIR=$(mktemp -d)
    cd "${CERT_DIR}"
    
    # Generate private key
    openssl genrsa -out tls.key 4096
    
    # Generate certificate
    openssl req -new -x509 -key tls.key -out tls.crt -days 365 -subj "/CN=api.payment.example.com"
    
    # Create TLS secret
    kubectl create secret tls tls-secret \
        --cert=tls.crt \
        --key=tls.key \
        --namespace="${NAMESPACE}"
    
    # Clean up
    cd - >/dev/null
    rm -rf "${CERT_DIR}"
    
    echo -e "${GREEN}✓ TLS certificate created${NC}"
fi

# Set up Docker secrets for docker-compose
echo -e "${YELLOW}Setting up Docker secrets...${NC}"

DOCKER_SECRETS_DIR="./docker-secrets"
mkdir -p "${DOCKER_SECRETS_DIR}"

echo "${DATABASE_URL}" > "${DOCKER_SECRETS_DIR}/db_url"
echo "${STRIPE_SECRET_KEY}" > "${DOCKER_SECRETS_DIR}/stripe_secret"
echo "${JWT_SECRET}" > "${DOCKER_SECRETS_DIR}/jwt_secret"
echo "${WEBHOOK_SECRET}" > "${DOCKER_SECRETS_DIR}/webhook_secret"
echo "${GRAFANA_PASSWORD}" > "${DOCKER_SECRETS_DIR}/grafana_password"

# Set proper permissions
chmod 600 "${DOCKER_SECRETS_DIR}"/*

echo -e "${GREEN}✓ Docker secrets created in ${DOCKER_SECRETS_DIR}${NC}"

# Security audit
echo -e "${YELLOW}Running security audit...${NC}"

# Check secret permissions
kubectl get secrets -n "${NAMESPACE}" -o json | \
jq -r '.items[] | select(.metadata.labels."security-tier" == "high") | .metadata.name' | \
while read secret; do
    echo -e "${GREEN}✓ High-security secret: ${secret}${NC}"
done

# Verify TLS configuration
if kubectl get secret tls-secret -n "${NAMESPACE}" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ TLS secret configured${NC}"
else
    echo -e "${RED}⚠ TLS secret not found - HTTPS will not work${NC}"
fi

echo -e "${GREEN}Secret setup completed successfully!${NC}"
echo -e "${YELLOW}Important security notes:${NC}"
echo "1. Rotate secrets regularly (at least every 90 days)"
echo "2. Monitor secret access with audit logs"
echo "3. Use proper certificate authority for production TLS"
echo "4. Ensure secrets are encrypted at rest in etcd"
echo "5. Implement secret scanning in CI/CD pipeline"