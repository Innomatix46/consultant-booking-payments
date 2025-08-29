#!/bin/bash
# Backup and disaster recovery system for PCI-compliant payment system
# Implements automated backups with encryption and compliance logging

set -euo pipefail

# Configuration
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
NAMESPACE="payment-system"
BACKUP_STORAGE_PATH="${BACKUP_STORAGE_PATH:-./backups}"
S3_BUCKET="${S3_BUCKET:-payment-system-backups}"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-./backup-encryption.key}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging setup
LOG_DIR="${BACKUP_STORAGE_PATH}/logs"
LOG_FILE="${LOG_DIR}/backup-${BACKUP_DATE}.log"
AUDIT_LOG="${LOG_DIR}/audit.log"

mkdir -p "${LOG_DIR}"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date -Iseconds)
    
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
    
    # Audit log for compliance
    if [[ "${level}" == "AUDIT" ]]; then
        echo "[${timestamp}] ${message}" >> "${AUDIT_LOG}"
    fi
}

# Error handling
handle_error() {
    local exit_code=$?
    log "ERROR" "Backup process failed with exit code ${exit_code}"
    log "AUDIT" "BACKUP_FAILED: Process terminated unexpectedly"
    exit ${exit_code}
}

trap handle_error ERR

log "INFO" "Starting backup process for payment system"
log "AUDIT" "BACKUP_STARTED: User=$(whoami), Date=${BACKUP_DATE}"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

# Check required tools
for tool in kubectl gpg tar gzip; do
    if ! command -v "$tool" >/dev/null 2>&1; then
        log "ERROR" "Required tool '$tool' not found"
        exit 1
    fi
done

# Check Kubernetes connectivity
if ! kubectl cluster-info >/dev/null 2>&1; then
    log "ERROR" "Cannot connect to Kubernetes cluster"
    exit 1
fi

# Check namespace exists
if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
    log "ERROR" "Namespace ${NAMESPACE} not found"
    exit 1
fi

# Generate encryption key if it doesn't exist
if [[ ! -f "${ENCRYPTION_KEY_FILE}" ]]; then
    log "INFO" "Generating new encryption key"
    openssl rand -base64 32 > "${ENCRYPTION_KEY_FILE}"
    chmod 600 "${ENCRYPTION_KEY_FILE}"
    log "AUDIT" "ENCRYPTION_KEY_GENERATED: New backup encryption key created"
fi

# Create backup directory structure
BACKUP_DIR="${BACKUP_STORAGE_PATH}/${BACKUP_DATE}"
mkdir -p "${BACKUP_DIR}"/{kubernetes,database,application,logs}

log "INFO" "Backup directory: ${BACKUP_DIR}"

# Function to encrypt and backup file
encrypt_backup() {
    local source_file=$1
    local dest_file=$2
    
    log "INFO" "Encrypting and backing up: ${source_file}"
    
    # Compress and encrypt
    tar czf - "${source_file}" | \
    gpg --symmetric --cipher-algo AES256 --compress-algo 2 \
        --passphrase-file "${ENCRYPTION_KEY_FILE}" --batch --quiet \
        --output "${dest_file}.tar.gz.gpg"
    
    # Verify backup integrity
    if gpg --decrypt --passphrase-file "${ENCRYPTION_KEY_FILE}" \
           --batch --quiet "${dest_file}.tar.gz.gpg" | \
       tar tzf - >/dev/null 2>&1; then
        log "INFO" "Backup verification successful: ${dest_file}"
        return 0
    else
        log "ERROR" "Backup verification failed: ${dest_file}"
        return 1
    fi
}

# Kubernetes Configuration Backup
echo -e "${BLUE}Backing up Kubernetes configurations...${NC}"

K8S_BACKUP_DIR="${BACKUP_DIR}/kubernetes"

# Backup deployments
log "INFO" "Backing up deployments"
kubectl get deployments -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/deployments.yaml"

# Backup services
log "INFO" "Backing up services"
kubectl get services -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/services.yaml"

# Backup ingress
log "INFO" "Backing up ingress configurations"
kubectl get ingress -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/ingress.yaml"

# Backup configmaps
log "INFO" "Backing up configmaps"
kubectl get configmaps -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/configmaps.yaml"

# Backup persistent volume claims
log "INFO" "Backing up PVCs"
kubectl get pvc -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/pvcs.yaml"

# Backup network policies
log "INFO" "Backing up network policies"
kubectl get networkpolicy -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/network-policies.yaml"

# Backup RBAC configurations
log "INFO" "Backing up RBAC configurations"
kubectl get rolebinding -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/rolebindings.yaml"
kubectl get serviceaccount -n "${NAMESPACE}" -o yaml > "${K8S_BACKUP_DIR}/serviceaccounts.yaml"

