# 🏗️ Jenkins CI/CD Setup Guide for TaskFlow

## Quick Start (Docker)

```bash
# Start Jenkins + Docker-in-Docker
cd jenkins
docker compose -f docker-compose.jenkins.yml up -d

# Get initial admin password
docker exec taskflow-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Then open: **http://localhost:8080**

---

## Step-by-Step Jenkins Configuration

### 1. Install Required Plugins

Go to **Manage Jenkins → Plugins → Available plugins** and install:

| Plugin | Purpose |
|---|---|
| **Pipeline** | Declarative pipeline support |
| **Git / GitHub** | Source code checkout |
| **GitHub Branch Source** | Multibranch pipeline |
| **NodeJS** | Node.js tool installer |
| **Docker Pipeline** | Build & push Docker images |
| **Slack Notification** | Deploy notifications |
| **Warnings Next Gen** | ESLint/code quality reports |
| **Cobertura** | Code coverage reports |
| **AnsiColor** | Coloured console output |
| **SSH Agent** | SSH key injection for Ansible |
| **Ansible** | Run Ansible playbooks |
| **Credentials Binding** | Inject secrets into build |
| **Workspace Cleanup** | Clean workspace post-build |
| **Timestamper** | Add timestamps to console |
| **Build Timeout** | Kill stuck builds |
| **Email Extension** | Rich email notifications |

---

### 2. Configure NodeJS Tool

**Manage Jenkins → Tools → NodeJS → Add NodeJS**

| Field | Value |
|---|---|
| Name | `NodeJS-20` ← must match Jenkinsfile exactly |
| Version | `NodeJS 20.x` |
| Global packages | *(leave empty)* |

---

### 3. Add Credentials

Go to **Manage Jenkins → Credentials → System → Global → Add Credentials**

Add each one:

#### 🔑 GitHub Token
- Kind: `Secret text`
- ID: `github-token`
- Secret: *(paste your GitHub PAT with `repo` + `workflow` + `write:packages` scopes)*

#### 🔑 Production SSH Key
- Kind: `SSH Username with private key`
- ID: `prod-ssh-key`
- Username: `ubuntu`
- Private Key: *(paste your ~/.ssh/taskflow_key content)*

#### 🔑 Staging SSH Key
- Kind: `SSH Username with private key`
- ID: `staging-ssh-key`
- Username: `ubuntu`
- Private Key: *(paste staging server key)*

#### 🔑 Database Password
- Kind: `Secret text`
- ID: `db-password`
- Secret: `StrongP@ssw0rd!`

#### 🔑 Ansible Vault Password
- Kind: `Secret file`
- ID: `ansible-vault-password`
- File: *(upload your .vault_pass file)*

#### 🔑 Slack Webhook
- Kind: `Secret text`
- ID: `slack-webhook-url`
- Secret: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`

#### 🔑 Staging Inventory
- Kind: `Secret text`
- ID: `staging-inventory`
- Secret: *(paste contents of your staging hosts.ini)*

#### 🔑 Production Inventory
- Kind: `Secret text`
- ID: `prod-inventory`
- Secret: *(paste contents of your prod hosts.ini)*

---

### 4. Configure Slack Notifications

**Manage Jenkins → System → Slack**

| Field | Value |
|---|---|
| Workspace | your-slack-workspace |
| Credential | `slack-webhook-url` |
| Default channel | `#deployments` |

Click **Test Connection** to verify.

---

### 5. Create the Multibranch Pipeline Job

**Dashboard → New Item → Multibranch Pipeline**

| Field | Value |
|---|---|
| Name | `taskflow` |
| Branch Sources | GitHub |
| GitHub credentials | `github-token` |
| Repository URL | `https://github.com/ASHIRVADBM/taskflow` |
| Script Path | `Jenkinsfile` |
| Scan triggers | Every 1 minute |

Click **Save** → Jenkins will auto-discover `main` and `develop` branches.

---

### 6. Configure GitHub Webhook (for instant builds)

In your GitHub repo:
**Settings → Webhooks → Add webhook**

| Field | Value |
|---|---|
| Payload URL | `http://YOUR_JENKINS_IP:8080/github-webhook/` |
| Content type | `application/json` |
| Events | `Push`, `Pull requests` |

---

## Pipeline Flow

```
Git Push
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  Stage 1: Checkout                                  │
│  git clone + git log                                │
└──────────────────────┬──────────────────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Stage 2: Install Dependencies      │
    │  npm ci (backend + frontend)        │  ← PARALLEL
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Stage 3: Lint                      │
    │  ESLint backend + frontend          │  ← PARALLEL
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Stage 4: Test                      │
    │  Jest + PostgreSQL container        │  ← PARALLEL
    │  Vite production build              │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Stage 5: Security Scan             │
    │  npm audit + Trivy filesystem       │  ← PARALLEL
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Stage 6: Docker Build & Push       │
    │  backend:sha + frontend:sha → GHCR  │
    └──────────────────┬──────────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
    ┌──────▼──────┐         ┌──────▼──────┐
    │  develop    │         │  main       │
    │  branch     │         │  branch     │
    │             │         │             │
    │  Stage 7:   │         │  Stage 8:   │
    │  Deploy     │         │  Manual     │
    │  Staging    │         │  Approval   │
    │  (auto)     │         │  → Prod     │
    └─────────────┘         └─────────────┘
```

---

## Environment Variables Reference

| Variable | Set In | Description |
|---|---|---|
| `IMAGE_TAG` | Jenkinsfile auto | `jenkins-{BUILD_NUMBER}-{GIT_SHA}` |
| `GITHUB_TOKEN` | Jenkins Credentials | GitHub PAT for GHCR login |
| `DB_PASSWORD` | Jenkins Credentials | PostgreSQL password |
| `SLACK_WEBHOOK` | Jenkins Credentials | Slack notification URL |
| `PROD_SSH_KEY` | Jenkins Credentials | Production server SSH key |
| `STAGING_SSH_KEY` | Jenkins Credentials | Staging server SSH key |

---

## Useful Jenkins CLI Commands

```bash
# Trigger a build manually
curl -X POST http://localhost:8080/job/taskflow/job/main/build \
  --user admin:YOUR_API_TOKEN

# Get build status
curl http://localhost:8080/job/taskflow/job/main/lastBuild/api/json \
  --user admin:YOUR_API_TOKEN | python3 -m json.tool

# Restart Jenkins safely
curl -X POST http://localhost:8080/safeRestart \
  --user admin:YOUR_API_TOKEN
```
