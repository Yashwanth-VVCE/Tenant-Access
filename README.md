# Tenant Access Application

Tenant Access Application is a full-stack SAP CPI monitoring tool with a React frontend and an Express backend. It lets a user sign in, connect to an SAP BTP / SAP CPI tenant with client credentials, browse integration packages and artifacts, trigger an iFlow, and review monitoring data stored in SAP HANA.

## Business Flow

1. User signs in to the web app.
2. User enters tenant client credentials and CPI URLs.
3. Backend validates the tenant connection and fetches CPI packages.
4. User selects package, artifact, status, and time range.
5. Backend triggers the CPI flow.
6. CPI writes monitoring data into HANA.
7. Frontend loads monitoring records from HANA through the backend.
8. User can refresh data, inspect payloads, download payload files, export Excel, or send the Excel by email.

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
6. Open the status page.
7. Select package, artifact, status, and time range.
8. Trigger CPI.
9. Refresh monitoring data.
10. Download payloads or export Excel if needed.

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