# Note: Secrets are NOT backed up for security reasons
log "INFO" "Secrets are excluded from backup for security compliance"
log "AUDIT" "SECRETS_EXCLUDED: Sensitive data not included in backup per PCI-DSS requirements"

# Encrypt Kubernetes backup
encrypt_backup "${K8S_BACKUP_DIR}" "${BACKUP_DIR}/kubernetes-config"

# Database Backup (if accessible)
echo -e "${BLUE}Backing up database...${NC}"

DB_BACKUP_DIR="${BACKUP_DIR}/database"

# Get database connection details from secrets (if available)
if kubectl get secret db-url -n "${NAMESPACE}" >/dev/null 2>&1; then
    log "INFO" "Database backup initiated"
    
    # Create database dump script
    cat > "${DB_BACKUP_DIR}/backup-db.sh" << 'EOF'
#!/bin/bash
# This script should be run inside a pod with database access
# Usage: kubectl exec -it <pod> -- /tmp/backup-db.sh

set -euo pipefail

# Get database URL from secret
DATABASE_URL=$(cat /run/secrets/db-url || echo "${DATABASE_URL}")

if [[ -n "${DATABASE_URL}" ]]; then
    # PostgreSQL backup
    if [[ "${DATABASE_URL}" == *"postgresql"* ]]; then
        pg_dump "${DATABASE_URL}" --no-password --verbose > /tmp/database-backup.sql
    fi
    
    # Compress backup
    gzip /tmp/database-backup.sql
    
    echo "Database backup completed: /tmp/database-backup.sql.gz"
else
    echo "No database URL found"
    exit 1
fi
EOF
    
    chmod +x "${DB_BACKUP_DIR}/backup-db.sh"
    
    # Note: Actual database backup would require pod execution
    log "INFO" "Database backup script created (requires manual execution in pod)"
    log "AUDIT" "DATABASE_BACKUP_PREPARED: Backup script generated for manual execution"
else
    log "WARN" "Database credentials not accessible for backup"
fi

# Application Logs Backup
echo -e "${BLUE}Backing up application logs...${NC}"

LOGS_BACKUP_DIR="${BACKUP_DIR}/logs"

# Get recent logs from pods
for pod in $(kubectl get pods -n "${NAMESPACE}" -l app=payment-api -o jsonpath='{.items[*].metadata.name}'); do
    log "INFO" "Backing up logs from pod: ${pod}"
    
    # Get pod logs (last 1000 lines)
    kubectl logs "${pod}" -n "${NAMESPACE}" --tail=1000 > "${LOGS_BACKUP_DIR}/${pod}.log" || true
    
    # Get previous pod logs if available
    kubectl logs "${pod}" -n "${NAMESPACE}" --previous --tail=1000 > "${LOGS_BACKUP_DIR}/${pod}-previous.log" 2>/dev/null || true
done

# Backup monitoring logs if available
if kubectl get pods -n monitoring >/dev/null 2>&1; then
    log "INFO" "Backing up monitoring logs"
    kubectl logs -n monitoring -l app=prometheus --tail=500 > "${LOGS_BACKUP_DIR}/prometheus.log" || true
fi

# Encrypt logs backup
encrypt_backup "${LOGS_BACKUP_DIR}" "${BACKUP_DIR}/application-logs"

# Application State Backup
echo -e "${BLUE}Backing up application state...${NC}"

APP_BACKUP_DIR="${BACKUP_DIR}/application"

# Backup persistent volumes (metadata only)
kubectl get pv -o yaml > "${APP_BACKUP_DIR}/persistent-volumes.yaml"

# Backup resource quotas and limits
kubectl get resourcequota -n "${NAMESPACE}" -o yaml > "${APP_BACKUP_DIR}/resource-quotas.yaml" || true

# Create restore instructions
cat > "${APP_BACKUP_DIR}/RESTORE_INSTRUCTIONS.md" << EOF
# Restore Instructions for Payment System Backup

## Backup Details
- Date: ${BACKUP_DATE}
- Namespace: ${NAMESPACE}
- Backup Type: Full System Backup

## Prerequisites for Restore
1. Kubernetes cluster with same or newer version
2. Backup encryption key: ${ENCRYPTION_KEY_FILE}
3. Required storage classes and persistent volumes
4. Network policies and RBAC permissions

## Restore Steps

