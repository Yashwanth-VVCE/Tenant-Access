# Tenant Access Application

Tenant Access Application is a full-stack SAP CPI monitoring and JMS queue management tool with a React frontend and an Express backend. It lets a user sign in, connect to an SAP BTP / SAP CPI tenant with client credentials, browse integration packages and artifacts, trigger an iFlow, review monitoring data stored in SAP HANA, and manage JMS message queues with move, retry, and delete operations.

## Business Flow

### Phase 1: Authentication & Tenant Connection
1. User signs in to the web app with hardcoded credentials.
2. User navigates to the Tenant Access page and enters:
   - Client ID and Client Secret (for OAuth)
   - Token URL (SAP OAuth endpoint)
   - Base URL (SAP CPI tenant URL)
3. Backend validates the tenant connection by:
   - Fetching an access token from the SAP OAuth endpoint
   - Fetching integration packages from the CPI API
   - Testing the tenant connection health

### Phase 2: CPI Integration Monitoring (StatusOverview)
4. User selects an integration package and its artifacts.
5. Backend triggers the selected CPI flow and monitors execution.
6. CPI writes monitoring data into SAP HANA database.
7. Frontend loads monitoring records from HANA through the backend REST endpoints.
8. User can:
   - Refresh monitoring data
   - Inspect message payloads (base64 decoded)
   - Download individual payload files
   - Export all payloads to Excel
   - Send Excel reports via email (via SMTP)

### Phase 3: JMS Queue Management (JmsQueues) [CURRENT ACTIVE STAGE]
9. User navigates to JMS Queues page to manage failed or stuck messages.
10. Backend fetches all available JMS queues from the CPI tenant.
11. User selects a queue and views all messages with status, timestamps, and retry counts.
12. User can perform the following operations on selected messages:
    - **MOVE**: Transfer messages from source queue to target queue
    - **RETRY**: Reprocess messages (changes message status to trigger reprocessing)
    - **DELETE**: Remove messages from the queue permanently

## Current Development Stage

**Active Focus**: JMS Queue Management with Move, Retry, and Delete Operations
- ✅ Tenant connection and authentication
- ✅ CPI package and artifact browsing
- ✅ CPI flow triggering
- ✅ HANA monitoring data display
- ✅ JMS queue fetching and message listing
- ✅ Move operation (with dual-route support: direct API and batch operations)
- ✅ Retry operation (message reprocessing via batch operations)
- ✅ Delete operation (permanent message removal)
- 🔄 Logging optimization (removing unnecessary console logs)

## How Data Fetching Works

### 1. Tenant Connection & OAuth
- Frontend sends `POST /connectTenant` with client credentials
- Backend exchanges credentials for OAuth access token
- Token is stored in frontend localStorage for subsequent requests
- Base URL is determined and validated with multiple candidates

### 2. CPI Package & Artifact Discovery
- `POST /getArtifacts` fetches all integration packages
- Artifacts are fetched per package with retry logic (up to 8 attempts)
- Results are cached for 5 minutes to reduce API load
- Failed packages are logged but don't block the entire operation

### 3. JMS Queue & Message Discovery
- `POST /jms-queues` fetches all available message queues
- `POST /jms-messages` fetches messages for a specific queue
- Messages are enriched with additional metadata:
  - Message ID, Status, Created/Due dates
  - Retry counts, Next retry schedule
  - Correlation IDs, iFlow names
- Message status values: "Failed", "Available", "Waiting"

### 4. CSRF Token Management
- Secure operations (move/retry/delete) require CSRF tokens
- `getApiCsrfContext()` fetches tokens with fallback candidates
- Tokens are validated and included in request headers
- Cookies are automatically extracted and sent with requests

## How Move, Retry, and Delete Operations Work

### MOVE Operation
**Purpose**: Transfer a message from one queue to another (e.g., failed queue → retry queue)

**Direct API Endpoint Format**:
```
PATCH /api/v1/Queues('<source-queue>')?operation=move&target_queue=<target-queue>&selector=<selector>
```

