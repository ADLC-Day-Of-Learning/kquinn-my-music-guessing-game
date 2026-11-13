# Repository Conventions and OpenShift Deployment Invariants

This document outlines environment invariants, security constraints, and manifest conventions for workloads deployed to OpenShift in this repository.

## 1. Target Platform & Security Constraints

All manifests deploy to an OpenShift cluster enforced by restricted SecurityContextConstraints (SCC):
- **Non-root execution:** Containers must run unprivileged as a non-root user (e.g., UID `1000710000` via `securityContext.runAsUser`).
- **Privilege escalation:** Containers must specify `allowPrivilegeEscalation: false` in their `securityContext`.
- **Drop capabilities:** Drop all Linux capabilities in container specifications:
  ```yaml
  securityContext:
    allowPrivilegeEscalation: false
    capabilities:
      drop:
        - ALL
  ```

## 2. Storage and Rollout Strategy Invariant

- Deployments mounting a PersistentVolumeClaim (PVC) with `accessModes: [ReadWriteOnce]` (e.g., `mongodb-pvc`) **must** explicitly set `spec.strategy: { type: Recreate }`.
- Kubernetes' default `RollingUpdate` strategy attempts to start replacement pods before terminating existing pods, causing multi-attach deadlocks on ReadWriteOnce storage.

## 3. Filesystem Writable Paths

- Under OpenShift restricted SCC, container root filesystems are read-only.
- Workloads that generate runtime files or perform startup template substitutions (e.g., Nginx frontend config in `deployment-files/html_deploy_fe.yaml`) must mount an `emptyDir` volume at `/tmp` or the designated writable path.

## 4. Resource Sizing

All workload containers must explicitly define CPU and memory `requests` and `limits` consistent with baseline sizing in `deployment-files/nodejs-deployment.yaml`:
- **Requests:** CPU `100m`, memory `256Mi` (or `128Mi` for frontend Nginx)
- **Limits:** CPU `500m`, memory `512Mi` (or `256Mi` for frontend Nginx)

Example:
```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

## 5. Local Validation

Before committing changes to Kubernetes manifests, validate manifest syntax and structure using Python and PyYAML:

```bash
python3 -c "import yaml, glob; [list(yaml.safe_load_all(open(f))) for f in glob.glob('deployment-files/*.yaml') + glob.glob('pv-files/*.yaml')]"
```
