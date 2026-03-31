# Tenant Access Application

React/Vite frontend and Express backend for SAP CPI tenant connectivity, artifact discovery, CPI trigger calls, and HANA DB-backed monitoring with payload download.

## Tech Stack (Detailed)

### Frontend
- React 19 (SPA)
  - Hooks for state and side effects (`useState`, `useEffect`, `useMemo`).
  - Routing with React Router (`/`, `/tenant`, `/status`, `/unauthorized`).
- Vite (dev server and build).
- MUI (Material UI)
  - Theme, layout, forms, tables, dialogs, buttons.
  - Icons via `@mui/icons-material`.
- Browser APIs
  - `fetch` for backend requests.
  - `localStorage` for token/base URL/packages.
  - `Blob` for downloads.

### Backend
- Node.js + Express
  - JSON and text body parsing.
  - CORS enabled for dev.
- Axios
  - CPI API and OAuth requests.
- SAP HANA client (`@sap/hana-client`)
  - Reads `HACKTHON-POC.CPI_DATA`.
- Node core
  - `fs/promises`, `os`, `path`, `child_process` for temp files + zip generation.
- PowerShell `Compress-Archive`
  - Builds zip files for payload download.

### External Systems
- SAP CPI (Integration Packages, Artifacts, Message Processing Logs).
- SAP HANA (table `HACKTHON-POC.CPI_DATA`).

## High-Level Workflow

1. User signs in (frontend only, hardcoded users).
2. Tenant credentials submitted to `/connectTenant`.
3. Backend retrieves CPI OAuth token and packages.
4. User selects filters and triggers CPI.
5. CPI writes results into HANA.
6. Frontend loads `/latest-report` and renders monitoring rows.
7. User views payload text or downloads payload files.

## Backend Logic (server.js)

### HANA and Payload Helpers
- `getConnection()`
  - Opens a HANA connection with SSL enabled.
- `getReportRows(conn)`
  - Reads latest rows from `HACKTHON-POC.CPI_DATA`.
  - Formats timestamps and maps rows via `mapReportRow`.
- `mapReportRow(row, index)`
  - Converts raw DB row into UI-ready object.
  - Decodes payload, normalizes filename, sets defaults.
- `decodePayload(payload)`
  - Tries base64 decode to UTF-8 text, falls back to raw string.
- `formatFileName(fileName, fileType, fallbackPrefix)`
  - Ensures filename has extension.
- `sanitizeFileName(value, fallback)`
  - Removes invalid filesystem characters.

### Zip Creation
- `createReportsZip(reports)`
  - Writes each decoded payload to temp folder.
  - Ensures unique filenames by suffixing.
  - Uses PowerShell `Compress-Archive`.
  - Cleans temp files on completion.

### CPI and Tenant Helpers
- `cleanUrl(url)`
  - Trims input and removes trailing slashes.
- `buildBaseUrlCandidates(baseUrl)`
  - Builds CPI API base candidates (cfapps vs runtime).
- `tenantHeaders(token)`
  - Standard CPI headers with bearer token.
- `wait(ms)`
  - Backoff helper for retry.
- `fetchPackages(baseUrl, token)`
  - Calls CPI IntegrationPackages and returns packages + working base URL.
- `fetchArtifactsForPackage(baseUrl, token, packageId)`
  - Calls CPI IntegrationDesigntimeArtifacts with retry/backoff.
- `fetchArtifactsForPackagesInBatches(baseUrl, token, packages)`
  - Loads artifacts in limited parallel batches.
- `getArtifactCacheEntry(cacheKey)`
  - Returns cached artifacts when valid, clears expired entries.
- `getTriggerCredentials()`
  - Chooses trigger creds from env (override or default).
- `getAccessToken()`
  - Gets OAuth token using `TOKEN_URL`.

## Backend Endpoints (App)

### Tenant Connection
- `POST /connectTenant`
  - Input: `clientId`, `clientSecret`, `tokenUrl`, `baseUrl`
  - Output: `token`, `packages`, `baseUrl`
  - Flow:
    1. Clean URLs
    2. Request OAuth token
    3. Fetch packages and resolve API base URL
    4. Return token + package list

### Artifact Discovery
- `POST /getArtifacts`
  - Input: `packageId`, `token`, `baseUrl`
  - Output: `artifacts`, `packages`, `baseUrl`
  - Flow:
    1. Fetch packages to validate base URL
    2. Check cache
    3. If All, fetch missing packages in batches
    4. Cache and return

### CPI Logs
- `POST /getMessages`
  - Input: `token`, `baseUrl`, `status`, `artifactName`, `fromDate`, `toDate`
  - Output: filtered CPI message logs
  - Flow:
    1. Build CPI query with status filter/order
    2. Request message logs
    3. Filter by artifact name and time range

### CPI Trigger
- `POST /trigger-cpi`
  - Input: arbitrary JSON
  - Output: CPI response text
  - Flow:
    1. Resolve trigger credentials
    2. POST to CPI endpoint using Basic auth
    3. Return CPI response

### CPI Trigger (Selection Payload)
- `POST /post-selection`
  - Input: `iflowName`, `status`, `fromDate`, `toDate`
  - Output: CPI response JSON
  - Flow:
    1. Fetch OAuth token
    2. POST selection payload to CPI with Bearer token