**Example Request URL**:
```
https://inccpidev.it-cpi001.cfapps.eu10.hana.ondemand.com/api/v1/Queues('JMS_Queue_100_DLQ')?operation=move&target_queue=JMS_Queue_100&selector=JMSMessageID='ID:10.147.158.688a3119dc16a96700:178'
```

Where:
- `JMS_Queue_100_DLQ` = Source queue (dead letter queue)
- `JMS_Queue_100` = Target queue (main processing queue)
- `JMSMessageID='ID:10.147.158.688a3119dc16a96700:178'` = Selector to identify the specific message

**Flow**:
1. User selects message(s) and target queue
2. Frontend calls `POST /jms-messages/move` with:
   - Source queue name
   - Target queue name
   - Array of message IDs
3. Backend tries **two routes** in sequence:
   - **Direct API Route** (`moveJmsMessageDirect`):
     - Constructs PATCH URL with OData key encoding:
       - Queue names are URL-encoded: `encodeODataKey('JMS_Queue_100_DLQ')` 
       - Selector uses JMSMessageID: `JMSMessageID='<message-id>'`
       - Full URL: `/api/v1/Queues('<queue>')?operation=move&target_queue=<target>&selector=<selector>`
     - Sends PATCH request with queue entity payload
     - More efficient if supported
   - **Batch Operation Route** (`moveJmsMessageViaBatch`):
     - Falls back to SAP UI batch protocol
     - Constructs multipart/mixed batch request
     - Sends MERGE and GET operations together
4. Backend logs operation:
   ```
   [move-direct] csrfPresent=true cookiePresent=true
   [move-direct] success for ID:10.147.158.688a3119dc16a96700:178 on https://...
   ```
5. Success response: `{ message: "Messages moved successfully." }`

**Error Handling**:
- If direct route fails, automatically tries batch route
- If both fail, returns descriptive error message
- Authoritative errors (400, 401, 403, etc.) throw immediately
- Retriable errors (429 rate limit, connection reset) retry with exponential backoff

### RETRY Operation
**Purpose**: Reprocess a failed message by changing its status back to "Available"

**Flow**:
1. User selects failed message(s) from a queue
2. Frontend calls `POST /jms-messages/retry` with:
   - Source queue name
   - Array of message IDs (with failed=true flag)
3. Backend attempts:
   - **Batch Operation Route** (`retryJmsMessageViaBatch`):
     - Fetches current message entity with all metadata
     - Sends MERGE request via batch API to update message
     - Triggers reprocessing workflow
   - **Fallback Route** (if batch fails):
     - Uses MERGE operation on `/api/v1/JmsMessages(...)` endpoint
     - Includes DataServiceVersion headers
4. Backend logs operation:
   ```
   [retry-batch] candidate=https://...
   [retry-batch] csrfPresent=true cookiePresent=true
   [retry-batch] body: [multipart batch request]
   [retry-batch] response status=200
   ```
5. Success response: `{ message: "Messages retried successfully." }`

**Important Note**: Retry operation may check error conditions:
- If "Error during operation retry or queue config change operation" occurs, it's caught and reported
- Message must be in Failed or specific states to be eligible for retry
- iFlow configuration must support retry capability

### DELETE Operation
**Purpose**: Permanently remove a message from the queue

**Flow**:
1. User selects message(s) to delete
2. Frontend calls `POST /jms-messages/delete` with:
   - Source queue name
   - Array of message IDs (with failed flag)
3. Backend processes deletion:
   - Constructs OData key: `JmsMessages(Msgid='xxx', Name='queue', Failed=false)`
   - Sends HTTP DELETE request to `/api/v1/JmsMessages(...)`
   - Includes required headers:
     - Authorization Bearer token
     - DataServiceVersion: 2.0
     - X-Requested-With: XMLHttpRequest
4. Backend logs deletion:
   ```
   [delete] Message xxx deleted from queue 'queue_name'
   ```
5. Success response: `{ message: "Messages deleted successfully." }`

**Safety Features**:
- Requires authorization token (OAuth)
- Messages are immediately deleted from backend (cannot be recovered)
- User confirmation should be implemented on frontend (optional)

## Current Stack

### Frontend
- React 19
- React Router 7
- Vite
- Material UI 7
- MUI Icons
- Browser `fetch` API and `localStorage`

