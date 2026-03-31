# Tenant Access Application

React/Vite frontend and Express backend for SAP CPI tenant connectivity, artifact discovery, CPI trigger calls, and HANA‑backed monitoring with payload download.

The current version uses the Incture logo color palette, Google Sans typography, includes the logo in the top bar, shows `ATTACHMENT TIMESTAMP` in the Monitoring Overview table, and names payload files using `ATTACHMENT_NAME + ATTACHMENT_TIMESTAMP`. Excel export now embeds payloads on an internal `Payloads` sheet so links work even when the file is shared offline. Payload zip and single‑payload downloads are included.

## Tech Stack

### Frontend
- React 19 with React Router
- Vite
- MUI (Material UI) + MUI Icons
- Browser APIs (`fetch`, `localStorage`, `Blob`, `URL.createObjectURL`)

### Backend
- Node.js + Express
- Axios
- SAP HANA client (`@sap/hana-client`)
- ExcelJS for `.xlsx` export
- Node core (`fs/promises`, `os`, `path`, `child_process`)
- PowerShell `Compress-Archive` for zip creation

### External Systems
- SAP CPI (Integration Packages, Artifacts, Message Processing Logs)
- SAP HANA table `HACKTHON-POC.CPI_DATA`

## Workflow

1. User signs in (frontend only, hardcoded users).
2. Tenant credentials submitted to `/connectTenant`.
3. Backend retrieves CPI OAuth token and package list.
4. User selects filters and triggers CPI.
5. CPI writes results into HANA.
6. Frontend loads `/latest-report` and renders monitoring rows.
7. User views payload text or downloads payload files (single or zip).
8. User can export the Monitoring Overview to `.xlsx`.

## Backend Logic (server.js)

### HANA and Payload Helpers
- `getConnection()` opens a HANA connection with SSL enabled.
- `getReportRows(conn)` reads latest rows from `HACKTHON-POC.CPI_DATA`, formats timestamps, and maps rows.
- `mapReportRow(row, index)` converts DB rows into UI‑ready objects, decodes payloads, normalizes file names, and fills defaults.
- `decodePayload(payload)` attempts base64 decode to UTF‑8.
- `formatFileName(fileName, fileType, fallbackPrefix)` ensures payload file names have extensions.
- `sanitizeFileName(value, fallback)` removes invalid filesystem characters.

### Excel Export
- `createReportsExcelBuffer(reports)` builds an `.xlsx` with two sheets:
  - `Monitoring Overview` for the main table
  - `Payloads` for full payload text
  The payload column in the main sheet links internally to the payload row.

### Zip Creation
- `createReportsZip(reports)` writes each payload to a temp folder, de‑dupes file names, zips them, and cleans up.

### CPI and Tenant Helpers
- `cleanUrl(url)` trims inputs and removes trailing slashes.
- `buildBaseUrlCandidates(baseUrl)` builds CPI API base candidates (cfapps vs runtime).
- `tenantHeaders(token)` returns CPI headers with bearer token.
- `wait(ms)` backoff helper for retries.
- `fetchPackages(baseUrl, token)` retrieves CPI IntegrationPackages and resolves the working base URL.
- `fetchArtifactsForPackage(baseUrl, token, packageId)` fetches artifacts with retry/backoff.
- `fetchArtifactsForPackagesInBatches(baseUrl, token, packages)` fetches artifacts in limited parallel batches.
- `getArtifactCacheEntry(cacheKey)` returns cached artifacts when valid.
- `getTriggerCredentials()` picks CPI trigger credentials from env.
- `getAccessToken()` gets OAuth access token for bearer‑auth calls.

## Backend Endpoints

### Tenant Connection
- `POST /connectTenant`
  Input: `clientId`, `clientSecret`, `tokenUrl`, `baseUrl`  
  Output: `token`, `packages`, `baseUrl`

### Artifact Discovery
- `POST /getArtifacts`
  Input: `packageId`, `token`, `baseUrl`  
  Output: `artifacts`, `packages`, `baseUrl`

### CPI Logs
- `POST /getMessages`
  Input: `token`, `baseUrl`, `status`, `artifactName`, `fromDate`, `toDate`  
  Output: filtered CPI logs

### CPI Trigger
- `POST /trigger-cpi`
  Input: arbitrary JSON  
  Output: CPI response text

### CPI Trigger (Selection Payload)
- `POST /post-selection`
  Input: `iflowName`, `status`, `fromDate`, `toDate`  
  Output: CPI response JSON

### HANA Monitoring
- `GET /latest-report` returns Monitoring Overview rows.
- `GET /download-reports-zip` returns zip of all payload files.
- `GET /export-reports-excel` returns `.xlsx` with internal payload links.
- `GET /payload-file` returns a single payload (used by direct link consumers).

### Debug Endpoints
- `POST /cpi-data` and `GET /cpi-data` store and return raw CPI payloads in memory.

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
- `loadArtifacts()` calls `/getArtifacts` based on selected package and uses lazy‑load for `All`.
- `triggerIflow()` posts filter payload to `/trigger-cpi`, then loads fresh HANA rows.
- `loadReports()` calls `/latest-report`.
- `downloadPayload(row)` downloads a single payload file.
- `downloadAllPayloads()` downloads a zip of all payloads.
- `downloadExcelReport()` downloads `.xlsx` export.

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
**GET** `http://localhost:5000/export-reports-excel`  
**GET** `http://localhost:5000/payload-file?mplId=<id>&logStart=<YYYY-MM-DD HH:MM:SS>&attachmentTimestamp=<YYYY-MM-DD HH:MM:SS>`  
**POST** `http://localhost:5000/cpi-data`  
**GET** `http://localhost:5000/cpi-data`

### Direct SAP CPI APIs (Postman)

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
- `.idea/` is IDE metadata and not required for the app.
