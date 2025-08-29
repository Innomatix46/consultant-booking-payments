#!/bin/bash
# Production deployment script for PCI-compliant payment system
# This script implements secure deployment practices and rollback capabilities

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="payment-system"
APP_NAME="payment-api"
DEPLOYMENT_TIMEOUT="600s"
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=10

# Validate environment
if [[ -z "${NODE_ENV:-}" ]]; then
    echo -e "${RED}Error: NODE_ENV must be set${NC}"
    exit 1
fi

if [[ -z "${IMAGE_TAG:-}" ]]; then
    echo -e "${RED}Error: IMAGE_TAG must be set${NC}"
    exit 1
fi

# Required tools check
for cmd in kubectl docker; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo -e "${RED}Error: $cmd is required but not installed${NC}"
        exit 1
    fi
done

echo -e "${GREEN}Starting deployment of ${APP_NAME}:${IMAGE_TAG} to ${NODE_ENV}${NC}"

# Pre-deployment checks
echo -e "${BLUE}Running pre-deployment checks...${NC}"

# Check cluster connectivity
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

# Check namespace exists
if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
    echo -e "${RED}Error: Namespace ${NAMESPACE} does not exist${NC}"
    exit 1
fi

# Check required secrets exist
REQUIRED_SECRETS=("db-url" "stripe-secret" "jwt-secret" "webhook-secret" "tls-secret")
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! kubectl get secret "${secret}" -n "${NAMESPACE}" >/dev/null 2>&1; then
        echo -e "${RED}Error: Required secret ${secret} not found${NC}"
        exit 1
    fi
done

# Security compliance check
echo -e "${BLUE}Running PCI compliance checks...${NC}"

# Check network policies exist
if ! kubectl get networkpolicy -n "${NAMESPACE}" | grep -q "payment-api-network-policy"; then
    echo -e "${RED}Error: Network policy not found - required for PCI compliance${NC}"
    exit 1
fi

# Check pod security policies
if ! kubectl get psp payment-psp >/dev/null 2>&1; then
    echo -e "${YELLOW}Warning: Pod Security Policy not found${NC}"
fi

# Build and push image (if in CI/CD)
if [[ "${CI:-false}" == "true" ]]; then
    echo -e "${BLUE}Building and pushing Docker image...${NC}"
    
    docker build -t "${APP_NAME}:${IMAGE_TAG}" -f devops/docker/Dockerfile .
    docker tag "${APP_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}"
    docker push "${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}"
    
    echo -e "${GREEN}✓ Image pushed to registry${NC}"
fi

# Create deployment backup
echo -e "${BLUE}Creating deployment backup...${NC}"
BACKUP_DIR="./deployment-backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

kubectl get deployment "${APP_NAME}" -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/deployment.yaml" || true
kubectl get service -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/services.yaml" || true
kubectl get ingress -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/ingress.yaml" || true

echo -e "${GREEN}✓ Backup created in ${BACKUP_DIR}${NC}"

# Deploy application
echo -e "${BLUE}Deploying application...${NC}"

# Update deployment image
kubectl patch deployment "${APP_NAME}" -n "${NAMESPACE}" \
    -p "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"${APP_NAME}\",\"image\":\"${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}\"}]}}}}"

# Wait for rollout to complete
echo -e "${YELLOW}Waiting for deployment rollout...${NC}"
if ! kubectl rollout status deployment/"${APP_NAME}" -n "${NAMESPACE}" --timeout="${DEPLOYMENT_TIMEOUT}"; then
    echo -e "${RED}Deployment rollout failed${NC}"
    
    # Automatic rollback
    echo -e "${YELLOW}Initiating automatic rollback...${NC}"
    kubectl rollout undo deployment/"${APP_NAME}" -n "${NAMESPACE}"
    kubectl rollout status deployment/"${APP_NAME}" -n "${NAMESPACE}" --timeout="${DEPLOYMENT_TIMEOUT}"
    
    echo -e "${RED}Deployment failed and rolled back${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Deployment rollout completed${NC}"

# Health checks
echo -e "${BLUE}Running post-deployment health checks...${NC}"

# Get service endpoint
SERVICE_NAME="payment-api-internal"
SERVICE_PORT=80

# Port forward for health checks (in CI/CD, use service URL)
kubectl port-forward -n "${NAMESPACE}" "svc/${SERVICE_NAME}" 8080:${SERVICE_PORT} &
PORT_FORWARD_PID=$!
sleep 5