### 1. Decrypt Backup Files
\`\`\`bash
# Decrypt Kubernetes configurations
gpg --decrypt --passphrase-file "${ENCRYPTION_KEY_FILE}" \\
    kubernetes-config.tar.gz.gpg | tar xzf -

# Decrypt application logs
gpg --decrypt --passphrase-file "${ENCRYPTION_KEY_FILE}" \\
    application-logs.tar.gz.gpg | tar xzf -
\`\`\`

### 2. Restore Kubernetes Resources
\`\`\`bash
# Create namespace
kubectl create namespace ${NAMESPACE}

# Restore configurations (in order)
kubectl apply -f kubernetes/serviceaccounts.yaml
kubectl apply -f kubernetes/rolebindings.yaml
kubectl apply -f kubernetes/network-policies.yaml
kubectl apply -f kubernetes/configmaps.yaml
kubectl apply -f kubernetes/pvcs.yaml
kubectl apply -f kubernetes/deployments.yaml
kubectl apply -f kubernetes/services.yaml
kubectl apply -f kubernetes/ingress.yaml
\`\`\`

### 3. Restore Secrets (Manual)
Secrets must be recreated manually using the setup-secrets.sh script.

### 4. Restore Database
Execute the database backup script in a pod with database access.

### 5. Verification
- Check all pods are running
- Verify application endpoints
- Test payment processing functionality
- Validate security configurations

## Security Notes
- This backup contains encrypted sensitive configuration data
- Database credentials are not included (must be recreated)
- SSL certificates may need to be renewed
- Verify all security policies are applied correctly
EOF

# Create backup manifest
cat > "${BACKUP_DIR}/MANIFEST.json" << EOF
{
  "backup_date": "${BACKUP_DATE}",
  "namespace": "${NAMESPACE}",
  "backup_type": "full_system",
  "encrypted": true,
  "encryption_algorithm": "AES256",
  "components": [
    "kubernetes_configurations",
    "application_logs",
    "persistent_volume_metadata",
    "network_policies",
    "rbac_configurations"
  ],
  "excluded_components": [
    "secrets",
    "database_data",
    "ssl_certificates"
  ],
  "retention_days": ${RETENTION_DAYS},
  "compliance_standard": "PCI-DSS",
  "created_by": "$(whoami)",
  "backup_size_mb": "$(du -sm "${BACKUP_DIR}" | cut -f1)"
}
EOF

# Upload to remote storage (if configured)
if [[ -n "${S3_BUCKET:-}" ]] && command -v aws >/dev/null 2>&1; then
    echo -e "${BLUE}Uploading backup to S3...${NC}"
    
    log "INFO" "Uploading backup to S3 bucket: ${S3_BUCKET}"
    
    # Create tarball of entire backup
    tar czf "${BACKUP_DIR}.tar.gz" -C "${BACKUP_STORAGE_PATH}" "${BACKUP_DATE}"
    
    # Upload to S3 with encryption
    aws s3 cp "${BACKUP_DIR}.tar.gz" "s3://${S3_BUCKET}/backups/" \
        --server-side-encryption AES256 \
        --storage-class STANDARD_IA
    
    log "INFO" "Backup uploaded to S3 successfully"
    log "AUDIT" "BACKUP_UPLOADED: Backup stored in remote location"
    
    # Clean up local tarball
    rm -f "${BACKUP_DIR}.tar.gz"
fi

# Cleanup old backups
echo -e "${BLUE}Cleaning up old backups...${NC}"

log "INFO" "Removing backups older than ${RETENTION_DAYS} days"

find "${BACKUP_STORAGE_PATH}" -type d -name "20*_*" -mtime +${RETENTION_DAYS} | \
while read old_backup; do
    log "INFO" "Removing old backup: ${old_backup}"
    rm -rf "${old_backup}"
    log "AUDIT" "BACKUP_DELETED: Old backup removed per retention policy"
done

# Create backup summary
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
TOTAL_FILES=$(find "${BACKUP_DIR}" -type f | wc -l)

log "INFO" "Backup completed successfully"
log "INFO" "Backup size: ${BACKUP_SIZE}"
log "INFO" "Total files: ${TOTAL_FILES}"
log "AUDIT" "BACKUP_COMPLETED: Size=${BACKUP_SIZE}, Files=${TOTAL_FILES}, Location=${BACKUP_DIR}"

# Generate backup report
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}BACKUP COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Backup Date: ${BACKUP_DATE}"
echo "Backup Location: ${BACKUP_DIR}"
echo "Backup Size: ${BACKUP_SIZE}"
echo "Total Files: ${TOTAL_FILES}"
echo "Retention: ${RETENTION_DAYS} days"
echo "Encryption: AES256 (GPG)"
echo "Compliance: PCI-DSS"
echo ""
echo -e "${BLUE}Important Notes:${NC}"
echo "1. Backup is encrypted and requires the encryption key for restore"
echo "2. Secrets are not included - must be recreated during restore"
echo "3. Database backup requires manual execution in pod"
echo "4. Test restore procedures regularly"
echo "5. Verify backup integrity before relying on it"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Test backup restore in staging environment"
echo "2. Update disaster recovery documentation"
echo "3. Schedule next backup"
echo "4. Verify remote storage upload (if configured)"

# Return success
exit 0