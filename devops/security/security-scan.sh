#!/bin/bash
# Comprehensive security scanning script for PCI-compliant payment system
# This script performs multiple security checks and compliance validations

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE="payment-system"
SCAN_DATE=$(date -Iseconds)
REPORT_DIR="./security-reports"
REPORT_FILE="${REPORT_DIR}/security-scan-${SCAN_DATE}.json"

# Create report directory
mkdir -p "${REPORT_DIR}"

# Initialize report
cat > "${REPORT_FILE}" << EOF
{
  "scan_date": "${SCAN_DATE}",
  "namespace": "${NAMESPACE}",
  "compliance_standard": "PCI-DSS",
  "scan_results": {
EOF

echo -e "${GREEN}Starting comprehensive security scan for PCI compliance${NC}"
echo -e "${BLUE}Report will be saved to: ${REPORT_FILE}${NC}"

# Function to add result to report
add_result() {
    local category=$1
    local check=$2
    local status=$3
    local details=$4
    
    cat >> "${REPORT_FILE}" << EOF
    "${category}.${check}": {
      "status": "${status}",
      "details": "${details}",
      "timestamp": "$(date -Iseconds)"
    },
EOF
}

# Function to run security check
run_check() {
    local category=$1
    local check_name=$2
    local check_command=$3
    local success_pattern=${4:-""}
    
    echo -n "Checking ${category}: ${check_name}... "
    
    if output=$(eval "${check_command}" 2>&1); then
        if [[ -z "${success_pattern}" ]] || echo "${output}" | grep -q "${success_pattern}"; then
            echo -e "${GREEN}✓ PASS${NC}"
            add_result "${category}" "${check_name}" "PASS" "${output}"
            return 0
        else
            echo -e "${RED}✗ FAIL${NC}"
            add_result "${category}" "${check_name}" "FAIL" "${output}"
            return 1
        fi
    else
        echo -e "${RED}✗ ERROR${NC}"
        add_result "${category}" "${check_name}" "ERROR" "${output}"
        return 1
    fi
}

# Kubernetes Security Checks
echo -e "${BLUE}=== Kubernetes Security Checks ===${NC}"

run_check "k8s" "namespace_exists" \
    "kubectl get namespace ${NAMESPACE}" \
    "Active"

run_check "k8s" "pod_security_policy" \
    "kubectl get psp payment-psp" \
    "payment-psp"

run_check "k8s" "network_policy_exists" \
    "kubectl get networkpolicy -n ${NAMESPACE}" \
    "payment-api-network-policy"

run_check "k8s" "service_account_exists" \
    "kubectl get serviceaccount payment-service-account -n ${NAMESPACE}" \
    "payment-service-account"

run_check "k8s" "rbac_configured" \
    "kubectl get rolebinding -n ${NAMESPACE}" \
    "payment-role-binding"

run_check "k8s" "pods_non_root" \
    "kubectl get pods -n ${NAMESPACE} -o jsonpath='{.items[*].spec.securityContext.runAsNonRoot}'" \
    "true"

run_check "k8s" "containers_read_only" \
    "kubectl get pods -n ${NAMESPACE} -o jsonpath='{.items[*].spec.containers[*].securityContext.readOnlyRootFilesystem}'" \
    "true"

# Secret Security Checks
echo -e "${BLUE}=== Secret Security Checks ===${NC}"

run_check "secrets" "required_secrets_exist" \
    "kubectl get secrets -n ${NAMESPACE} --field-selector type=Opaque | wc -l" \
    ""

run_check "secrets" "tls_secret_exists" \
    "kubectl get secret tls-secret -n ${NAMESPACE}" \
    "tls-secret"

run_check "secrets" "secrets_encryption" \
    "kubectl get secrets -n ${NAMESPACE} -o yaml | grep -E 'data:|stringData:' | wc -l" \
    ""

# Check for hardcoded secrets in deployments
run_check "secrets" "no_hardcoded_secrets" \
    "kubectl get deployments -n ${NAMESPACE} -o yaml | grep -E 'value.*secret|value.*password|value.*key' || echo 'No hardcoded secrets found'" \
    "No hardcoded secrets found"

# TLS/SSL Configuration Checks
echo -e "${BLUE}=== TLS/SSL Configuration Checks ===${NC}"

run_check "tls" "ingress_tls_configured" \
    "kubectl get ingress -n ${NAMESPACE} -o yaml | grep -q 'tls:' && echo 'TLS configured' || echo 'TLS not configured'" \
    "TLS configured"

run_check "tls" "ssl_protocols" \
    "kubectl get ingress -n ${NAMESPACE} -o yaml | grep -q 'TLSv1.2\\|TLSv1.3' && echo 'Modern TLS protocols' || echo 'Insecure TLS protocols'" \
    "Modern TLS protocols"

# Network Security Checks
echo -e "${BLUE}=== Network Security Checks ===${NC}"

run_check "network" "ingress_rate_limiting" \
    "kubectl get ingress -n ${NAMESPACE} -o yaml | grep -q 'rate-limit' && echo 'Rate limiting configured' || echo 'No rate limiting'" \
    "Rate limiting configured"

run_check "network" "service_type_secure" \
    "kubectl get services -n ${NAMESPACE} -o jsonpath='{.items[*].spec.type}' | grep -q 'LoadBalancer\\|ClusterIP' && echo 'Secure service types' || echo 'Insecure service types'" \
    "Secure service types"

# Container Security Checks
echo -e "${BLUE}=== Container Security Checks ===${NC}"

run_check "container" "image_pull_policy" \
    "kubectl get deployments -n ${NAMESPACE} -o jsonpath='{.items[*].spec.template.spec.containers[*].imagePullPolicy}'" \
    "Always"

run_check "container" "resource_limits" \
    "kubectl get deployments -n ${NAMESPACE} -o yaml | grep -q 'limits:' && echo 'Resource limits set' || echo 'No resource limits'" \
    "Resource limits set"

run_check "container" "security_context" \
    "kubectl get deployments -n ${NAMESPACE} -o yaml | grep -q 'securityContext:' && echo 'Security context configured' || echo 'No security context'" \
    "Security context configured"

run_check "container" "capabilities_dropped" \
    "kubectl get deployments -n ${NAMESPACE} -o yaml | grep -q 'drop:.*ALL' && echo 'Capabilities dropped' || echo 'Capabilities not dropped'" \
    "Capabilities dropped"

# Application Security Checks
echo -e "${BLUE}=== Application Security Checks ===${NC}"

# Check for security headers (requires port forwarding or external access)
if command -v curl >/dev/null 2>&1; then
    # Port forward for testing
    kubectl port-forward -n "${NAMESPACE}" svc/payment-api-internal 8080:80 &
    PORT_FORWARD_PID=$!
    sleep 3
    
    run_check "app" "security_headers" \
        "curl -s -I http://localhost:8080/health | grep -E 'X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security' | wc -l" \
        ""
    
    run_check "app" "https_redirect" \
        "curl -s -I http://localhost:8080/health | grep -q 'HTTP/1.1 301\\|Location: https' && echo 'HTTPS redirect configured' || echo 'No HTTPS redirect'" \
        "HTTPS redirect configured"
    
    # Cleanup
    kill "${PORT_FORWARD_PID}" 2>/dev/null || true
fi

# Compliance Checks
echo -e "${BLUE}=== PCI-DSS Compliance Checks ===${NC}"

run_check "pci" "data_encryption_at_rest" \
    "kubectl get storageclass -o yaml | grep -q 'encrypted.*true' && echo 'Encryption at rest enabled' || echo 'Encryption at rest not configured'" \
    "Encryption at rest enabled"

run_check "pci" "audit_logging" \
    "kubectl get pods -n ${NAMESPACE} -o yaml | grep -q 'audit\\|log' && echo 'Audit logging configured' || echo 'No audit logging'" \
    "Audit logging configured"

run_check "pci" "access_controls" \
    "kubectl get rolebinding -n ${NAMESPACE} | wc -l" \
    ""

run_check "pci" "network_segmentation" \
    "kubectl get networkpolicy -n ${NAMESPACE} | wc -l" \
    ""

# Vulnerability Scanning (if tools are available)
echo -e "${BLUE}=== Vulnerability Scanning ===${NC}"

if command -v trivy >/dev/null 2>&1; then
    IMAGE=$(kubectl get deployment payment-api -n "${NAMESPACE}" -o jsonpath='{.spec.template.spec.containers[0].image}')
    run_check "vuln" "container_vulnerabilities" \
        "trivy image --severity HIGH,CRITICAL --quiet ${IMAGE} | wc -l" \
        ""
else
    add_result "vuln" "container_vulnerabilities" "SKIP" "Trivy not available"
fi

# Configuration Security Checks
echo -e "${BLUE}=== Configuration Security Checks ===${NC}"

run_check "config" "environment_separation" \
    "kubectl get configmap -n ${NAMESPACE} | grep -E 'prod|staging|dev' | wc -l" \
    ""

run_check "config" "secrets_not_in_configmap" \
    "kubectl get configmap -n ${NAMESPACE} -o yaml | grep -iE 'password|secret|key|token' || echo 'No secrets in configmaps'" \
    "No secrets in configmaps"

# Finalize report
cat >> "${REPORT_FILE}" << 'EOF'
    "scan_completed": {
      "status": "COMPLETED",
      "details": "Security scan completed successfully",
      "timestamp": "$(date -Iseconds)"
    }
  },
  "recommendations": [
    "Regularly rotate secrets and certificates",
    "Monitor security alerts and logs continuously",
    "Perform penetration testing quarterly",
    "Update container images regularly",
    "Review and audit access controls monthly",
    "Implement automated vulnerability scanning",
    "Backup and test disaster recovery procedures",
    "Train development team on secure coding practices"
  ],
  "compliance_status": "REQUIRES_REVIEW"
}
EOF