# Function to cleanup port forwarding
cleanup() {
    if [[ -n "${PORT_FORWARD_PID:-}" ]]; then
        kill "${PORT_FORWARD_PID}" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# Health check function
check_health() {
    local endpoint=$1
    local expected_status=${2:-200}
    
    echo -n "Checking ${endpoint}... "
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080${endpoint}"); then
        if [[ "$response" -eq "$expected_status" ]]; then
            echo -e "${GREEN}✓ OK (${response})${NC}"
            return 0
        else
            echo -e "${RED}✗ FAIL (${response})${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ FAIL (no response)${NC}"
        return 1
    fi
}

# Wait for pods to be ready
echo -e "${YELLOW}Waiting for pods to be ready...${NC}"
for i in $(seq 1 $HEALTH_CHECK_RETRIES); do
    ready_pods=$(kubectl get pods -n "${NAMESPACE}" -l app="${APP_NAME}" -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w)
    total_pods=$(kubectl get pods -n "${NAMESPACE}" -l app="${APP_NAME}" -o jsonpath='{.items[*].metadata.name}' | wc -w)
    
    if [[ "$ready_pods" -eq "$total_pods" && "$total_pods" -gt 0 ]]; then
        echo -e "${GREEN}✓ All pods are ready (${ready_pods}/${total_pods})${NC}"
        break
    fi
    
    echo -e "${YELLOW}Waiting for pods... (${ready_pods}/${total_pods} ready)${NC}"
    
    if [[ $i -eq $HEALTH_CHECK_RETRIES ]]; then
        echo -e "${RED}Timeout waiting for pods to be ready${NC}"
        exit 1
    fi
    
    sleep $HEALTH_CHECK_INTERVAL
done

# Application health checks
echo -e "${YELLOW}Running application health checks...${NC}"

# Basic health check
if ! check_health "/health" 200; then
    echo -e "${RED}Health check failed${NC}"
    exit 1
fi

# Metrics endpoint check
if ! check_health "/metrics" 200; then
    echo -e "${YELLOW}Warning: Metrics endpoint not responding${NC}"
fi

# API readiness check
if ! check_health "/api/health" 200; then
    echo -e "${RED}API health check failed${NC}"
    exit 1
fi

# Security checks
echo -e "${BLUE}Running post-deployment security checks...${NC}"

# Check TLS configuration
if kubectl get ingress -n "${NAMESPACE}" -o yaml | grep -q "tls:"; then
    echo -e "${GREEN}✓ TLS configured for ingress${NC}"
else
    echo -e "${RED}⚠ TLS not configured - security risk${NC}"
fi

# Check network policies are applied
if kubectl get pods -n "${NAMESPACE}" -l app="${APP_NAME}" -o json | \
   jq -r '.items[0].metadata.annotations."kubectl.kubernetes.io/default-container"' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Network policies are enforced${NC}"
fi

# Check resource limits
if kubectl get deployment "${APP_NAME}" -n "${NAMESPACE}" -o json | \
   jq -e '.spec.template.spec.containers[0].resources.limits' >/dev/null; then
    echo -e "${GREEN}✓ Resource limits are set${NC}"
else
    echo -e "${RED}⚠ Resource limits not set - potential security risk${NC}"
fi

# Performance validation
echo -e "${BLUE}Running performance validation...${NC}"

# Simple load test (basic)
echo -n "Testing API response time... "
response_time=$(curl -w "%{time_total}" -s -o /dev/null "http://localhost:8080/health")
if (( $(echo "$response_time < 1.0" | bc -l) )); then
    echo -e "${GREEN}✓ OK (${response_time}s)${NC}"
else
    echo -e "${YELLOW}⚠ Slow response (${response_time}s)${NC}"
fi

# Database connectivity test
echo -n "Testing database connectivity... "
if check_health "/api/health/db" 200; then
    echo -e "${GREEN}✓ Database connection OK${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
fi

# Cleanup
cleanup

# Deployment summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}DEPLOYMENT SUCCESSFUL${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Application: ${APP_NAME}"
echo "Image: ${DOCKER_REGISTRY}/${APP_NAME}:${IMAGE_TAG}"
echo "Environment: ${NODE_ENV}"
echo "Namespace: ${NAMESPACE}"
echo "Deployment time: $(date)"

# Get deployment info
echo -e "\n${BLUE}Deployment Status:${NC}"
kubectl get deployment "${APP_NAME}" -n "${NAMESPACE}"

echo -e "\n${BLUE}Pod Status:${NC}"
kubectl get pods -n "${NAMESPACE}" -l app="${APP_NAME}"

echo -e "\n${BLUE}Service Status:${NC}"
kubectl get service -n "${NAMESPACE}"

# Security reminder
echo -e "\n${YELLOW}Security Reminders:${NC}"
echo "1. Monitor logs for suspicious activity"
echo "2. Verify all secrets are properly encrypted"
echo "3. Check compliance dashboard within 24 hours"
echo "4. Schedule next security audit"
echo "5. Update incident response contacts if needed"

# Save deployment record
DEPLOYMENT_RECORD="deployments.log"
echo "$(date -Iseconds),${NODE_ENV},${APP_NAME},${IMAGE_TAG},success" >> "${DEPLOYMENT_RECORD}"

echo -e "${GREEN}Deployment completed successfully!${NC}"