### HANA Monitoring
- `GET /latest-report`
  - Output: Monitoring Overview rows.
- `GET /download-reports-zip`
  - Output: zip of all payload files.

### Debug Endpoint
- `POST /cpi-data` and `GET /cpi-data`
  - In-memory capture of CPI payloads for inspection.

## Frontend Logic (Key Components)

### Home
- Entry screen and login modal trigger.

### LoginModal
- Validates hardcoded users.
- Saves user and navigates to `/tenant`.

### TenantAccess
- Calls `/connectTenant`.
- Stores `token`, `baseUrl`, `packages` in `localStorage`.
- Navigates to `/status` on success.

### StatusOverview
- `loadArtifacts()`
  - Calls `/getArtifacts` based on selected package.
  - Lazy-loads All only when needed.
- `triggerIflow()`
  - Builds payload from filters and calls `/trigger-cpi`.
  - Fetches HANA rows after trigger.
- `loadReports()`
  - Calls `/latest-report` to fill table.
- `downloadPayload(row)`
  - Downloads a single payload file from decoded text.
- `downloadAllPayloads()`
  - Downloads zip via `/download-reports-zip`.

## Environment Variables

Backend `.env`:
- `TOKEN_URL`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `CPI_TRIGGER_ENDPOINT`
- `HANA_SERVER`
- `HANA_USER`
- `HANA_PASSWORD`

Optional:
- `TRIGGER_CLIENT_ID`
- `TRIGGER_CLIENT_SECRET`

## Local Development

Backend:
1. `cd backend`
2. `npm install`
3. `npm start`

Frontend:
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Default login users:
- `admin / admin123`
- `user / user123`

## Postman Testing Guide

Replace placeholders like `{BASE_URL}` or `{TOKEN}` with real values.

### Common Headers

Backend endpoints:
- `Content-Type: application/json`

SAP CPI endpoints:
- `Authorization: Bearer {ACCESS_TOKEN}`
- `Accept: application/json`

### Step 1: Get CPI OAuth Token (Direct SAP CPI)

**POST** `{TOKEN_URL}`  
Example: `https://<tenant>.authentication.<region>.hana.ondemand.com/oauth/token`

Headers:
- `Content-Type: application/x-www-form-urlencoded`
- `Authorization: Basic {base64(clientId:clientSecret)}`

Body (x-www-form-urlencoded):
- `grant_type=client_credentials`

Response:
- `access_token`

### App Backend Endpoints (localhost:5000)

**POST** `http://localhost:5000/connectTenant`

Body:
```
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret",
  "tokenUrl": "https://<tenant>.authentication.<region>.hana.ondemand.com/oauth/token",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

**POST** `http://localhost:5000/getArtifacts`

Body:
```
{
  "packageId": "All",
  "token": "<Bearer token from connectTenant>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

**POST** `http://localhost:5000/getMessages`

Body:
```
{
  "token": "<Bearer token>",
  "baseUrl": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com",
  "status": "COMPLETED",
  "artifactName": "IFLOW_NAME_OR_All",
  "fromDate": "2026-03-01T00:00:00",
  "toDate": "2026-03-10T23:59:59"
}
```

**POST** `http://localhost:5000/trigger-cpi`

Body:
```
{
  "IFLOW_NAME": "IF_SAMPLE",
  "STATUS": "COMPLETED",
  "FROM_DATE": "2026-03-01",
  "TO_DATE": "2026-03-10",
  "BASE_URL": "https://<tenant>.it-cpi001.cfapps.<region>.hana.ondemand.com"
}
```

**POST** `http://localhost:5000/post-selection`

Body:
```
{
  "iflowName": "IF_SAMPLE",
  "status": "COMPLETED",
  "fromDate": "2026-03-01T00:00:00",
  "toDate": "2026-03-10T23:59:59"
}
```

**GET** `http://localhost:5000/latest-report`  
**GET** `http://localhost:5000/download-reports-zip`  
**POST** `http://localhost:5000/cpi-data`  
**GET** `http://localhost:5000/cpi-data`

### Direct SAP CPI APIs (Postman)

Use `Authorization: Bearer {ACCESS_TOKEN}` from the OAuth call.

**GET Integration Packages**  
`{BASE_URL}/api/v1/IntegrationPackages`

**GET Artifacts for a Package**  
`{BASE_URL}/api/v1/IntegrationPackages('{PACKAGE_ID}')/IntegrationDesigntimeArtifacts`

**GET Message Processing Logs**  
`{BASE_URL}/api/v1/MessageProcessingLogs?$orderby=LogStart desc&$top=200`

Filter by status:
`{BASE_URL}/api/v1/MessageProcessingLogs?$filter=Status eq 'COMPLETED'&$orderby=LogStart desc&$top=200`

**GET Package Details**  
`{BASE_URL}/api/v1/IntegrationPackages('{PACKAGE_ID}')`

**GET Artifact Details**  
`{BASE_URL}/api/v1/IntegrationDesigntimeArtifacts('{ARTIFACT_ID}')`

## Notes

- `BASE_URL` is the CPI API host (cfapps or runtime).
- `TOKEN_URL` is the OAuth endpoint under the authentication domain.
- All CPI API calls require a valid Bearer token.