### Backend
- Node.js
- Express 5
- Axios
- Nodemailer
- ExcelJS
- SAP HANA client
- PowerShell `Compress-Archive` for zip generation

### External Systems
- SAP BTP / SAP CPI tenant APIs
- SAP OAuth token endpoint
- SAP HANA database
- SMTP server for Excel mail delivery

## Repository Structure

```text
tenant-access/
+-- backend/
|   +-- package.json
|   +-- package-lock.json
|   `-- server.js
+-- frontend/
|   +-- package.json
|   +-- package-lock.json
|   +-- vite.config.js
|   +-- index.html
|   +-- public/
|   `-- src/
+-- requirements.txt
`-- README.md
```

## Frontend Overview

### Main Pages
- `frontend/src/pages/Home.jsx`
  Landing page with branding and login entry point.
- `frontend/src/pages/Login.jsx`
  Wrapper page for the login modal.
- `frontend/src/pages/TenantAccess.jsx`
  Tenant connection form for `clientId`, `clientSecret`, `tokenUrl`, and `baseUrl`.
- `frontend/src/pages/StatusOverview.jsx`
  Main monitoring page for package selection, artifact selection, CPI triggering, report refresh, payload download, and Excel export.
- `frontend/src/pages/Unauthorized.jsx`
  Redirect page shown when a user is not authenticated.

### Supporting Components
- `frontend/src/components/LoginModal.jsx`
  Handles local app login using hardcoded users.
- `frontend/src/components/ProtectedRoute.jsx`
  Protects the `/status` route by checking `localStorage`.
- `frontend/src/components/TopBar.jsx`
  Shared top navigation with logo, status shortcut, and logout.

### Frontend Routing

Defined in `frontend/src/App.jsx`:

- `/` -> Home
- `/login` -> Login
- `/tenant` -> Tenant Access
- `/status` -> Protected Status Overview
- `/unauthorized` -> Unauthorized

### Frontend Runtime Configuration

`frontend/src/config.js` currently contains:

```js
export const API_BASE_URL = "https://backend.cfapps.us10-001.hana.ondemand.com";
```

### Frontend Authentication Model

Application login is currently local and UI-level only. The login modal validates against these hardcoded users:

- `admin / admin123`
- `user / user123`

### Frontend Functional Flow

#### Tenant Access
- User submits tenant credentials from `TenantAccess.jsx`.
- Frontend calls `POST /connectTenant`.
- On success, frontend stores:
  - `token`
  - `baseUrl`
  - `packages`
- Then it navigates to `/status`.

#### Status Overview
- Package list is first loaded from `localStorage`.
- Artifact loading is lazy:
  - If a package is selected, artifacts are loaded for that package.
  - If package is `All`, artifacts are loaded only when the artifact selector is opened.
- Trigger action posts filter data to `/trigger-cpi`.
- Monitoring data is loaded from `/latest-report`.
- Users can:
  - refresh monitoring data
  - download single payloads
  - download all payloads as a zip
  - export the monitoring report to Excel
  - send the Excel file by email

### Important Frontend Behavior

- The status page uses `localStorage` for session-like state.
- Artifact loading guards against stale requests, so quick package switching does not show a false `Failed to load artifacts.` error.
- If `All` artifacts are loading and the user switches to a specific package, the UI keeps only the latest request result.
- Trigger, refresh, export, and download actions are disabled while related requests are running.

## Backend Overview

The backend lives in `backend/server.js` and exposes the REST endpoints used by the frontend.

### Key Responsibilities
- Validate SAP tenant connectivity
- Get OAuth access tokens
- Discover CPI packages and artifacts
- Trigger CPI iFlows
- Read monitoring data from SAP HANA
- Return payload files
- Export monitoring data to Excel
- Zip payload files for bulk download
- Send exported Excel files through SMTP

### Backend Middleware
- `cors`
- `express.json({ limit: "10mb" })`
- `express.text({ type: "text/*" })`

The current backend CORS configuration is:

```js
export const API_BASE_URL = "https://backend.cfapps.us10-001.hana.ondemand.com";
```

This allows requests from any origin. It is useful for development, but it should be restricted to the deployed frontend origin in production.

## Backend Helper Logic

### HANA Access
- `getConnection()`
  Opens an SAP HANA connection using environment variables.
- `getReportRows(conn)`
  Reads monitoring rows from `HACKTHON-POC.CPI_DATA`.
- `getPayloadRow(conn, mplId, logStart, attachmentTimestamp)`
  Fetches one payload record for file download.

### Payload Utilities
- `decodePayload(payload)`
  Decodes Base64 payloads when possible.
- `formatFileName(fileName, fileType, fallbackPrefix)`
  Ensures a proper file name and extension.
- `sanitizeFileName(value, fallback)`
  Removes invalid filename characters.
- `mapReportRow(row, index)`
  Converts database rows into frontend-ready objects.

### Excel Export
- `createReportsExcelBuffer(reports)`
  Builds an Excel workbook named `Monitoring Overview` and writes report rows into it.

### Zip Export
- `createReportsZip(reports)`
  Writes payload files into a temporary folder and compresses them into a `.zip` using PowerShell.

### CPI Tenant Discovery
- `cleanUrl(url)`
  Trims values and removes trailing slashes.
- `buildBaseUrlCandidates(baseUrl)`
  Tries both `.cfapps.` and `-rt.cfapps.` variations where needed.
- `tenantHeaders(token)`
  Returns CPI request headers.
- `fetchPackages(baseUrl, token)`
  Fetches integration packages and resolves the working API base URL.
- `fetchArtifactsForPackage(baseUrl, token, packageId)`
  Fetches artifacts with retry and backoff and uses a 60 second timeout per package request.
- `fetchArtifactsForPackagesInBatches(baseUrl, token, packages)`
  Fetches artifacts in limited parallel batches and keeps successful package results even if some packages fail.
- `getArtifactCacheEntry(cacheKey)`
  Returns a valid in-memory artifact cache entry.

### CPI Trigger Support
- `getTriggerCredentials()`
  Resolves trigger credentials from environment variables.
- `getAccessToken()`
  Gets an OAuth token using backend environment variables.

## Backend API Reference

### `POST /connectTenant`

Connects to a tenant using client credentials and fetches packages.

Request body:

```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "tokenUrl": "https://<tenant>.authentication.<region>.hana.ondemand.com/oauth/token",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