# Generate summary
echo -e "${BLUE}=== Security Scan Summary ===${NC}"

TOTAL_CHECKS=$(grep -c '"status":' "${REPORT_FILE}" || echo 0)
PASSED_CHECKS=$(grep -c '"status": "PASS"' "${REPORT_FILE}" || echo 0)
FAILED_CHECKS=$(grep -c '"status": "FAIL"' "${REPORT_FILE}" || echo 0)
ERROR_CHECKS=$(grep -c '"status": "ERROR"' "${REPORT_FILE}" || echo 0)
SKIPPED_CHECKS=$(grep -c '"status": "SKIP"' "${REPORT_FILE}" || echo 0)

echo "Total Checks: ${TOTAL_CHECKS}"
echo -e "Passed: ${GREEN}${PASSED_CHECKS}${NC}"
echo -e "Failed: ${RED}${FAILED_CHECKS}${NC}"
echo -e "Errors: ${YELLOW}${ERROR_CHECKS}${NC}"
echo -e "Skipped: ${BLUE}${SKIPPED_CHECKS}${NC}"

# Calculate compliance score
COMPLIANCE_SCORE=$(( (PASSED_CHECKS * 100) / (TOTAL_CHECKS - SKIPPED_CHECKS) ))
echo -e "Compliance Score: ${COMPLIANCE_SCORE}%"

