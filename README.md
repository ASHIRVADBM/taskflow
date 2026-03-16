# ◈ TaskFlow — Multi-Tier Web Application

> A production-grade Task Management application demonstrating full-stack DevOps practices:
> multi-tier architecture, containerization, Kubernetes orchestration, Ansible automation, and CI/CD.

![CI/CD](https://github.com/YOUR_USERNAME/taskflow/actions/workflows/cicd.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS :443
                    ┌──────▼───────┐
                    │  Nginx/      │  Tier 1 — Presentation
                    │  Ingress     │  React SPA (port 80)
                    └──────┬───────┘
                           │ HTTP :5000
                    ┌──────▼───────┐
                    │  Node.js     │  Tier 2 — Application
                    │  Express API │  REST API (port 5000)
                    └──────┬───────┘
                           │ TCP :5432
                    ┌──────▼───────┐
                    │  PostgreSQL  │  Tier 3 — Data
                    │  Database    │  Persistent volume
                    └──────────────┘
```

## 📁 Repository Structure

```
taskflow/
├── backend/                  # Node.js + Express REST API
│   ├── src/index.js          # Main API server
│   ├── db/init.sql           # Database schema + seed data
│   ├── tests/api.test.js     # Jest integration tests
│   ├── Dockerfile            # Multi-stage production build
│   └── package.json
│
├── frontend/                 # React + Vite SPA
│   ├── src/App.jsx           # Main React component
│   ├── src/main.jsx          # Entry point
│   ├── nginx.conf            # Nginx SPA configuration
│   ├── Dockerfile            # Multi-stage React → Nginx build
│   └── package.json
│
├── k8s/                      # Kubernetes manifests
│   ├── 00-namespace-config.yaml   # Namespace, ConfigMap, Secrets
│   ├── 01-postgres.yaml           # StatefulSet + PVC
│   ├── 02-backend.yaml            # Deployment + HPA
│   └── 03-frontend-ingress.yaml   # Deployment + Ingress
│
├── ansible/                  # Infrastructure automation
│   ├── site.yml              # Master playbook
│   ├── deploy.yml            # Rolling deploy playbook
│   ├── ansible.cfg           # Ansible configuration
│   ├── inventory/hosts.ini   # Server inventory
│   ├── group_vars/all.yml    # Global variables
│   └── roles/
│       ├── common/           # Docker, firewall, SSH hardening
│       ├── app/              # Application deployment
│       ├── db/               # PostgreSQL configuration
│       └── nginx/            # Reverse proxy setup
│
├── .github/workflows/
│   ├── cicd.yml              # Main CI/CD pipeline
│   └── pr-validate.yml       # PR validation checks
│
├── docker-compose.yml        # Local development environment
├── .env.example              # Environment variable template
└── README.md
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose v2.x
- Node.js 20+ (for local dev without Docker)
- Git

### 1. Clone & Configure
```bash
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow
cp .env.example .env          # Edit with your values
```

### 2. Start All Services
```bash
docker compose up --build -d

# Check all containers are healthy
docker compose ps
docker compose logs -f
```

### 3. Access the Application
| Service  | URL                         |
|----------|-----------------------------|
| Frontend | http://localhost:80         |
| Backend  | http://localhost:5000       |
| API Docs | http://localhost:5000/health|
| Database | localhost:5432              |

---

## 🐳 Docker

### Build individual images
```bash
# Backend
docker build -t taskflow-backend:local ./backend

# Frontend
docker build -t taskflow-frontend:local \
  --build-arg VITE_API_URL=http://localhost:5000 \
  ./frontend
```

### Run with Docker Compose
```bash
docker compose up -d                  # Start all services
docker compose down                   # Stop all services
docker compose down -v                # Stop + remove volumes
docker compose logs backend -f        # Follow backend logs
```

---

## ☸️ Kubernetes Deployment

### Prerequisites
```bash
# Install kubectl, helm, cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml

# Install Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

### Deploy TaskFlow
```bash
# 1. Update YOUR_GITHUB_USERNAME in k8s files
sed -i 's/YOUR_GITHUB_USERNAME/your_actual_username/g' k8s/*.yaml

# 2. Update secrets (never commit real secrets!)
kubectl create secret generic taskflow-secrets \
  --from-literal=DB_USER=postgres \
  --from-literal=DB_PASSWORD=YourSecurePassword \
  -n taskflow --dry-run=client -o yaml | kubectl apply -f -

# 3. Apply all manifests in order
kubectl apply -f k8s/

# 4. Watch rollout
kubectl rollout status deployment/backend  -n taskflow
kubectl rollout status deployment/frontend -n taskflow

# 5. Get ingress address
kubectl get ingress -n taskflow
```

### Useful kubectl commands
```bash
kubectl get all -n taskflow                         # All resources
kubectl describe pod <pod-name> -n taskflow         # Pod details
kubectl logs -f deployment/backend -n taskflow      # Streaming logs
kubectl exec -it <pod> -n taskflow -- sh            # Shell into pod
kubectl scale deployment backend --replicas=4 -n taskflow  # Scale
```

---

## 🤖 Ansible Infrastructure

### Setup
```bash
cd ansible
pip install ansible

# Encrypt secrets with Vault
ansible-vault create group_vars/vault.yml
# Add: vault_db_password, vault_ghcr_token

# Test connectivity
ansible all -i inventory/hosts.ini -m ping
```

### Provision entire infrastructure
```bash
ansible-playbook -i inventory/hosts.ini site.yml --ask-vault-pass
```

### Rolling deploy only
```bash
ansible-playbook -i inventory/hosts.ini deploy.yml \
  --ask-vault-pass \
  -e "image_tag=sha-abc1234"
```

### Targeted execution
```bash
# Only run common setup
ansible-playbook site.yml --tags common

# Only deploy app
ansible-playbook site.yml --tags deploy

# Target single host
ansible-playbook site.yml --limit web01
```

---

## 🔄 CI/CD Pipeline

### Pipeline Stages

```
Push to branch
      │
      ▼
┌─────────────┐
│  1. Lint    │ ESLint + Gitleaks secret scan
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  2. Test (parallel)             │
│   ├── Backend: Jest + Postgres  │
│   └── Frontend: Vitest + Build  │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────┐
│ 3. Security │ Trivy CVE scan + npm audit
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  4. Build & Push                │
│   ├── Multi-arch Docker images  │
│   └── Push to GHCR with SHA tag │
└──────┬──────────────────────────┘
       │
       ├── develop branch → Deploy Staging (auto)
       │
       └── main branch   → Deploy Production (manual approval)
```

### Required GitHub Secrets

| Secret                   | Description                              |
|--------------------------|------------------------------------------|
| `PROD_SSH_KEY`           | SSH private key for production servers   |
| `STAGING_SSH_KEY`        | SSH private key for staging servers      |
| `ANSIBLE_VAULT_PASSWORD` | Password for ansible-vault encrypted vars|
| `PROD_INVENTORY`         | Production Ansible inventory file content|
| `STAGING_INVENTORY`      | Staging Ansible inventory file content   |
| `VITE_API_URL`           | Production API URL for frontend build    |
| `SLACK_WEBHOOK_URL`      | Slack webhook for deploy notifications   |
| `CODECOV_TOKEN`          | Codecov integration token                |

---

## 🔒 Security Features

- **Multi-stage Docker builds** — minimal attack surface, non-root user
- **GitHub Secrets** — no hardcoded credentials anywhere
- **Ansible Vault** — encrypted sensitive variables
- **Trivy scanning** — CVE scanning on filesystem and images
- **Gitleaks** — prevent secrets from being committed
- **UFW Firewall** — ports 22, 80, 443 only
- **SSH hardening** — key-only auth, no root login
- **K8s Secrets** — base64-encoded, use Sealed Secrets in production

---

## 📊 API Reference

| Method | Endpoint         | Description         |
|--------|------------------|---------------------|
| GET    | `/health`        | Service health check|
| GET    | `/api/tasks`     | Get all tasks       |
| GET    | `/api/tasks/:id` | Get single task     |
| POST   | `/api/tasks`     | Create task         |
| PUT    | `/api/tasks/:id` | Update task         |
| DELETE | `/api/tasks/:id` | Delete task         |

---

## 📄 License

MIT © YOUR_NAME