Response:
- `message`
- `packages`
- `token`
- `credentialSource`
- `baseUrl`

### `POST /getArtifacts`

Fetches artifacts for one package or all packages.

Request body:

```json
{
  "packageId": "All",
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

Response:
- `artifacts`
- `packages`
- `baseUrl`
- `cached` when served from cache
- `partial` for `All` artifact requests
- `failedPackages` for packages that timed out or failed during `All` loading

### `POST /getMessages`

Reads CPI message processing logs directly from the tenant API.

Request body:

```json
{
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "status": "COMPLETED",
  "artifactName": "IFLOW_NAME_OR_All",
  "fromDate": "2026-03-01T00:00:00",
  "toDate": "2026-03-10T23:59:59"
}
```

Response:
- `messages`

### `POST /trigger-cpi`

Posts the selected filters to the CPI trigger endpoint using Basic Auth credentials from environment variables.

Typical request body from the frontend:

```json
{
  "BASE_URL": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "IFLOW_NAME": "All",
  "STATUS": "All",
  "FROM_DATE": "2026-03-01T00:00:00",
  "TO_DATE": "2026-03-10T23:59:59"
}
```

Response:
- plain text or serialized JSON from CPI

### `POST /post-selection`

Alternative trigger endpoint that posts a simplified selection payload using a Bearer token from backend environment variables.

Request body:

```json
{
  "iflowName": "IF_SAMPLE",
  "status": "COMPLETED",
  "fromDate": "2026-03-01T00:00:00",
  "toDate": "2026-03-10T23:59:59"
}
```

### `GET /latest-report`

Returns the latest monitoring records from HANA.

Response:
- `reports`

### `GET /payload-file`

Returns one payload file from HANA based on:

- `mplId`
- `logStart`
- `attachmentTimestamp`

### `GET /export-reports-excel`

Returns the current monitoring report as an `.xlsx` file.

### `POST /send-excel-email`

Sends the generated Excel report as an email attachment.

Request body:

```json
{
  "from": "sender@example.com",
  "to": "receiver@example.com",
  "subject": "Monitoring Overview of Iflow"
}
```

### `GET /download-reports-zip`

Returns all payload files as a zip archive.

## JMS Queue Management API

### `POST /jms-queues`

Fetches all available JMS message queues from the CPI tenant.

Request body:

```json
{
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

Response:
```json
{
  "queues": [
    {
      "id": "queue-unique-id",
      "key": "queue-unique-id",
      "name": "ErrorQueue",
      "accessType": "Exclusive",
      "usage": "OK",
      "state": "Started",
      "entries": 42
    }
  ]
}
```

Queue statuses:
- `usage`: "OK" (queue is active) or "Stopped"
- `state`: "Started" or "Stopped"
- `accessType`: "Exclusive" or "Non-Exclusive"
- `entries`: Number of messages in the queue

### `POST /jms-messages`

Fetches all messages in a specific queue.

Request body:

```json
{
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "queueName": "ErrorQueue",
  "queueKey": "queue-unique-id"
}
```

Response:
```json
{
  "messages": [
    {
      "id": "unique-message-id-1",
      "jmsMessageId": "JMS-MSG-123",
      "messageId": "MSG-CORRELATION-ID",
      "status": "Failed",
      "dueAt": "2026-04-29 14:30:00",
      "createdAt": "2026-04-28 10:15:00",
      "retainUntil": "2026-05-15 10:15:00",
      "retryCount": 3,
      "nextRetryOn": "2026-04-29 15:00:00",
      "correlationId": "SAP-CORRELATION-UUID",
      "iflowName": "SendEmailFlow",
      "packageName": "EmailIntegration"
    }
  ]
}
```

Message status values:
- `Failed`: Message processing failed (eligible for retry or move)
- `Available`: Message is ready to be processed
- `Waiting`: Message is waiting for next retry attempt

### `POST /jms-messages/move`

Moves selected messages from source queue to target queue.

Request body:

```json
{
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "sourceQueueName": "ErrorQueue",
  "targetQueueName": "RetryQueue",
  "messages": [
    {
      "jmsMessageId": "JMS-MSG-123",
      "failed": true
    },
    {
      "jmsMessageId": "JMS-MSG-124",
      "failed": true
    }
  ]
}
```

Response on success:
```json
{
  "message": "Messages moved successfully."
}
```

**How it works**:
1. Frontend collects selected messages with their JMS message IDs
2. Backend attempts move via direct API route first (more efficient)
3. If direct route fails, backend falls back to batch operations
4. Operations are performed in parallel for multiple messages
5. Server logs show:
   - `[move-direct] candidate=https://...`
   - `[move-direct] csrfPresent=true cookiePresent=true`
   - `[move-direct] success for ID:xxx`

**Error handling**:
- Returns `{ message: "Failed to move JMS messages.", detail: "..." }` on failure
- Authoritative tenant errors (401, 403, etc.) abort immediately
- Connection errors with retry logic automatically fall back to alternate routes

### `POST /jms-messages/retry`

Retries failed messages by changing their status back to "Available" for reprocessing.

Request body:

```json
{
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "sourceQueueName": "ErrorQueue",
  "messages": [
    {
      "jmsMessageId": "JMS-MSG-123",
      "failed": true
    }
  ]
}
```

Response on success:
```json
{
  "message": "Messages retried successfully."
}
```

**How it works**:
1. Frontend collects failed messages to retry
2. Backend fetches current message entity with all metadata
3. Backend sends MERGE request via batch API protocol to update the message
4. Batch operation triggers message reprocessing in the CPI iFlow
5. Server logs show:
   - `[retry-batch] candidate=https://...`
   - `[retry-batch] csrfPresent=true cookiePresent=true`
   - `[retry-batch] boundary=...`
   - `[retry-batch] response status=200`

**Important notes**:
- Message must be in "Failed" state to be eligible for retry
- iFlow configuration must support retry capability
- Retry resets internal counters and triggers reprocessing
- Failed messages continue to consume queue resources until retried or deleted

**Error handling**:
- Checks for "Error during operation retry or queue config change operation"
- Returns descriptive error if queue doesn't support retry operations
- Falls back to direct API MERGE if batch operations fail

### `POST /jms-messages/delete`

Permanently deletes selected messages from the queue.

Request body:

```json
{
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "sourceQueueName": "ErrorQueue",
  "messages": [
    {
      "jmsMessageId": "JMS-MSG-123",
      "failed": true
    }
  ]
}
```

Response on success:
```json
{
  "message": "Messages deleted successfully."
}
```

**How it works**:
1. Frontend collects messages to delete
2. Backend constructs OData entity key: `JmsMessages(Msgid='xxx', Name='queuename', Failed=true)`
3. Backend sends HTTP DELETE request to `/api/v1/JmsMessages(...)`
4. Message is immediately removed from queue
5. Messages cannot be recovered after deletion

**Warning**:
- **This operation is permanent** - deleted messages cannot be recovered
- Consider implementing user confirmation dialog on frontend before deletion
- Messages are deleted immediately without audit trail

**Error handling**:
- Returns `{ message: "Failed to delete JMS messages.", detail: "..." }` on failure
- Authoritative errors abort immediately
- Connection errors retry with alternate URL candidates

### `POST /jms-resource-details`

Fetches detailed information about JMS broker resource (memory, status, etc.).

Request body:

```json
{
  "token": "<tenant-access-token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "brokerKey": "Broker1"
}
```

Response:
```json
{
  "resource": {
    "id": "Broker1",
    "name": "Message Broker",
    "status": "Running",
    "memoryUsage": "512 MB",
    "totalMemory": "1024 MB"
  }
}
```

### Debug Endpoints

- `POST /cpi-data`
- `GET /cpi-data`

These endpoints keep received CPI payloads in memory and are useful only for debugging or temporary testing.

## Database Details

The backend reads monitoring data from:

- Schema: `HACKTHON-POC`
- Table: `CPI_DATA`

Columns used by the app include:

- `MPL_ID`
- `IFLOW_NAME`
- `STATUS`
- `LOG_START`
- `LOG_END`
- `ERROR_INFO`
- `ATTACHMENT_NAME`
- `ATTACHMENT_TIMESTAMP`
- `PAYLOAD_FILE_NAME`
- `PAYLOAD_FILE_TYPE`
- `PAYLOAD_MIME_TYPE`
- `PAYLOAD_ENCODING`
- `PAYLOAD`
- `CREATED_AT`

## Environment Variables

Create a `.env` file in `backend/` with the required values.

### Required for CPI OAuth
- `TOKEN_URL`
- `CLIENT_ID`
- `CLIENT_SECRET`

### Required for Triggering
- `CPI_TRIGGER_ENDPOINT`

The backend can also use these trigger credential variables:

- `TRIGGER_CLIENT_ID`
- `TRIGGER_CLIENT_SECRET`

If they are not provided, it falls back to:

- `IFLOW_CLIENT_ID`
- `IFLOW_CLIENT_SECRET`

If those are also not provided, it falls back to:

- `CLIENT_ID`
- `CLIENT_SECRET`

### Required for SAP HANA
- `HANA_SERVER`
- `HANA_USER`
- `HANA_PASSWORD`

### Required for Email
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

### Optional for Email
- `SMTP_FROM`

### Important Dependency Note

- `backend/server.js` imports `@sap/hana-client`.
- This package is currently used by the app, but it is not listed in `backend/package.json`.
- Add it before doing a clean setup on a new machine or deployment target.

## Local Development

### Prerequisites
- Node.js and npm
- Access to SAP CPI tenant credentials
- Access to SAP HANA
- PowerShell available on the machine

### Backend Setup

```powershell
cd backend
npm install
npm start
```

For development with auto-restart:

```powershell
cd backend
npm install
npm run dev
```

### Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

### Frontend Build

```powershell
cd frontend
npm run build
```

## Deployment Notes

### SAP BTP Deployment
- Frontend and backend are intended to be deployable separately.
- The frontend is currently configured to call `https://backend.cfapps.us10-001.hana.ondemand.com`.
- Backend CORS is currently open to all origins.

### Runtime URL Alignment

For a successful deployment, these values must stay aligned:

- frontend `API_BASE_URL`
- backend allowed CORS origin
- SAP CPI tenant URLs submitted in the UI
- backend environment variables for trigger and HANA access

## Known Operational Behavior

- Artifact discovery uses in-memory caching for 5 minutes.
- Artifact loading retries transient CPI failures with exponential backoff.
- Bulk artifact loading fetches packages in batches.
- `All` artifact loading returns successful package artifacts even if some packages time out or fail.
- Artifact fetch timeout is currently 60 seconds per package request.
- Payload zip generation depends on PowerShell `Compress-Archive`.
- App login is hardcoded and not integrated with enterprise identity.
- `requirements.txt` is only a dependency reference note and is not used to install the Node.js project.

## Suggested Production Improvements

- Add `@sap/hana-client` to `backend/package.json`.
- Replace hardcoded frontend login with SAP IAS, XSUAA, or another real identity provider.
- Move frontend API base URL to an environment-driven configuration model.
- Restrict backend CORS to the actual frontend origin instead of allowing all origins.
- Add backend request validation for all payloads.
- Add structured logging and error monitoring.
- Add tests for backend endpoints and frontend flows.
- Consider streaming or chunking for very large payload exports.
- Replace in-memory debug storage with persistent or disabled-by-default diagnostics.

## Changes Recommended

1. Add `@sap/hana-client` to `backend/package.json`.
   The backend imports it already, but a clean install from `package.json` alone will miss it.

2. Move `frontend/src/config.js` to environment-based configuration.
   The repo is currently manually switched between local and deployed backend URLs.

3. Restrict CORS in the backend.
   `app.use(cors())` is fine for development, but production should allow only the frontend domain.

4. Show partial artifact load warnings in the UI.
   The backend now returns `failedPackages`, but the frontend does not yet show a warning when some packages are skipped.

5. Add automated tests.
   There are currently no backend route tests or frontend behavior tests in the project.

## Quick Test Flow

1. Open the frontend.
2. Log in with `admin/admin123` or `user/user123`.
3. Open the tenant access page.
4. Enter tenant `clientId`, `clientSecret`, `tokenUrl`, and `baseUrl`.
5. Connect the tenant.
6. Navigate to JMS Queues page to test move/retry/delete operations:
   - Select a queue from the list
   - View messages and their statuses
   - Select failed messages to test operations
7. Test MOVE operation:
   - Select messages from failed queue
   - Choose target queue (e.g., RetryQueue)
   - Click Move button
   - Verify messages appear in target queue
8. Test RETRY operation:
   - Select failed messages in a queue
   - Click Retry button
   - Backend logs show success: `[move-direct] success for ID:xxx`
   - Messages should be reprocessed if iFlow is running
9. Test DELETE operation:
   - Select messages to remove
   - Click Delete button
   - **Warning**: This is permanent - messages cannot be recovered
10. Monitor logs:
    - Server logs show `[move-direct] csrfPresent=true cookiePresent=true`
    - On error: `console.warn` shows detailed error information
    - No verbose request/response body logging (cleaned up)

## API Examples

### Connect Tenant

```http
POST /connectTenant
Content-Type: application/json
```

```json
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret",
  "tokenUrl": "https://<tenant>.authentication.<region>.hana.ondemand.com/oauth/token",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

### Get Artifacts

```http
POST /getArtifacts
Content-Type: application/json
```

```json
{
  "packageId": "All",
  "token": "<Bearer token from connectTenant>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

### Trigger CPI

```http
POST /trigger-cpi
Content-Type: application/json
```

```json
{
  "BASE_URL": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "IFLOW_NAME": "IF_SAMPLE",
  "STATUS": "COMPLETED",
  "FROM_DATE": "2026-03-01T00:00:00",
  "TO_DATE": "2026-03-10T23:59:59"
}
```

## Summary

This project provides a practical SAP CPI monitoring workflow with:

- tenant connection
- package and artifact discovery
- CPI trigger execution
- HANA-backed monitoring
- payload download
- Excel export
- email delivery support
