# Rule Studio DevTestOps API

A multi-tenant GitHub repository automation service built with Fastify and TypeScript that streamlines the creation, population, promotion, and monitoring of rule-based repositories. This service is designed for the Tazama Financial Risk Management System (FRMS) to automate the complete lifecycle management of transaction monitoring rules across multiple tenants.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Authentication](#authentication)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Docker Deployment](#docker-deployment)
- [Project Structure](#project-structure)
- [Security](#security)
- [License](#license)

## Overview

The Rule Studio DevTestOps API is a production-ready automation service that manages the complete lifecycle of rule repositories in GitHub with enterprise-grade multi-tenant support. It provides a secure RESTful API for:

**Repository Management**

- Bootstrap new rule repositories from templates
- Populate repositories with rule logic and test code
- Promote code across environments via branch management

**Testing and Monitoring**

- Monitor GitHub Actions workflow execution status
- Retrieve unit test reports and coverage data
- Track test results across branches and environments

**Multi-Tenant Architecture**

- Tenant-isolated GitHub credentials and organizations
- JWT-based authentication with tenant identification
- Encrypted token storage with AES-256-CBC encryption
- Per-tenant organization mapping

## Features

### Repository Lifecycle Management

**Bootstrapping**

- Create new repositories from predefined templates via GitHub API
- Automatic package.json name and version configuration
- Repository content synchronization with retry logic
- Supports both public and private repository creation

**Population**

- Base64-encoded code injection for rule logic and test files
- Automatic file SHA detection for update operations
- Commit message generation with contextual information
- Support for updating existing files or creating new ones

**Promotion**

- Branch creation and synchronization across environments
- Smart branch merging with conflict detection
- Support for dev, staging, and production workflows
- Automatic base branch detection and SHA resolution

### Testing and Quality Assurance

**Comprehensive Test Coverage** ✅

- 100% code coverage achieved across all metrics
  - Statements: 100%
  - Branches: 100%
  - Functions: 100%
  - Lines: 100%
- 84 comprehensive unit tests covering all service handlers and utilities
- Complete test suite for all success and error scenarios
- Automated testing with Jest and TypeScript support

**GitHub Actions Integration**

- Real-time unit test workflow status monitoring
- Test report retrieval from completed workflow runs
- Support for branch-specific test results
- HTML test report serving with proper content types

**Test Status Tracking**

- Workflow run status: queued, running, completed, failed, cancelled
- GitHub workflow metadata exposure (run number, URL, conclusion)
- Report availability indicators based on workflow state
- Per-branch test status queries

### Security and Authentication

**Multi-Tenant JWT Authentication**

- JWT payload validation with tenant identification
- Editor claim requirement for authorization
- Token middleware for all protected endpoints
- Unauthorized access prevention with proper HTTP status codes

**Encrypted Credential Management**

- AES-256-CBC encryption for GitHub tokens
- Environment-based tenant credential storage
- Per-tenant organization name mapping
- Secure token decryption on demand

**Request Security**

- Authorization header validation
- Bearer token format enforcement
- JWT structure verification
- Comprehensive error handling for authentication failures

## Architecture

### Technology Stack

**Core Framework**

- Node.js v20 (LTS)
- Fastify v5.6.2 (high-performance web framework)
- TypeScript v5.9.3 (type safety)

**Validation and Schema**

- TypeBox v0.34.47 (runtime type validation)
- Zod v3.24.0 (schema parsing)
- AJV v8.17.1 (JSON schema validator)

**Testing and Quality**

- Jest v29.7.0 (testing framework)
- ts-jest v29.1.1 (TypeScript support for Jest)
- 100% code coverage achieved across all metrics

**Tazama Libraries**

- @tazama-lf/auth-lib v3.0.0 (authentication utilities)
- @tazama-lf/frms-coe-lib v6.0.0-proto.0 (FRMS core library)

**Development Tools**

- ESLint v9 (code linting)
- Prettier v3.7.4 (code formatting)
- Nodemon v3.1.11 (development server)
- Husky v9 (Git hooks)

**Production Features**

- CORS support via @fastify/cors
- Security headers via @fastify/helmet
- Environment validation via @fastify/env
- Sensible defaults via @fastify/sensible
- Pino logger with pretty printing

### System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Client Applications                       │
│           (API Consumers, Postman, CI/CD Systems)            │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTPS/REST
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    Fastify Server (Port 3050)                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            CORS, Helmet, Sensible Middleware           │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          Authentication Middleware Layer               │  │
│  │  • JWT Token Validation                                │  │
│  │  • Tenant Identification                               │  │
│  │  • Encrypted Token Decryption                          │  │
│  │  • Organization Mapping                                │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                Router (API Routes)                     │  │
│  │  • /health                                             │  │
│  │  • /v1/bootstrap                                       │  │
│  │  • /v1/populate                                        │  │
│  │  • /v1/promote                                         │  │
│  │  • /v1/report                                          │  │
│  │  • /v1/unit-tests/status                              │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Schema Validation Layer                   │  │
│  │  • Request Body Validation (TypeBox)                   │  │
│  │  • Query Parameter Validation                          │  │
│  │  • Response Schema Validation                          │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           ▼                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           Controllers and Service Layer                │  │
│  │  • GitHub Logic Service                                │  │
│  │  • Repository Operations                               │  │
│  │  • Testing Operations                                  │  │
│  └────────────────────────┬───────────────────────────────┘  │
└────────────────────────────┼───────────────────────────────┘
                             ▼
                ┌────────────────────────┐
                │     GitHub REST API     │
                │  • Repository Management│
                │  • Content Operations   │
                │  • Branch Operations    │
                │  • Workflow Runs        │
                └────────────────────────┘
```

### Component Responsibilities

**Index (Entry Point)**

- Server initialization and startup
- Configuration validation
- Fastify instance creation
- Graceful error handling

**Router**

- API endpoint definitions
- Route-to-handler mapping
- Middleware attachment per route
- Schema binding to endpoints

**Middleware**

- Token validation and JWT decoding
- Tenant credential resolution
- Request header enrichment
- Authentication failure handling

**Controllers**

- HTTP request/response handling
- Basic health check operations

**Services**

- GitHub API integration
- Repository lifecycle operations
- Test monitoring and report retrieval
- Business logic implementation

**Utilities**

- Token encryption/decryption
- Schema validation helpers
- JWT payload parsing

## Authentication

### Multi-Tenant JWT Authentication

The Rule Studio DevTestOps API implements a sophisticated multi-tenant authentication system that ensures secure, isolated operations for each tenant organization.

### Authentication Flow

```
1. Client sends request with JWT token in Authorization header
   ↓
2. Token Middleware validates Bearer token format
   ↓
3. JWT payload is decoded and validated
   ↓
4. TenantId is extracted from JWT payload
   ↓
5. Encrypted GitHub token retrieved from environment
   ↓
6. Token is decrypted using AES-256-CBC
   ↓
7. Organization name is mapped to tenant
   ↓
8. Request headers are enriched with:
   - de_gh_token: Decrypted GitHub token
   - organization_name: Tenant's GitHub organization
   - tenantid: Tenant identifier
   ↓
9. Request proceeds to handler
```

### JWT Token Structure

Required JWT payload structure:

```json
{
  "tenantId": "tenant-identifier",
  "claims": ["editor"],
  "iat": 1704067200,
  "exp": 1704153600
}
```

**Required Fields:**

- `tenantId` (string): Unique identifier for the tenant
- `claims` (array): Must include "editor" claim for authorization

### Request Headers

All protected endpoints require:

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Tenant Configuration

Each tenant requires environment variables:

```bash
GITHUB_TOKEN_<TENANT_ID>=<encrypted_github_token>
GITHUB_ORG_NAME_<TENANT_ID>=<organization_name>
```

Example for tenant "ACME":

```bash
GITHUB_TOKEN_ACME=4f8e3b2a1c9d7e6f...
GITHUB_ORG_NAME_ACME=acme-corporation
```

### Encryption Configuration

Required encryption keys in `.env`:

```bash
ENCRYPTION_KEY=<32_byte_encryption_key>
ENCRYPTION_IV=<16_byte_initialization_vector>
```

**Security Requirements:**

- ENCRYPTION_KEY: Must be exactly 32 bytes (256 bits)
- ENCRYPTION_IV: Must be exactly 16 bytes (128 bits)
- Algorithm: AES-256-CBC

### Authorization Errors

**401 Unauthorized**

- Missing Authorization header
- Invalid Bearer token format
- Invalid JWT structure
- Missing tenantId in JWT payload

**403 Forbidden**

- Missing "editor" claim in JWT
- Insufficient permissions

**500 Internal Server Error**

- Tenant credentials not configured
- Decryption failure
- Token processing error

---

## Getting Started

### Prerequisites

- Node.js v20 or higher (LTS recommended)
- npm v9 or higher
- GitHub organization account with template repository
- GitHub Personal Access Token with appropriate permissions
- Understanding of JWT token structure for multi-tenant setup

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/tazama-lf/rule-studio-devtestops
cd rule-studio-devtestops
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development
HOST=0.0.0.0

# GitHub Configuration
GITHUB_API_URL=https://api.github.com
GITHUB_TEMPLATE_OWNER=your-github-org
GITHUB_DEFAULT_BRANCH=main
GITHUB_TEMPLATE_REPO=rule-template
GITHUB_TEST_REPORT_PATH=coverage/lcov-report/index.html

# Logging Configuration
LOG_LEVEL=info

# Encryption Configuration (32 bytes for key, 16 bytes for IV)
ENCRYPTION_KEY=your-32-byte-encryption-key-here
ENCRYPTION_IV=your-16-byte-iv-here

# Multi-Tenant GitHub Credentials
# Format: GITHUB_TOKEN_<TENANT_ID>=<encrypted_token>
# Format: GITHUB_ORG_NAME_<TENANT_ID>=<organization_name>
GITHUB_TOKEN_TENANT1=encrypted_token_value
GITHUB_ORG_NAME_TENANT1=tenant1-org-name

GITHUB_TOKEN_TENANT2=encrypted_token_value
GITHUB_ORG_NAME_TENANT2=tenant2-org-name
```

**Environment Variable Details:**

| Variable                | Type   | Required | Description                               |
| ----------------------- | ------ | -------- | ----------------------------------------- |
| PORT                    | number | Yes      | Server port (default: 3000)               |
| NODE_ENV                | string | No       | Environment (development/production/test) |
| GITHUB_API_URL          | string | Yes      | GitHub API base URL                       |
| GITHUB_TEMPLATE_OWNER   | string | Yes      | Template repository owner                 |
| GITHUB_DEFAULT_BRANCH   | string | Yes      | Default branch name (usually main)        |
| GITHUB_TEMPLATE_REPO    | string | Yes      | Template repository name                  |
| GITHUB_TEST_REPORT_PATH | string | Yes      | Path to HTML test report in repository    |
| ENCRYPTION_KEY          | string | Yes      | 32-byte AES encryption key                |
| ENCRYPTION_IV           | string | Yes      | 16-byte initialization vector             |
| GITHUB*TOKEN*\*         | string | Yes      | Encrypted GitHub token per tenant         |
| GITHUB*ORG_NAME*\*      | string | Yes      | Organization name per tenant              |

4. **Run development server**

```bash
npm run dev
```

Server starts at `http://localhost:3050`

5. **Verify installation**

```bash
curl http://localhost:3050/api/health
```

Expected response:

```json
{
  "status": "UP"
}
```

### Quick Start Guide

**Step 1: Obtain JWT Token**

Request a JWT token from your authentication service with:

- `tenantId`: Your tenant identifier
- `claims`: Must include "editor"

**Step 2: Bootstrap a Repository**

```bash
curl -X POST http://localhost:3050/api/v1/bootstrap \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "001",
    "ruleVersion": "1.0.0"
  }'
```

**Step 3: Populate with Code**

```bash
curl -X POST http://localhost:3050/api/v1/populate \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "001",
    "ruleCode": "<base64_encoded_rule_code>",
    "testCode": "<base64_encoded_test_code>"
  }'
```

**Step 4: Promote to Environment**

```bash
curl -X POST http://localhost:3050/api/v1/promote \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleId": "001",
    "branchName": "dev"
  }'
```

**Step 5: Check Test Status**

```bash
curl -X GET "http://localhost:3050/api/v1/unit-tests/status?ruleId=001&branchName=main" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

## API Endpoints

### Base URL

```
http://localhost:3050/api
```

All endpoints except `/health` require JWT authentication.

### 1. Health Check

Check service availability and status.

**Endpoint:** `GET /health`

**Authentication:** Not required

**Response:**

```json
{
  "status": "UP"
}
```

**Status Codes:**

- `200 OK`: Service is healthy

---

### 2. Bootstrap Rule Repository

Creates a new rule repository from a template with automatic configuration.

**Endpoint:** `POST /v1/bootstrap`

**Authentication:** Required (JWT with editor claim)

**Request Headers:**

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**

```json
{
  "ruleId": "string",
  "ruleVersion": "string"
}
```

**Parameters:**

| Field       | Type   | Required | Description                                         |
| ----------- | ------ | -------- | --------------------------------------------------- |
| ruleId      | string | Yes      | Unique identifier for the rule (e.g., "001", "042") |
| ruleVersion | string | Yes      | Semantic version (e.g., "1.0.0", "2.1.3")           |

**Success Response (200 OK):**

```json
{
  "success": true,
  "repoUrl": "https://github.com/organization/rule-001",
  "message": "Created organization/rule-001 v1.0.0"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "success": false,
  "message": "Error description"
}
```

**What Happens:**

1. Creates repository from template using GitHub API
2. Waits for repository content initialization (retry logic with 15 attempts)
3. Fetches package.json from new repository
4. Updates package.json with:
   - name: `@organization/rule-<ruleId>`
   - version: `<ruleVersion>`
5. Commits updated package.json to default branch
6. Returns repository URL

**Repository Naming:**

- Pattern: `rule-<ruleId>`
- Example: ruleId "001" creates "rule-001"

---

### 3. Populate Rule Repository

Injects or updates rule logic and test code in an existing repository.

**Endpoint:** `POST /v1/populate`

**Authentication:** Required (JWT with editor claim)

**Request Headers:**

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**

```json
{
  "ruleId": "string",
  "ruleCode": "string",
  "testCode": "string"
}
```

**Parameters:**

| Field    | Type   | Required | Description                                      |
| -------- | ------ | -------- | ------------------------------------------------ |
| ruleId   | string | Yes      | Rule identifier (must match existing repository) |
| ruleCode | string | Yes      | Base64-encoded TypeScript rule implementation    |
| testCode | string | Yes      | Base64-encoded TypeScript test file              |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Populated organization/rule-001 on main"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "success": false,
  "message": "Rule update failed: <details>"
}
```

**What Happens:**

1. Retrieves current SHA of `src/rule.ts` (if exists)
2. Updates `src/rule.ts` with decoded ruleCode
3. Retrieves current SHA of `__tests__/unit/rule.test.ts` (if exists)
4. Updates `__tests__/unit/rule.test.ts` with decoded testCode
5. Creates commits for both files
6. Returns success confirmation

**File Paths:**

- Rule logic: `src/rule.ts`
- Test code: `__tests__/unit/rule.test.ts`

**Code Encoding Example:**

```javascript
// Node.js
const ruleCode = Buffer.from(
  `
// SPDX-License-Identifier: Apache-2.0
export const evaluate = (data) => {
  return data.amount > 1000;
};
`
).toString('base64');

// Browser
const ruleCode = btoa(`
// SPDX-License-Identifier: Apache-2.0
export const evaluate = (data) => {
  return data.amount > 1000;
};
`);
```

---

### 4. Promote Rule Repository

Creates or synchronizes branches for environment promotion.

**Endpoint:** `POST /v1/promote`

**Authentication:** Required (JWT with editor claim)

**Request Headers:**

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**

```json
{
  "ruleId": "string",
  "branchName": "string"
}
```

**Parameters:**

| Field      | Type   | Required | Description                                               |
| ---------- | ------ | -------- | --------------------------------------------------------- |
| ruleId     | string | Yes      | Rule identifier                                           |
| branchName | string | Yes      | Target branch name (e.g., "dev", "staging", "production") |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Branch dev is synchronized with <base_sha>"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "success": false,
  "message": "Failed to create commit: <details>"
}
```

**What Happens:**

**If branch does NOT exist:**

1. Retrieves SHA of default branch
2. Creates new branch pointing to that SHA
3. Returns confirmation

**If branch EXISTS:**

1. Retrieves SHA of default branch
2. Fetches latest commit from default branch
3. Creates new commit on target branch with same tree
4. Updates branch reference to new commit
5. Effectively synchronizes branch with latest default branch state

**Use Cases:**

- Create dev branch from main
- Sync staging branch with latest main changes
- Create production branch for deployment
- Environment-specific branch management

---

### 5. Fetch Latest Test Report

Retrieves HTML test report from completed GitHub Actions workflow.

**Endpoint:** `GET /v1/report`

**Authentication:** Required (JWT with editor claim)

**Request Headers:**

```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**

| Parameter  | Type   | Required | Description                    |
| ---------- | ------ | -------- | ------------------------------ |
| ruleId     | string | Yes      | Rule identifier                |
| branchName | string | No       | Branch name (defaults to main) |

**Example Request:**

```
GET /v1/report?ruleId=001&branchName=dev
```

**Success Response (200 OK):**

Returns HTML content with `Content-Type: text/html`

**Error Responses:**

**202 Accepted** (Tests still running):

```json
{
  "success": false,
  "message": "Unit tests are still queued. Report is not available yet."
}
```

**404 Not Found** (No workflow run):

```json
{
  "success": false,
  "message": "No unit test workflow run found for this branch"
}
```

**404 Not Found** (Report file missing):

```json
{
  "success": false,
  "message": "The test report at path 'coverage/lcov-report/index.html' does not exist in organization/rule-001 on branch 'main'"
}
```

**422 Unprocessable Entity** (Tests failed):

```json
{
  "success": false,
  "message": "Unit tests failed. Report cannot be generated."
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "message": "Failed to fetch unit test workflow status",
  "details": "<error_details>"
}
```

**What Happens:**

1. Queries GitHub Actions for latest workflow run on specified branch
2. Checks workflow status and conclusion
3. If workflow completed successfully:
   - Retrieves branch SHA
   - Fetches test report file from configured path
   - Decodes base64 content
   - Serves HTML directly
4. If workflow not completed, returns appropriate status

**Workflow Requirements:**

- Workflow file: `.github/workflows/unit-test.yml`
- Must generate HTML report at configured path
- Report must be committed to repository

---

### 6. Get Unit Test Status

Retrieves current status of unit test GitHub Actions workflow.

**Endpoint:** `GET /v1/unit-tests/status`

**Authentication:** Required (JWT with editor claim)

**Request Headers:**

```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**

| Parameter  | Type   | Required | Description                    |
| ---------- | ------ | -------- | ------------------------------ |
| ruleId     | string | Yes      | Rule identifier                |
| branchName | string | No       | Branch name (defaults to main) |

**Example Request:**

```
GET /v1/unit-tests/status?ruleId=001&branchName=main
```

**Success Response (200 OK):**

```json
{
  "success": true,
  "workflow": "Unit Tests",
  "branch": "main",
  "status": "completed",
  "github": {
    "runNumber": 42,
    "runUrl": "https://github.com/organization/rule-001/actions/runs/123456789",
    "status": "completed",
    "conclusion": "success"
  },
  "reportAvailable": true
}
```

**Response Fields:**

| Field             | Type         | Description                                                                  |
| ----------------- | ------------ | ---------------------------------------------------------------------------- |
| success           | boolean      | Operation success indicator                                                  |
| workflow          | string       | Workflow name ("Unit Tests")                                                 |
| branch            | string       | Branch name queried                                                          |
| status            | string       | Normalized status (queued, running, completed, failed, cancelled, not_found) |
| github.runNumber  | number       | GitHub Actions run number                                                    |
| github.runUrl     | string       | Direct URL to workflow run                                                   |
| github.status     | string       | Raw GitHub status (queued, in_progress, completed)                           |
| github.conclusion | string\|null | Raw GitHub conclusion (success, failure, cancelled, skipped, timed_out)      |
| reportAvailable   | boolean      | Whether HTML report can be fetched                                           |

**Status Values:**

| Status    | GitHub Status | GitHub Conclusion | Report Available |
| --------- | ------------- | ----------------- | ---------------- |
| queued    | queued        | null              | false            |
| running   | in_progress   | null              | false            |
| completed | completed     | success           | true             |
| failed    | completed     | failure           | false            |
| cancelled | completed     | cancelled         | false            |
| not_found | N/A           | N/A               | false            |

**404 Not Found:**

```json
{
  "success": false,
  "message": "Workflow 'unit-test.yml' not found in organization/rule-001"
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "message": "Error description"
}
```

**What Happens:**

1. Queries GitHub Actions API for workflow runs
2. Filters by specified branch
3. Retrieves most recent run (per_page=1)
4. Normalizes GitHub status and conclusion
5. Determines report availability
6. Returns comprehensive status information

**Use Cases:**

- Monitor test execution progress
- Determine if test report is ready
- Display test status in CI/CD dashboard
- Automated polling for test completion

## Configuration

### Environment Variables

Comprehensive environment configuration reference:

**Server Configuration**

| Variable  | Type   | Default     | Required | Description         |
| --------- | ------ | ----------- | -------- | ------------------- |
| PORT      | number | 3000        | Yes      | HTTP server port    |
| HOST      | string | 0.0.0.0     | No       | Server bind address |
| NODE_ENV  | string | development | No       | Environment mode    |
| LOG_LEVEL | string | info        | No       | Logging verbosity   |

**GitHub Configuration**

| Variable                | Type   | Required | Description                                     |
| ----------------------- | ------ | -------- | ----------------------------------------------- |
| GITHUB_API_URL          | string | Yes      | GitHub REST API base URL                        |
| GITHUB_TEMPLATE_OWNER   | string | Yes      | Template repository owner/organization          |
| GITHUB_DEFAULT_BRANCH   | string | Yes      | Default branch name for new repositories        |
| GITHUB_TEMPLATE_REPO    | string | Yes      | Name of template repository                     |
| GITHUB_TEST_REPORT_PATH | string | Yes      | Relative path to HTML test report in repository |

**Encryption Configuration**

| Variable       | Type   | Required | Description                             |
| -------------- | ------ | -------- | --------------------------------------- |
| ENCRYPTION_KEY | string | Yes      | 32-byte AES encryption key (256-bit)    |
| ENCRYPTION_IV  | string | Yes      | 16-byte initialization vector (128-bit) |

**Multi-Tenant Configuration**

Dynamic environment variables per tenant:

```bash
GITHUB_TOKEN_<TENANT_ID>=<encrypted_github_token>
GITHUB_ORG_NAME_<TENANT_ID>=<organization_name>
```

Example configuration for multiple tenants:

```bash
GITHUB_TOKEN_ACME=<encrypted_github_token>
GITHUB_ORG_NAME_ACME=acme-corporation

GITHUB_TOKEN_BETA=<encrypted_github_token>
GITHUB_ORG_NAME_BETA=beta-industries

GITHUB_TOKEN_GAMMA=<encrypted_github_token>
GITHUB_ORG_NAME_GAMMA=gamma-solutions
```

### GitHub Token Requirements

Your GitHub Personal Access Token requires these permissions:

**Repository Permissions (Essential)**

- Contents: Read and write
- Metadata: Read
- Administration: Read and write (for repository creation)

**Workflow Permissions (For Test Status)**

- Actions: Read

**OAuth Scopes (Classic Tokens)**

- `repo` (full control of private repositories)
- `workflow` (update GitHub Actions workflows)

### Generating Encrypted Tokens

Use the built-in encryption utility:

```javascript
const crypto = require('crypto');

const key = Buffer.from('your-32-byte-encryption-key-here', 'utf8');
const iv = Buffer.from('your16byteivhere', 'utf8');
const token = 'ghp_your_github_token_here';

const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
let encrypted = cipher.update(token, 'utf8', 'hex');
encrypted += cipher.final('hex');

console.log('Encrypted token:', encrypted);
```

### Template Repository Structure

Your template repository should contain:

```
template-repo/
├── .github/
│   └── workflows/
│       └── unit-test.yml          # Unit test workflow
├── __tests__/
│   └── unit/
│       └── rule.test.ts           # Will be populated
├── src/
│   └── rule.ts                    # Will be populated
├── coverage/                      # Generated by tests
│   └── lcov-report/
│       └── index.html            # Test report location
├── package.json                   # Will be updated automatically
├── tsconfig.json
├── jest.config.ts
└── README.md
```

**Required Workflow: `.github/workflows/unit-test.yml`**

```yaml
name: Unit Tests

on:
  push:
    branches: ['*']
  pull_request:
    branches: ['*']

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test -- --coverage
      - name: Generate HTML Report
        run: npm run test:coverage
      - name: Commit Coverage
        run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          git add coverage/
          git diff --quiet && git diff --staged --quiet || git commit -m "Update coverage report"
          git push
```

### Configuration Validation

The application validates configuration on startup:

- All required environment variables must be present
- ENCRYPTION_KEY must be exactly 32 bytes
- ENCRYPTION_IV must be exactly 16 bytes
- GitHub API URL must be valid
- Port must be a valid number

Validation errors will prevent server startup with descriptive error messages.

## Development

### Available Scripts

**Development**

```bash
npm run dev              # Start development server with hot reload (nodemon)
npm run build            # Compile TypeScript to JavaScript (dist/)
npm start                # Run production build from dist/
```

**Testing**

```bash
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode (re-run on changes)
npm run test:coverage    # Run tests with coverage report
```

**Code Quality**

```bash
npm run lint             # Run ESLint and Prettier checks
npm run lint:eslint      # Run ESLint only
npm run lint:prettier    # Check code formatting with Prettier
npm run fix:eslint       # Auto-fix ESLint issues
npm run fix:prettier     # Auto-format code with Prettier
```

**Maintenance**

```bash
npm run clean            # Remove dist, node_modules, coverage, package-lock.json
npm run prepare          # Set up Husky Git hooks (runs automatically after install)
```

### Development Workflow

**Initial Setup**

```bash
# Clone and install
git clone <repository-url>
cd rule-studio-devtestops
npm install

# Configure environment
cp .env.sample .env
# Edit .env with your configuration

# Start development server
npm run dev
```

**Making Changes**

1. Create feature branch

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make code changes in `src/` directory

3. Run tests

   ```bash
   npm test
   ```

4. Check code quality

   ```bash
   npm run lint
   ```

5. Fix any issues

   ```bash
   npm run fix:eslint
   npm run fix:prettier
   ```

6. Commit changes (Husky runs pre-commit hooks)

   ```bash
   git add .
   git commit -m "Description of changes"
   ```

7. Push and create pull request
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Structure Guidelines

**Controllers** (`src/app.controller.ts`)

- Handle HTTP requests and responses
- Minimal business logic
- Delegate to services
- Return appropriate HTTP status codes

**Services** (`src/services/`)

- Contain business logic
- GitHub API integration
- Data transformation
- Error handling

**Schemas** (`src/schemas/`)

- Request validation schemas (TypeBox)
- Response type definitions
- Exported TypeScript types

**Interfaces** (`src/interfaces/`)

- TypeScript type definitions
- API response types
- Configuration interfaces

**Utilities** (`src/utils/`)

- Helper functions
- Encryption/decryption
- JWT parsing
- Schema utilities

**Middleware** (`src/auth/`, `src/utils/helper.ts`)

- Authentication
- Authorization
- Request preprocessing
- Token handling

### Debugging

**Development Logging**

```bash
# Set detailed logging
LOG_LEVEL=debug npm run dev
```

**Debugging with VS Code**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

**Testing Individual Endpoints**

```bash
# Using curl
curl -X POST http://localhost:3050/api/v1/bootstrap \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ruleId":"test-001","ruleVersion":"1.0.0"}'

# Using HTTPie
http POST localhost:3050/api/v1/bootstrap \
  Authorization:"Bearer $JWT_TOKEN" \
  ruleId=test-001 \
  ruleVersion=1.0.0
```

### Adding New Endpoints

1. **Define Schema** (`src/schemas/newFeatureSchema.ts`)

```typescript
import { Type, type Static } from '@sinclair/typebox';

export type NewFeatureBody = Static<typeof NewFeatureBodySchema>;
export const NewFeatureBodySchema = Type.Object({
  field1: Type.String(),
  field2: Type.Number(),
});

export type NewFeatureResponse = Static<typeof NewFeatureResponseSchema>;
export const NewFeatureResponseSchema = Type.Object({
  success: Type.Boolean(),
  data: Type.Any(),
});
```

2. **Create Handler** (`src/services/newFeature.service.ts`)

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { NewFeatureBody } from '../schemas/newFeatureSchema';

export const newFeatureHandler = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const body = request.body as NewFeatureBody;
  // Implementation
  reply.status(200).send({ success: true, data: {} });
};
```

3. **Register Route** (`src/router.ts`)

```typescript
import { newFeatureHandler } from './services/newFeature.service';
import { NewFeatureBodySchema, NewFeatureResponseSchema } from './schemas';

fastify.post(
  '/v1/new-feature',
  SetOptionsBodyAndParams(
    newFeatureHandler,
    NewFeatureBodySchema,
    undefined,
    NewFeatureResponseSchema,
    [tokenMiddleware]
  )
);
```

4. **Write Tests** (`__tests__/unit/newFeature.service.test.ts`)

```typescript
import { newFeatureHandler } from '../../src/services/newFeature.service';

describe('newFeatureHandler', () => {
  it('should handle valid request', async () => {
    // Test implementation
  });
});
```

## Testing

### Test Configuration

**Jest Configuration** (`jest.config.ts`)

- Test framework: Jest v29.7.0
- TypeScript support: ts-jest
- Coverage threshold: 100% (achieved across all metrics)
- Coverage collected from: `src/**/*.ts` (excluding config, interfaces, schemas, clients)
- Test location: `__tests__/unit/**`
- Total test suites: 1
- Total tests: 84 (all passing)
- Covered modules:
  - `src/services/github.logic.service.ts` (55 tests)
  - `src/app.controller.ts` (1 test)
  - `src/utils/decrypt-utilis.ts` (6 tests)
  - `src/auth/authHandler.ts` (10 tests)
  - `src/middleware/tenantMiddleware.ts` (5 tests)
  - `src/utils/schema-utils.ts` (7 tests)

### Running Tests

**Basic Test Execution**

```bash
# Run all tests once
npm test

# Run tests in watch mode (interactive)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

**Advanced Test Options**

```bash
# Run specific test file
npm test -- github.logic.service.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="bootstrap"

# Run tests with verbose output
npm test -- --verbose

# Run tests without cache
npm test -- --no-cache

# Update snapshots
npm test -- -u
```

### Test Structure

**Test File Location**

```
__tests__/
└── unit/
    └── github.logic.service.test.ts    # Service tests
```

**Test File Template**

```typescript
import { handlerFunction } from '../../src/services/service.file';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Mock dependencies
jest.mock('@tazama-lf/frms-coe-lib', () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('Service Name', () => {
  let request: Partial<FastifyRequest>;
  let reply: Partial<FastifyReply>;

  beforeEach(() => {
    request = {
      headers: {
        de_gh_token: 'test-token',
        organization_name: 'test-org',
      },
      body: {},
    };

    reply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handlerFunction', () => {
    it('should handle successful case', async () => {
      // Test implementation
    });

    it('should handle error case', async () => {
      // Test implementation
    });
  });
});
```

### Coverage Reports

**Viewing Coverage**

After running `npm run test:coverage`:

```bash
# Open HTML report in browser
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html # Windows
xdg-open coverage/lcov-report/index.html # Linux
```

**Coverage Output**

```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |     100 |      100 |     100 |     100 |
 github.logic.service.ts |     100 |      100 |     100 |     100 |
--------------------|---------|----------|---------|---------|-------------------
```

### Mocking Guidelines

**Mocking GitHub API**

```typescript
const mockResponse = {
  ok: true,
  json: async () => ({ data: 'value' }),
  text: async () => 'success',
};

(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
```

**Mocking Multiple Calls**

```typescript
(global.fetch as jest.Mock)
  .mockResolvedValueOnce(mockResponse1)
  .mockResolvedValueOnce(mockResponse2)
  .mockRejectedValueOnce(new Error('API Error'));
```

**Mocking Fastify Request/Reply**

```typescript
const request = {
  headers: { de_gh_token: 'token', organization_name: 'org' },
  body: { ruleId: '001' },
  query: { param: 'value' },
} as unknown as FastifyRequest;

const reply = {
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  header: jest.fn().mockReturnThis(),
} as unknown as FastifyReply;
```

### Test Coverage Standards

**Coverage Achievement**

Current test coverage:

- Branches: 100% ✅
- Functions: 100% ✅
- Lines: 100% ✅
- Statements: 100% ✅

All service code is fully tested with comprehensive test suites covering:

- All handler functions (bootstrap, populate, promote, test reporting)
- Success and error scenarios
- Edge cases and boundary conditions
- GitHub API interactions and error handling

**What to Test**

✅ **Currently Tested (100% Coverage Achieved)**

- All service handler functions
  - `bootstrapHandler` - Repository creation from templates
  - `populateHandler` - Code injection and updates
  - `promoteHandler` - Branch creation and synchronization
  - `fetchLatestTestReportHandler` - Test report retrieval
  - `getUnitTestStatusHandler` - Workflow status monitoring
- Success scenarios for all operations
- Error scenarios and edge cases
- Input validation and error handling
- GitHub API interactions and responses
- Authentication and authorization flows
- Token encryption/decryption
- Multi-tenant credential resolution

**Testing Coverage Details**

Each handler is tested for:

- ✅ Missing GitHub token scenarios
- ✅ Missing organization name scenarios
- ✅ Successful operation flows
- ✅ GitHub API error responses
- ✅ Network failures and timeouts
- ✅ Invalid inputs and edge cases
- ✅ Branch operations (create, sync, update)
- ✅ Workflow status variations (queued, running, completed, failed, cancelled)
- ✅ File operations (read, write, update)
- ✅ Repository content synchronization with retry logic

**Files Excluded from Coverage**

- Type definitions and interfaces
- Configuration files
- Entry point (index.ts)
- Router setup (routing configuration)
- Client initialization (Fastify setup)

**Writing Effective Tests**

Best practices:

- One assertion per test when possible
- Clear test descriptions
- Arrange-Act-Assert pattern
- Mock external dependencies
- Test error paths
- Verify correct HTTP status codes
- Validate response structure

## Docker Deployment

### Building Docker Image

**Standard Build**

```bash
docker build -t rule-studio-devtestops:latest .
```

**Tagged Build**

```bash
docker build -t rule-studio-devtestops:1.0.0 .
docker build -t rule-studio-devtestops:latest .
```

**Multi-Platform Build**

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t rule-studio-devtestops:latest .
```

### Running Container

**Basic Run**

```bash
docker run -d \
  -p 3000:3000 \
  --name rule-studio-devtestops \
  --env-file .env \
  rule-studio-devtestops:latest
```

**With Explicit Environment Variables**

```bash
docker run -d \
  -p 3000:3000 \
  --name rule-studio-devtestops \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e GITHUB_API_URL=https://api.github.com \
  -e GITHUB_TEMPLATE_OWNER=your-org \
  -e GITHUB_DEFAULT_BRANCH=main \
  -e GITHUB_TEMPLATE_REPO=rule-template \
  -e GITHUB_TEST_REPORT_PATH=coverage/lcov-report/index.html \
  -e ENCRYPTION_KEY=your-key \
  -e ENCRYPTION_IV=your-iv \
  rule-studio-devtestops:latest
```

**With Volume Mounts**

```bash
docker run -d \
  -p 3000:3000 \
  --name rule-studio-devtestops \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  rule-studio-devtestops:latest
```

### Docker Compose

**Start Services**

```bash
# Start in detached mode
docker-compose up -d

# Start with rebuild
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

**Docker Compose Configuration** (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: rule-studio-devtestops
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
      - LOG_LEVEL=info
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test:
        ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:3050/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
```

### Container Management

**View Running Containers**

```bash
docker ps
```

**View Container Logs**

```bash
# Real-time logs
docker logs -f rule-studio-devtestops

# Last 100 lines
docker logs --tail 100 rule-studio-devtestops

# Logs since timestamp
docker logs --since 2026-02-12T10:00:00 rule-studio-devtestops
```

**Execute Commands in Container**

```bash
# Interactive shell
docker exec -it rule-studio-devtestops sh

# Run single command
docker exec rule-studio-devtestops npm --version
```

**Stop and Remove Container**

```bash
docker stop rule-studio-devtestops
docker rm rule-studio-devtestops
```

### Health Checks

**Container Health Status**

```bash
docker inspect --format='{{.State.Health.Status}}' rule-studio-devtestops
```

**Manual Health Check**

```bash
docker exec rule-studio-devtestops wget -q -O- http://localhost:3050/api/health
```

### Container Optimization

**Multi-Stage Build Benefits**

- Smaller final image size
- Only production dependencies included
- No build tools in production image
- Better security posture

**Image Size**

```bash
# Check image size
docker images rule-studio-devtestops

# Expected size: ~200-300 MB (alpine-based)
```

**Security Scanning**

```bash
# Scan for vulnerabilities
docker scan rule-studio-devtestops:latest
```

## Project Structure

```
rule-studio-devtestops/
├── __tests__/                           # Test directory
│   └── unit/                            # Unit tests
│       └── github.logic.service.test.ts # Service layer tests
│
├── coverage/                            # Test coverage reports (generated)
│   ├── clover.xml                       # Clover format
│   ├── coverage-final.json              # JSON format
│   ├── lcov.info                        # LCOV format
│   └── lcov-report/                     # HTML report
│       └── index.html                   # Coverage dashboard
│
├── postman/                             # API testing collections
│   ├── SandBox.postman_environment.json # Environment variables
│   └── Rule Studio DevTestOps API.postman_collection.json # API collection
│
├── src/                                 # Source code
│   ├── auth/                            # Authentication
│   │   └── authHandler.ts               # JWT and claim validation
│   │
│   ├── clients/                         # External clients
│   │   └── fastify.ts                   # Fastify server initialization
│   │
│   ├── interfaces/                      # TypeScript type definitions
│   │   ├── envConfig.interface.ts       # Environment configuration types
│   │   ├── github.interfaces.ts         # GitHub API response types
│   │   ├── jwtpayload.interfaces.ts     # JWT payload types
│   │   ├── packagejson.interfaces.ts    # Package.json types
│   │   ├── tenant.interface.ts          # Tenant credential types
│   │   └── index.ts                     # Interface exports
│   │
│   ├── schemas/                         # Request/response schemas (TypeBox)
│   │   ├── bootstrapSchema.ts           # Bootstrap endpoint schemas
│   │   ├── fetchLatestTestReportSchema.ts # Test report schemas
│   │   ├── populateSchema.ts            # Populate endpoint schemas
│   │   ├── promoteSchema.ts             # Promote endpoint schemas
│   │   ├── unitTestStatusSchema.ts      # Unit test status schemas
│   │   └── index.ts                     # Schema exports
│   │
│   ├── services/                        # Business logic
│   │   └── github.logic.service.ts      # GitHub API operations
│   │
│   ├── utils/                           # Utility functions
│   │   ├── helper.ts                    # Encryption, JWT, tenant resolution
│   │   └── schema-utils.ts              # Schema validation helpers
│   │
│   ├── app.controller.ts                # HTTP request handlers
│   ├── config.ts                        # Configuration validation
│   ├── index.ts                         # Application entry point
│   └── router.ts                        # Route definitions
│
├── .env                                 # Environment variables (not in repo)
├── .env.example                         # Environment template
├── .gitignore                           # Git ignore rules
├── .npmrc                               # npm configuration
├── docker-compose.yml                   # Docker Compose configuration
├── Dockerfile                           # Docker image definition
├── eslint.config.mjs                    # ESLint configuration (v9)
├── jest.config.ts                       # Jest test configuration
├── nodemon.json                         # Nodemon configuration
├── package.json                         # Dependencies and scripts
├── package-lock.json                    # Dependency lock file
├── README.md                            # This documentation
└── tsconfig.json                        # TypeScript configuration
```

### Directory Descriptions

**`__tests__/`**

- Unit tests for all service functions
- Organized by functionality
- Uses Jest with TypeScript support
- Mocks external dependencies (GitHub API, loggers)

**`coverage/`**

- Generated by Jest when running `npm run test:coverage`
- Contains HTML, JSON, and LCOV format reports
- Not committed to repository (in .gitignore)

**`postman/`**

- Ready-to-use Postman collection for API testing
- Environment configuration for different setups
- Includes all API endpoints with example requests

**`src/auth/`**

- Authentication and authorization logic
- JWT token validation
- Claims verification (editor claim required)

**`src/clients/`**

- External service client configurations
- Fastify server setup with middleware
- CORS, Helmet, and sensible defaults

**`src/interfaces/`**

- TypeScript interface definitions
- Type safety for API responses
- Configuration type definitions
- Improves IDE intellisense and type checking

**`src/schemas/`**

- Runtime validation schemas using TypeBox
- Request body validation
- Query parameter validation
- Response structure validation
- Automatic TypeScript type generation

**`src/services/`**

- Core business logic implementation
- GitHub API integration
- Repository operations (bootstrap, populate, promote)
- Test monitoring and reporting
- Error handling and logging

**`src/utils/`**

- Reusable utility functions
- AES-256-CBC encryption/decryption
- JWT payload parsing and validation
- Tenant credential resolution
- Schema validation helpers

### Key Files Explained

**`src/index.ts`**

- Application entry point
- Initializes logger service
- Loads configuration
- Starts Fastify server
- Handles startup errors gracefully

**`src/router.ts`**

- Defines all API routes
- Maps routes to handlers
- Attaches middleware (authentication)
- Binds schemas to endpoints
- Central routing configuration

**`src/config.ts`**

- Loads environment variables
- Validates required configuration
- Uses @tazama-lf/frms-coe-lib for validation
- Type-safe configuration object
- Fails fast on misconfiguration

**`src/services/github.logic.service.ts`**

- Contains all handler functions for endpoints
- GitHub API integration logic
- Repository lifecycle management
- Test report retrieval and status checking
- Error handling with proper HTTP codes

**`src/clients/fastify.ts`**

- Fastify instance creation
- Middleware registration (CORS, Helmet)
- Plugin configuration
- Server initialization logic

**`src/utils/helper.ts`**

- Token encryption and decryption
- JWT decoding without verification
- Tenant credential retrieval
- Token middleware for authentication
- Header enrichment with tenant data

**`src/auth/authHandler.ts`**

- JWT token validation
- Claims extraction and verification
- Editor claim requirement enforcement
- Authentication error responses

**`jest.config.ts`**

- Jest test framework configuration
- Coverage thresholds (100% achieved)
- TypeScript transformation settings
- Coverage collection patterns
- Ignore patterns for non-testable files

**`tsconfig.json`**

- TypeScript compiler options
- Target ES2022 with CommonJS modules
- Strict type checking enabled
- Source maps for debugging
- Output to dist/ directory

**`Dockerfile`**

- Multi-stage Docker build
- Builder stage: Compiles TypeScript
- Runner stage: Production-ready image
- Based on Node 20 Alpine (lightweight)
- Includes healthcheck configuration

**`docker-compose.yml`**

- Single-service composition
- Port mapping (3000:3000)
- Environment variable injection
- Healthcheck configuration
- Restart policy

## Security

### Authentication and Authorization

**JWT-Based Multi-Tenant Authentication**

All protected endpoints require valid JWT tokens with:

- Valid Bearer token format
- Proper JWT structure (header.payload.signature)
- `tenantId` field in payload
- `editor` claim in claims array

**Token Validation Flow**

1. Extract Authorization header
2. Validate Bearer token format
3. Decode JWT payload
4. Extract tenantId from payload
5. Verify editor claim exists
6. Retrieve encrypted GitHub token for tenant
7. Decrypt token using AES-256-CBC
8. Enrich request with decrypted credentials
9. Proceed to handler

**Authorization Failures**

| Status                    | Condition                         |
| ------------------------- | --------------------------------- |
| 401 Unauthorized          | Missing Authorization header      |
| 401 Unauthorized          | Invalid Bearer token format       |
| 401 Unauthorized          | Invalid JWT structure             |
| 400 Bad Request           | Missing tenantId in JWT           |
| 403 Forbidden             | Missing editor claim              |
| 500 Internal Server Error | Tenant credentials not configured |
| 500 Internal Server Error | Token decryption failure          |

### Encryption

**AES-256-CBC Encryption**

GitHub tokens are encrypted at rest using:

- Algorithm: AES-256-CBC
- Key size: 256 bits (32 bytes)
- IV size: 128 bits (16 bytes)
- Encoding: Hexadecimal

**Encrypting GitHub Tokens**

```javascript
const crypto = require('crypto');

function encryptToken(token, key, iv) {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'utf8'),
    Buffer.from(iv, 'utf8')
  );
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Example usage
const encryptedToken = encryptToken(
  'ghp_yourGitHubTokenHere',
  'your-32-byte-encryption-key-here',
  'your-16-byte-iv!!'
);

console.log(`GITHUB_TOKEN_TENANT=${encryptedToken}`);
```

### Data Protection

**Environment Variables**

- Never commit `.env` files to version control
- Use `.env.sample` as template
- Restrict file permissions: `chmod 600 .env`
- Use different encryption keys per environment

**Request/Response Security**

- All schemas validated using TypeBox
- TypeScript provides compile-time type safety
- Input sanitization through schema validation
- No direct user input passed to GitHub API
- Base64 encoding prevents code injection

**Logging Security**

- Tokens never logged
- Sensitive data redacted from logs
- Request IDs for audit trails
- Configurable log levels
- Structured logging with Pino

### Network Security

**CORS Configuration**

```typescript
// Production
methods: ['GET']; // Read-only in production

// Development
methods: ['GET', 'POST', 'PUT']; // Full access in development
```

**Security Headers (Helmet)**

Automatically applied:

- X-DNS-Prefetch-Control
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- X-Download-Options
- X-Permitted-Cross-Domain-Policies

**API Rate Limiting**

Recommended implementation for production:

```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '15 minutes',
  cache: 10000,
  allowList: ['127.0.0.1'],
  redis: redisClient, // Optional Redis backing
  keyGenerator: (request) => {
    return request.headers['x-tenant-id'] as string;
  },
});
```

### GitHub Token Security

**Token Scope Requirements**

Minimum required scopes:

- `repo` (repository access)
- `workflow` (workflow access for test status)

**Token Best Practices**

1. Use fine-grained personal access tokens (if available)
2. Set expiration dates (90 days maximum)
3. Rotate tokens regularly
4. One token per tenant (isolation)
5. Monitor token usage through GitHub API
6. Revoke compromised tokens immediately
7. Use GitHub App tokens for production (preferred)

**Token Rotation Procedure**

1. Generate new GitHub token
2. Encrypt new token
3. Update environment variable
4. Restart service (zero-downtime deployment)
5. Revoke old token after verification
6. Document rotation in audit log

### Vulnerability Management

**Dependency Scanning**

```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

**Container Scanning**

```bash
# Scan Docker image
docker scan rule-studio-devtestops:latest

# Use vulnerability databases
trivy image rule-studio-devtestops:latest
```

**Security Updates**

- Monitor GitHub Security Advisories
- Subscribe to npm security notifications
- Automated dependency updates (Dependabot)
- Regular security audits

### Production Security Checklist

Before deploying to production:

- [ ] Use HTTPS/TLS for all connections
- [ ] Rotate all encryption keys
- [ ] Generate unique keys per environment
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Use secret management system
- [ ] Enable audit logging
- [ ] Implement monitoring and alerting
- [ ] Conduct security audit
- [ ] Review GitHub token permissions
- [ ] Set up intrusion detection
- [ ] Configure backup procedures
- [ ] Document incident response plan
- [ ] Use read-only filesystem in containers
- [ ] Run containers as non-root user
- [ ] Implement network policies
- [ ] Enable container security scanning
- [ ] Use private container registry

### Compliance Considerations

**Data Handling**

- No PII stored in application
- All GitHub tokens encrypted at rest
- Audit trail via structured logging
- Request/response logging optional

**Access Control**

- JWT-based authentication
- Role-based authorization (editor claim)
- Multi-tenant isolation
- Per-tenant credential segregation

**Audit Requirements**

- All API calls logged with request ID
- Tenant identification in logs
- Timestamp for all operations
- Success/failure status tracked
- GitHub operation audit via GitHub API logs

## Troubleshooting

### Common Issues

**Issue: Server fails to start**

```
Error: ENCRYPTION_KEY must be 32 bytes
```

**Solution:** Ensure ENCRYPTION_KEY is exactly 32 bytes:

```bash
# Generate valid key
node -e "console.log(require('crypto').randomBytes(32).toString('base64').substring(0,32))"
```

**Issue: Authentication fails**

```json
{
  "error": "tenantId not found in token"
}
```

**Solution:** JWT must include tenantId in payload:

```json
{
  "tenantId": "your-tenant-id",
  "claims": ["editor"]
}
```

**Issue: GitHub API rate limit exceeded**

```
API rate limit exceeded for user ID
```

**Solutions:**

1. Wait for rate limit reset (check X-RateLimit-Reset header)
2. Use GitHub App tokens (higher rate limits)
3. Implement request caching
4. Add request throttling

**Issue: Repository creation fails**

```
Repository rule-001 already exists
```

**Solutions:**

1. Delete existing repository
2. Use different ruleId
3. Check organization permissions

**Issue: Test report not found**

```json
{
  "success": false,
  "message": "The test report at path 'coverage/lcov-report/index.html' does not exist"
}
```

**Solutions:**

1. Ensure GitHub Actions workflow generates HTML report
2. Verify workflow commits coverage to repository
3. Check GITHUB_TEST_REPORT_PATH configuration
4. Wait for workflow to complete successfully

**Issue: Branch promotion fails**

```
Failed to create commit: Reference already exists
```

**Solutions:**

1. Branch already exists and is synchronized
2. Delete branch and retry
3. Check GitHub branch protection rules

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Health Check Failures

**Container health check failing**

```bash
# Check container logs
docker logs rule-studio-devtestops

# Manual health check
curl http://localhost:3050/api/health

# Check container network
docker inspect rule-studio-devtestops
```

### Performance Issues

**Slow response times**

Possible causes:

1. GitHub API latency
2. Network issues
3. Rate limiting backoff
4. Large file operations

**Solutions:**

- Monitor GitHub API response times
- Implement response caching
- Use connection pooling
- Optimize file sizes

**Memory leaks**

Monitor memory usage:

```bash
# Inside container
docker stats rule-studio-devtestops

# Node.js memory usage
node --trace-gc dist/index.js
```

### Getting Help

**Log collection**

```bash
# Application logs
npm run dev 2>&1 | tee application.log

# Docker logs
docker logs rule-studio-devtestops > docker.log 2>&1

# Container stats
docker stats --no-stream > stats.log
```

**Issue reporting**

Include:

1. Node.js version (`node --version`)
2. npm version (`npm --version`)
3. Operating system
4. Environment variables (sanitized)
5. Error messages and stack traces
6. Steps to reproduce
7. Expected vs actual behavior

## License

This project is licensed under the Apache License 2.0.

```
SPDX-License-Identifier: Apache-2.0

Copyright 2026 Tazama

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## Acknowledgments

**Built With**

- [Fastify](https://fastify.dev/) - Fast and low overhead web framework for Node.js
- [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript
- [TypeBox](https://github.com/sinclairzx81/typebox) - JSON Schema Type Builder
- [Jest](https://jestjs.io/) - Delightful JavaScript testing framework
- [Pino](https://getpino.io/) - Super fast, all natural JSON logger

**Tazama Libraries**

- [@tazama-lf/auth-lib](https://github.com/tazama-lf/auth-lib) - Authentication utilities
- [@tazama-lf/frms-coe-lib](https://github.com/tazama-lf/frms-coe-lib) - FRMS Center of Excellence library

**Part of Tazama Ecosystem**

This service is part of the [Tazama Financial Risk Management System](https://github.com/tazama-lf), an open-source platform for real-time transaction monitoring and fraud detection.

**Contributors**

Thank you to all contributors who have helped build and improve this service.

## Additional Resources

**Documentation**

- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [TypeBox Documentation](https://github.com/sinclairzx81/typebox)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

**Related Projects**

- [Tazama FRMS](https://github.com/tazama-lf) - Financial Risk Management System
- [Tazama Documentation](https://tazama.org) - Project documentation and guides

**Support**

- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share ideas
- Documentation: Comprehensive guides and API reference

**Status Badges**

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)
![Node Version](https://img.shields.io/badge/node-v20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![Fastify](https://img.shields.io/badge/Fastify-5.6.2-black)
![Tests](https://img.shields.io/badge/tests-84%20passing-brightgreen)
