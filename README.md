# Rule Studio DevTestOps

> Multi-tenant GitHub automation API for bootstrapping, populating, and deploying Tazama transaction monitoring rules.

## Overview

Rule Studio DevTestOps is a Fastify/TypeScript service that automates the full lifecycle of rule repositories in the [Tazama FRMS](https://github.com/tazama-lf) ecosystem. It works alongside [rule-studio-example](https://github.com/tazama-lf/rule-studio-example), which is the GitHub template all rule repositories are created from.

### Rule Lifecycle

```text
Bootstrap → Populate → [unit-test.yml] → Promote (dev) → [publish.yml] → [deploy.yml]
```

1. **Bootstrap** — Creates a new `rule-<id>` repository in the tenant's GitHub org, using `rule-studio-example` as the template.
2. **Populate** — Injects rule logic (`src/rule.ts`) and unit tests (`__tests__/unit/rule.test.ts`) into the repository.
3. **Unit Test** — `unit-test.yml` runs automatically on push to `main`, runs Jest, and commits the HTML coverage report back to the repo.
4. **Promote** — Promotes code to the `dev` branch, triggering `publish.yml`.
5. **Publish** — `publish.yml` publishes the rule as an npm package to GitHub Packages under the tenant organization.
6. **Deploy** — `deploy.yml` (or `deploy-to-uat.yml`) deploys the rule as a running Docker container.

---

## Table of Contents

- [Architecture](#architecture)
- [GitHub Token & Tenant Setup](#github-token--tenant-setup)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Workflows in rule-studio-example](#workflows-in-rule-studio-example)
- [Deployment](#deployment)
  - [Option 1: Self-Hosted Runner (No Public IP)](#option-1-self-hosted-runner-no-public-ip)
  - [Option 2: Cloud Deployment via SSH](#option-2-cloud-deployment-via-ssh)
- [Environment Variables Reference](#environment-variables-reference)
- [Local Development](#local-development)
- [License](#license)

---

## Architecture

```
┌──────────────────────────────────────┐
│     Rule Studio DevTestOps API       │
│   (this repo — Fastify service)      │
└───────────────────┬──────────────────┘
                    │ GitHub REST API
                    ▼
┌──────────────────────────────────────┐
│   Tenant GitHub Organization         │
│  ┌────────────────────────────────┐  │
│  │  rule-<id> repository          │  │
│  │  (from rule-studio-example)    │  │
│  │                                │  │
│  │  .github/workflows/            │  │
│  │  ├── unit-test.yml             │  │
│  │  ├── publish.yml               │  │
│  │  ├── deploy.yml                │  │
│  │  └── deploy-to-uat.yml         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

- The API authenticates requests via JWT containing a `tenantId`.
- Each tenant maps to a GitHub organization with its own encrypted token.
- **The `GH_TOKEN` set for a tenant determines which organization the rule repository is created in.**
- All repositories are bootstrapped from the `main` branch of `rule-studio-example`.

---

## GitHub Token & Tenant Setup

### How Tenants Work

Each tenant maps to a GitHub organization. The API resolves credentials from environment variables at runtime using the `tenantId` from the JWT:

```
GITHUB_TOKEN_<TENANT_ID>=<encrypted_github_token>
GITHUB_ORG_NAME_<TENANT_ID>=<organization_name>
```

**Example — tenant ID `ACME`:**

```env
GITHUB_TOKEN_ACME=<ENCRYPTED_GITHUB_TOKEN_HEX>   # AES-256-CBC encrypted
GITHUB_ORG_NAME_ACME=acme-corporation
```

When a request arrives with `tenantId: "ACME"` in the JWT, the API uses `GITHUB_TOKEN_ACME` to authenticate GitHub operations and creates repositories under the `acme-corporation` organization.

### Where Repositories Are Created

The rule repository is always created under the organization mapped to the JWT's `tenantId`. Set `GITHUB_ORG_NAME_<TENANT_ID>` to control the target org. The token must belong to an account with **Admin** access to that organization.

### GitHub Token Permissions

Use a classic Personal Access Token with the following scopes:

| Scope            | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| `repo`           | Create repositories, read/write contents, manage branches |
| `write:packages` | Publish npm packages to GitHub Packages                   |
| `workflow`       | Trigger and read GitHub Actions runs                      |

> For fine-grained tokens: enable **Contents** (read/write), **Administration** (read/write), **Actions** (read), and **Packages** (write).

### Encrypting a Token

Tokens are stored encrypted using AES-256-CBC. Encrypt a token before setting it in your environment:

```javascript
const crypto = require('crypto');

const key = 'your-32-byte-encryption-key-here'; // exactly 32 chars
const iv = 'your-16-byte-iv!'; // exactly 16 chars
const token = 'ghp_yourGitHubTokenHere';

const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), Buffer.from(iv));
let encrypted = cipher.update(token, 'utf8', 'hex');
encrypted += cipher.final('hex');

console.log(encrypted); // use this as GITHUB_TOKEN_<TENANT_ID>
```

### Repository Secrets Required in rule-studio-example

Every rule repository bootstrapped from `rule-studio-example` inherits the embedded GitHub Actions workflows. Those workflows require a `TAZAMA_TOKEN` secret to authenticate against GitHub Packages. Set this at the **organization level** so it is inherited by all rule repositories automatically.

| Secret         | Where to Set                    | Description                                          |
| -------------- | ------------------------------- | ---------------------------------------------------- |
| `TAZAMA_TOKEN` | GitHub Org → Settings → Secrets | PAT with `repo`, `write:packages`, `workflow` scopes |

The workflows use `TAZAMA_TOKEN` to:

- Install npm dependencies from GitHub Packages
- Publish the rule package to the tenant GitHub Packages registry
- Authenticate Docker builds that reference private packages

> If you operate multiple tenant organizations, set `TAZAMA_TOKEN` as an organization-level secret in each one.

---

## Getting Started

### Prerequisites

- Node.js v20+
- GitHub organization(s) with admin access
- GitHub PAT(s) for each tenant (see [token setup](#github-token--tenant-setup))
- AES-256-CBC encryption key (32 bytes) and IV (16 bytes)

### Installation

```bash
git clone https://github.com/tazama-lf/rule-studio-devtestops
cd rule-studio-devtestops
npm install
```

### Environment Configuration

Create a `.env` file in the project root:

```env
# Server
PORT=3050
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info

# GitHub — template repository to bootstrap from
GITHUB_API_URL=https://api.github.com
GITHUB_TEMPLATE_OWNER=tazama-lf
GITHUB_TEMPLATE_REPO=rule-studio-example
GITHUB_DEFAULT_BRANCH=main
GITHUB_TEST_REPORT_PATH=coverage/lcov-report/index.html

# Encryption (must be exactly 32 bytes for key, 16 bytes for IV)
ENCRYPTION_KEY=your-32-byte-encryption-key-here
ENCRYPTION_IV=your-16-byte-iv-here

# Tenant credentials — add one block per tenant organization
GITHUB_TOKEN_ACME=<encrypted_token>
GITHUB_ORG_NAME_ACME=acme-corporation

GITHUB_TOKEN_BETA=<encrypted_token>
GITHUB_ORG_NAME_BETA=beta-org
```

### Running

```bash
# Development (hot reload)
npm run dev

# Production
npm run build && npm start

# Docker
docker compose up -d
```

The API is available at `http://localhost:3050/api`.

---

## API Endpoints

All endpoints except `/health` require a JWT bearer token:

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### JWT Structure

```json
{
  "tenantId": "ACME",
  "claims": ["editor"],
  "iat": 1704067200,
  "exp": 1704153600
}
```

Both `tenantId` and the `editor` claim are required.

---

### `GET /health`

Service liveness check. No authentication required.

**Response:**

```json
{ "status": "UP" }
```

---

### `POST /v1/bootstrap`

Creates a new rule repository from the `rule-studio-example` template in the tenant's GitHub organization.

**Body:**

```json
{
  "ruleId": "001",
  "ruleVersion": "1.0.0"
}
```

**What it does:**

1. Creates `rule-001` in the tenant org from the template
2. Waits for repository content to initialize (up to 15 retries)
3. Updates `package.json` — sets `name` to `@org/rule-001` and `version` to `1.0.0`
4. Returns the repository URL

**Response:**

```json
{
  "success": true,
  "repoUrl": "https://github.com/acme-corporation/rule-001",
  "message": "Created acme-corporation/rule-001 v1.0.0"
}
```

---

### `POST /v1/populate`

Injects rule logic and unit tests into an existing rule repository.

**Body:**

```json
{
  "ruleId": "001",
  "ruleCode": "<base64-encoded TypeScript>",
  "testCode": "<base64-encoded TypeScript>"
}
```

Encode files with `Buffer.from(sourceCode).toString('base64')` before sending.

Files written to the repository:

- `src/rule.ts` — rule implementation
- `__tests__/unit/rule.test.ts` — unit tests

**Response:**

```json
{
  "success": true,
  "message": "Populated acme-corporation/rule-001 on main"
}
```

---

### `POST /v1/promote`

Creates or synchronizes a branch. Used to trigger downstream workflows.

**Body:**

```json
{
  "ruleId": "001",
  "branchName": "dev"
}
```

| Branch | Effect                                                        |
| ------ | ------------------------------------------------------------- |
| `dev`  | Triggers `publish.yml` — publishes the rule npm package       |
| `prod` | Triggers `deploy-to-uat.yml` — deploys to the UAT environment |

**Response:**

```json
{
  "success": true,
  "message": "Branch dev is synchronized with <sha>"
}
```

---

### `GET /v1/unit-tests/status`

Returns the current status of the unit test GitHub Actions workflow.

**Query params:** `ruleId` (required), `branchName` (optional, defaults to `main`)

**Example:** `GET /v1/unit-tests/status?ruleId=001&branchName=main`

**Response:**

```json
{
  "success": true,
  "workflow": "Unit Tests",
  "branch": "main",
  "status": "completed",
  "github": {
    "runNumber": 42,
    "runUrl": "https://github.com/acme-corporation/rule-001/actions/runs/123456789",
    "status": "completed",
    "conclusion": "success"
  },
  "reportAvailable": true
}
```

| `status`    | Meaning                               |
| ----------- | ------------------------------------- |
| `queued`    | Workflow is waiting to run            |
| `running`   | Workflow is currently executing       |
| `completed` | Tests passed, report is available     |
| `failed`    | Tests failed                          |
| `cancelled` | Workflow was cancelled                |
| `not_found` | No workflow run found for this branch |

---

### `GET /v1/report`

Returns the HTML coverage report from the latest completed workflow run.

**Query params:** `ruleId` (required), `branchName` (optional, defaults to `main`)

**Example:** `GET /v1/report?ruleId=001&branchName=main`

Returns `text/html` on success. Returns JSON with an appropriate status code if the report is not available (tests still running, failed, or not found).

---

## Workflows in rule-studio-example

Every rule repository bootstrapped from `rule-studio-example` inherits four GitHub Actions workflows. They are present from day one — no manual setup required beyond setting the `TAZAMA_TOKEN` secret.

### `unit-test.yml` — Unit Tests

**Trigger:** Push to `main` (ignores changes under `reports/`)

**What it does:**

1. Installs dependencies (authenticates to GitHub Packages using `TAZAMA_TOKEN`)
2. Runs the full Jest test suite with coverage
3. Commits the HTML coverage report back to `main` under `coverage/` and `reports/`

This is the workflow monitored by `/v1/unit-tests/status` and `/v1/report`.

---

### `publish.yml` — Build and Publish Package

**Trigger:** Push to `dev` branch (also supports `workflow_dispatch`)

**What it does:**

1. Verifies `src/rule.ts` exists
2. Authenticates npm to GitHub Packages using `TAZAMA_TOKEN`
3. Publishes the rule as `@<org>/rule-<id>@<version>` to the tenant's GitHub Packages registry

This runs automatically when you call `POST /v1/promote` with `branchName: "dev"`.

---

### `deploy.yml` — Deploy Rule

**Trigger:** After `publish.yml` completes successfully, or `workflow_dispatch`

Deploys the rule as a Docker container. See [Deployment](#deployment) for full details.

---

### `deploy-to-uat.yml` — Deploy to UAT on `prod` Push

**Trigger:** Push to `prod` branch

Same deployment steps as `deploy.yml`, triggered by promoting to `prod` rather than waiting for the publish workflow to complete.

---

## Deployment

After a rule is published to GitHub Packages, deployment wraps it inside the [rule-executer](https://github.com/tazama-lf/rule-executer) runtime and runs it as a Docker container.

**How it works:**

1. Clones the `rule-executer` repository
2. Patches its `package.json` and `Dockerfile` to reference `@<org>/rule-<id>@latest`
3. Builds a Docker image with the rule baked in
4. Stops any existing container for this rule and starts the new one

There are two options for where this build and run happens:

---

### Option 1: Self-Hosted Runner (No Public IP)

**Use this when your deployment environment is on a private network with no inbound public IP.**

A GitHub Actions self-hosted runner is installed directly on the target server. The workflow builds and runs Docker containers locally on that machine — no SSH or public IP needed.

**Setup:**

1. Install a self-hosted runner on your target server following the [GitHub guide](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners).

2. Register the runner with the label `tazama-uat`. The deploy workflows target this label:

   ```yaml
   runs-on:
     - tazama-uat
   ```

   If you use a different label, update `runs-on` in `deploy.yml` and `deploy-to-uat.yml` accordingly.

3. Set `TAZAMA_TOKEN` as an organization-level secret (or per-repository secret) so the workflow can authenticate to GitHub Packages.

4. Deployment runs automatically after `publish.yml` succeeds (or manually via `workflow_dispatch`).

**Required secrets:**

| Secret         | Description                                                 |
| -------------- | ----------------------------------------------------------- |
| `TAZAMA_TOKEN` | GitHub PAT with `repo`, `write:packages`, `workflow` scopes |

**Container environment variables set by the workflow** — configure these directly in `deploy.yml` or reference them from org/repo secrets:

| Variable                                                        | Description                                  |
| --------------------------------------------------------------- | -------------------------------------------- |
| `RULE_NAME`                                                     | Rule ID (e.g., `001`)                        |
| `RULE_VERSION`                                                  | Resolved from the published npm package      |
| `RAW_HISTORY_DATABASE_HOST/PORT/USER/PASSWORD`                  | PostgreSQL — raw history                     |
| `CONFIGURATION_DATABASE_HOST/PORT/USER/PASSWORD`                | PostgreSQL — configuration                   |
| `EVENT_HISTORY_DATABASE_HOST/PORT/USER/PASSWORD`                | PostgreSQL — event history                   |
| `STARTUP_TYPE`                                                  | `nats`                                       |
| `SERVER_URL`                                                    | NATS server address (e.g., `10.0.0.1:14222`) |
| `PRODUCER_STREAM` / `CONSUMER_STREAM` / `STREAM_SUBJECT`        | NATS stream config                           |
| `ACK_POLICY` / `PRODUCER_STORAGE` / `PRODUCER_RETENTION_POLICY` | NATS stream settings                         |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`                  | Redis connection                             |

Update the hardcoded values in `deploy.yml` before use, or replace them with `${{ secrets.* }}` references.

---

### Option 2: Cloud Deployment via SSH

**Use this when your deployment target is a cloud VM with a publicly accessible IP (or reachable via bastion).**

Replace the self-hosted runner approach with an SSH step executed from GitHub's managed runners.

**Required secrets:**

| Secret         | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `TAZAMA_TOKEN` | GitHub PAT with `repo`, `write:packages`, `workflow` scopes             |
| `DEPLOY_HOST`  | Public IP or hostname of the cloud server                               |
| `DEPLOY_USER`  | SSH username                                                            |
| `DEPLOY_KEY`   | Private SSH key (public key must be in `authorized_keys` on the server) |

**Steps to adapt `deploy.yml` for cloud:**

1. Change `runs-on` from the self-hosted label to a managed runner:

   ```yaml
   runs-on: ubuntu-latest
   ```

2. Replace the local Docker build step with an SSH action:

   ```yaml
   - name: Deploy via SSH
     uses: appleboy/ssh-action@v1
     with:
       host: ${{ secrets.DEPLOY_HOST }}
       username: ${{ secrets.DEPLOY_USER }}
       key: ${{ secrets.DEPLOY_KEY }}
       script: |
         # Authenticate to GitHub Packages
         echo "${{ secrets.TAZAMA_TOKEN }}" | \
           docker login ghcr.io -u ${{ github.actor }} --password-stdin

         # Pull and start the updated rule container
         docker pull ghcr.io/${{ github.repository_owner }}/${{ env.RULE_NAME }}:latest

         docker stop ${{ env.RULE_NAME }} || true
         docker rm   ${{ env.RULE_NAME }} || true

         docker run -d --name ${{ env.RULE_NAME }} \
           -e RULE_NAME=${{ env.RULE_ID }} \
           -e SERVER_URL=${{ secrets.NATS_URL }} \
           -e REDIS_HOST=${{ secrets.REDIS_HOST }} \
           -e REDIS_PORT=${{ secrets.REDIS_PORT }} \
           -e REDIS_PASSWORD=${{ secrets.REDIS_PASSWORD }} \
           --restart unless-stopped \
           ghcr.io/${{ github.repository_owner }}/${{ env.RULE_NAME }}:latest
   ```

3. Add database and NATS environment variables as repository/org secrets and reference them in the `docker run` command.

---

## Environment Variables Reference

### API Service (`.env`)

| Variable                   | Required | Description                                                           |
| -------------------------- | -------- | --------------------------------------------------------------------- |
| `PORT`                     | Yes      | Server port (default: `3050`)                                         |
| `HOST`                     | No       | Bind address (default: `0.0.0.0`)                                     |
| `NODE_ENV`                 | No       | `development` \| `production` \| `test`                               |
| `LOG_LEVEL`                | No       | `debug` \| `info` \| `warn` \| `error`                                |
| `GITHUB_API_URL`           | Yes      | `https://api.github.com`                                              |
| `GITHUB_TEMPLATE_OWNER`    | Yes      | GitHub org/user that owns `rule-studio-example`                       |
| `GITHUB_TEMPLATE_REPO`     | Yes      | Template repo name (e.g., `rule-studio-example`)                      |
| `GITHUB_DEFAULT_BRANCH`    | Yes      | Default branch for new repos (e.g., `main`)                           |
| `GITHUB_TEST_REPORT_PATH`  | Yes      | Path to HTML report in repo (e.g., `coverage/lcov-report/index.html`) |
| `ENCRYPTION_KEY`           | Yes      | 32-byte AES-256-CBC encryption key                                    |
| `ENCRYPTION_IV`            | Yes      | 16-byte AES-256-CBC initialization vector                             |
| `GITHUB_TOKEN_<TENANT>`    | Yes      | Encrypted GitHub token for the tenant                                 |
| `GITHUB_ORG_NAME_<TENANT>` | Yes      | GitHub organization name for the tenant                               |

### GitHub Actions Secrets (per rule repo or org)

| Secret         | Used By           | Description                                                 |
| -------------- | ----------------- | ----------------------------------------------------------- |
| `TAZAMA_TOKEN` | All workflows     | GitHub PAT with `repo`, `write:packages`, `workflow` scopes |
| `DEPLOY_HOST`  | Cloud deploy only | SSH target hostname                                         |
| `DEPLOY_USER`  | Cloud deploy only | SSH username                                                |
| `DEPLOY_KEY`   | Cloud deploy only | SSH private key (PEM format)                                |

---

## Local Development

```bash
npm run dev           # Start with hot reload (nodemon)
npm test              # Run unit tests
npm run test:coverage # Tests with HTML coverage report
npm run lint          # Lint and format check
npm run build         # Compile TypeScript → dist/
npm start             # Run compiled build
```

Health check:

```bash
curl http://localhost:3050/api/health
```

---

## License

Apache-2.0 — see [LICENSE](LICENSE).