# Security recommendations based on results
echo -e "\n${BLUE}=== Security Recommendations ===${NC}"

if [[ ${FAILED_CHECKS} -gt 0 ]]; then
    echo -e "${RED}HIGH PRIORITY:${NC}"
    echo "- Address failed security checks immediately"
    echo "- Review PCI-DSS compliance requirements"
    echo "- Implement missing security controls"
fi

if [[ ${COMPLIANCE_SCORE} -lt 90 ]]; then
    echo -e "${YELLOW}MEDIUM PRIORITY:${NC}"
    echo "- Improve security posture to achieve >90% compliance"
    echo "- Implement additional security measures"
    echo "- Schedule security training for team"
fi

echo -e "${GREEN}ONGOING:${NC}"
echo "- Monitor security metrics continuously"
echo "- Rotate secrets regularly"
echo "- Keep systems updated"
echo "- Perform regular security audits"

# Exit with appropriate code
if [[ ${FAILED_CHECKS} -gt 0 ]]; then
    echo -e "\n${RED}Security scan completed with failures. Review required.${NC}"
    exit 1
elif [[ ${COMPLIANCE_SCORE} -lt 80 ]]; then
    echo -e "\n${YELLOW}Security scan completed with warnings. Improvements needed.${NC}"
    exit 2
else
    echo -e "\n${GREEN}Security scan completed successfully.${NC}"
    exit 0
fi