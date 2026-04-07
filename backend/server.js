require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const app = express();
const hana = require("@sap/hana-client");
app.use(cors());
app.use(express.json({ limit: '10mb' })); 
app.use(express.text({ type: "text/*" }));

const TOKEN_URL = process.env.TOKEN_URL;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const TRIGGER_CLIENT_ID =
    process.env.TRIGGER_CLIENT_ID ||
    process.env.IFLOW_CLIENT_ID ||
    CLIENT_ID;
const TRIGGER_CLIENT_SECRET =
    process.env.TRIGGER_CLIENT_SECRET ||
    process.env.IFLOW_CLIENT_SECRET ||
    CLIENT_SECRET;
const CPI_TRIGGER_ENDPOINT =
    process.env.CPI_TRIGGER_ENDPOINT ||
    "https://inccpidev.it-cpi001-rt.cfapps.eu10.hana.ondemand.com/http/Trigger";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const missingEnv = ["TOKEN_URL", "CLIENT_ID", "CLIENT_SECRET"].filter(
  (key) => !process.env[key]
);
if (missingEnv.length > 0) {
  console.warn(
    "Warning: missing .env variables:",
    missingEnv.join(", "),
    "– some CPI features may not work"
  );
}

function getConnection() {
  const conn = hana.createConnection();

  conn.connect({
    serverNode: process.env.HANA_SERVER,
    uid: process.env.HANA_USER,
    pwd: process.env.HANA_PASSWORD,
    encrypt: true,
    sslValidateCertificate: false
  });

  return conn;
}

const formatFileName = (fileName, fileType, fallbackPrefix = "payload") => {
  const trimmedName = (fileName || "").trim();
  const trimmedType = (fileType || "").trim().replace(/^\./, "");

  if (trimmedName) {
    if (!trimmedType || trimmedName.toLowerCase().endsWith(`.${trimmedType.toLowerCase()}`)) {
      return trimmedName;
    }
    return `${trimmedName}.${trimmedType}`;
  }

  if (trimmedType) {
    return `${fallbackPrefix}.${trimmedType}`;
  }

  return `${fallbackPrefix}.txt`;
};

const decodePayload = (payload) => {
  const rawPayload = typeof payload === "string" ? payload.trim() : "";

  if (!rawPayload) {
    return "";
  }

  try {
    return Buffer.from(rawPayload, "base64").toString("utf-8");
  } catch {
    return rawPayload;
  }
};

const mapReportRow = (row, index) => {
  const decodedPayload = decodePayload(row.PAYLOAD);
  const attachmentBase = (row.ATTACHMENT_NAME || row.PAYLOAD_FILE_NAME || "").trim();
  const attachmentStamp = row.ATTACHMENT_TIMESTAMP
    ? String(row.ATTACHMENT_TIMESTAMP).replace(/[^\dA-Za-z]+/g, "_")
    : "";
  const baseName = [
    attachmentBase || (row.MPL_ID ? `payload-${row.MPL_ID}` : `payload-${index + 1}`),
    attachmentStamp
  ]
    .filter(Boolean)
    .join("_");
  const fileName = formatFileName(
    baseName,
    row.PAYLOAD_FILE_TYPE,
    row.MPL_ID ? `payload-${row.MPL_ID}` : `payload-${index + 1}`
  );

  return {
    id: `${row.MPL_ID || "MPL"}-${row.LOG_START || index}-${index}`,
    mplId: row.MPL_ID || "",
    iflowName: row.IFLOW_NAME || "",
    status: row.STATUS || "",
    logStart: row.LOG_START || "",
    logEnd: row.LOG_END || "",
    errorInfo: row.ERROR_INFO || "-",
    attachmentName: row.ATTACHMENT_NAME || "-",
    attachmentTimestamp: row.ATTACHMENT_TIMESTAMP || "",
    payloadFileName: fileName,
    payloadFileType: row.PAYLOAD_FILE_TYPE || "txt",
    payloadMimeType: row.PAYLOAD_MIME_TYPE || "text/plain",
    payloadEncoding: row.PAYLOAD_ENCODING || "UTF-8",
    decodedPayload
  };
};

const sanitizeFileName = (value, fallback = "payload") => {
  const normalized = (value || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return normalized || fallback;
};

const getReportRows = (conn) => {
  const sql = `
    SELECT
      "MPL_ID",
      "IFLOW_NAME",
      "STATUS",
      TO_VARCHAR("LOG_START", 'YYYY-MM-DD HH24:MI:SS') AS "LOG_START",
      TO_VARCHAR("LOG_END", 'YYYY-MM-DD HH24:MI:SS') AS "LOG_END",
      "ERROR_INFO",
      "ATTACHMENT_NAME",
      TO_VARCHAR("ATTACHMENT_TIMESTAMP", 'YYYY-MM-DD HH24:MI:SS') AS "ATTACHMENT_TIMESTAMP",
      "PAYLOAD_FILE_NAME",
      "PAYLOAD_FILE_TYPE",
      "PAYLOAD_MIME_TYPE",
      "PAYLOAD_ENCODING",
      "PAYLOAD"
    FROM "HACKTHON-POC"."CPI_DATA"
    ORDER BY "CREATED_AT" DESC
  `;

  const rows = conn.exec(sql);
  return rows.map((row, index) => mapReportRow(row, index));
};

const getPayloadRow = (conn, mplId, logStart, attachmentTimestamp) => {
  const sql = `
    SELECT
      "MPL_ID",
      "LOG_START",
      "ATTACHMENT_TIMESTAMP",
      "PAYLOAD_FILE_NAME",
      "PAYLOAD_FILE_TYPE",
      "PAYLOAD_MIME_TYPE",
      "PAYLOAD_ENCODING",
      "PAYLOAD"
    FROM "HACKTHON-POC"."CPI_DATA"
    WHERE "MPL_ID" = ?
      AND TO_VARCHAR("LOG_START", 'YYYY-MM-DD HH24:MI:SS') = ?
      AND TO_VARCHAR("ATTACHMENT_TIMESTAMP", 'YYYY-MM-DD HH24:MI:SS') = ?
    ORDER BY "CREATED_AT" DESC
  `;

  const stmt = conn.prepare(sql);
  const rows = stmt.exec([mplId, logStart, attachmentTimestamp]);
  return rows[0];
};

const createReportsExcelBuffer = async (reports) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monitoring Overview", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "MPL ID", key: "mplId", width: 34 },
    { header: "IFLOW NAME", key: "iflowName", width: 32 },
    { header: "STATUS", key: "status", width: 16 },
    { header: "LOG START", key: "logStart", width: 22 },
    { header: "LOG END", key: "logEnd", width: 22 },
    { header: "ERROR INFO", key: "errorInfo", width: 30 },
    { header: "ATTACHMENT NAME", key: "attachmentName", width: 26 },
    { header: "ATTACHMENT TIMESTAMP", key: "attachmentTimestamp", width: 24 },
    { header: "PAYLOAD", key: "payload", width: 120 }
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).alignment = { vertical: "middle" };

  reports.forEach((row) => {
    sheet.addRow({
      mplId: row.mplId || "",
      iflowName: row.iflowName || "",
      status: row.status || "",
      logStart: row.logStart || "",
      logEnd: row.logEnd || "",
      errorInfo: row.errorInfo || "",
      attachmentName: row.attachmentName || "",
      attachmentTimestamp: row.attachmentTimestamp || "",
      payload: row.decodedPayload || ""
    });
  });

  return workbook.xlsx.writeBuffer();
};

const execFileAsync = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error);
        return;
      }
      resolve(stdout);
    });
  });

const createReportsZip = async (reports) => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "tenant-access-"));
  const payloadDir = path.join(tempRoot, "payloads");
  const zipBaseName = sanitizeFileName(
    `${reports[0]?.iflowName || "iFlow"}_Payload_files`,
    "iFlow_Payload_files"
  );
  const zipPath = path.join(tempRoot, `${zipBaseName}.zip`);

  try {
    await fs.mkdir(payloadDir, { recursive: true });
    const usedFileNames = new Set();

    await Promise.all(
      reports.map((report, index) => {
        const baseName = sanitizeFileName(
          report.payloadFileName,
          `payload-${index + 1}.${report.payloadFileType || "txt"}`
        );

        let uniqueName = baseName;
        let suffix = 1;

        while (usedFileNames.has(uniqueName.toLowerCase())) {
          const extension = path.extname(baseName);
          const fileStem = extension ? baseName.slice(0, -extension.length) : baseName;
          uniqueName = `${fileStem}_${suffix}${extension}`;
          suffix += 1;
        }

        usedFileNames.add(uniqueName.toLowerCase());

        return fs.writeFile(
          path.join(payloadDir, uniqueName),
          report.decodedPayload || "",
          "utf8"
        );
      })
    );

    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${payloadDir}\\*' -DestinationPath '${zipPath}' -Force`
    ]);

    const zipBuffer = await fs.readFile(zipPath);
    return {
      zipBuffer,
      zipFileName: `${zipBaseName}.zip`
    };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
};

const createMailTransport = () => {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP configuration is incomplete");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
};

const cleanUrl = (url) => url?.trim().replace(/\/+$/, "");
const artifactCache = new Map();
const ARTIFACT_CACHE_TTL_MS = 5 * 60 * 1000;
const ARTIFACT_RETRY_LIMIT = 8;
const ARTIFACT_BATCH_CONCURRENCY = 4;

const buildBaseUrlCandidates = (baseUrl) => {
    const cleanedBaseUrl = cleanUrl(baseUrl);

    if (!cleanedBaseUrl) {
        return [];
    }

    const candidates = [cleanedBaseUrl];

    if (cleanedBaseUrl.includes("-rt.cfapps.")) {
        candidates.push(cleanedBaseUrl.replace("-rt.cfapps.", ".cfapps."));
    } else if (cleanedBaseUrl.includes(".cfapps.")) {
        candidates.push(cleanedBaseUrl.replace(".cfapps.", "-rt.cfapps."));
    }

    return [...new Set(candidates)];
};

const tenantHeaders = (token) => ({
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPackages = async (baseUrl, token) => {
    const candidates = buildBaseUrlCandidates(baseUrl);
    let lastError;
    const failedCandidates = [];

    for (const candidate of candidates) {
        try {
            const packageResponse = await axios.get(`${candidate}/api/v1/IntegrationPackages`, {
                headers: tenantHeaders(token),
                timeout: 30000
            });

            return {
                apiBaseUrl: candidate,
                packages: packageResponse.data?.d?.results || []
            };
        } catch (error) {
            lastError = error;
            failedCandidates.push({
                candidate,
                detail: error.response?.data || error.message
            });
        }
    }

    failedCandidates.forEach((entry) => {
        console.warn(`fetchPackages failed for ${entry.candidate}:`, entry.detail);
    });

    throw lastError;
};

const fetchArtifactsForPackage = async (baseUrl, token, packageId) => {
    const candidates = buildBaseUrlCandidates(baseUrl);
    const encodedPackageId = encodeURIComponent(packageId);

    for (const candidate of candidates) {
        for (let attempt = 1; attempt <= ARTIFACT_RETRY_LIMIT; attempt += 1) {
            try {

               
                const artifactResponse = await axios.get(
                    `${candidate}/api/v1/IntegrationPackages('${encodedPackageId}')/IntegrationDesigntimeArtifacts`,
                    {
                        headers: tenantHeaders(token),
                        timeout: 30000
                    }
                );

                return artifactResponse.data?.d?.results || [];
            } catch (error) {
                const statusCode = error.response?.status;
                const retriable = statusCode === 429 || error.code === "ECONNRESET";

                if (statusCode === 404) {
                    break;
                }

                if (!retriable) {
                    console.warn(
                        `fetchArtifacts failed for package ${packageId} on ${candidate}:`,
                        error.response?.data || error.message
                    );
                    throw error;
                }

                const retryAfterSeconds = Number(error.response?.headers?.["retry-after"] || 0);
                const backoffMs =
                    retryAfterSeconds > 0
                        ? retryAfterSeconds * 1000
                        : Math.min(1000 * 2 ** (attempt - 1), 10000);

                console.warn(
                    `Retrying artifacts for package ${packageId} on ${candidate}. Attempt ${attempt}/${ARTIFACT_RETRY_LIMIT}.`,
                    error.response?.data || error.message
                );

                await wait(backoffMs);
            }
        }
    }

    throw new Error(`Failed to fetch artifacts for package ${packageId} after retries.`);
};

const fetchArtifactsForPackagesInBatches = async (baseUrl, token, packages) => {
    const results = [];

    for (let index = 0; index < packages.length; index += ARTIFACT_BATCH_CONCURRENCY) {
        const batch = packages.slice(index, index + ARTIFACT_BATCH_CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(async (pkg) => ({
                packageId: pkg.Id,
                artifacts: await fetchArtifactsForPackage(baseUrl, token, pkg.Id)
            }))
        );

        results.push(...batchResults);
    }

    return results;
};

const getArtifactCacheEntry = (cacheKey) => {
    const cachedArtifacts = artifactCache.get(cacheKey);

    if (!cachedArtifacts || cachedArtifacts.expiresAt <= Date.now()) {
        if (cachedArtifacts) {
            artifactCache.delete(cacheKey);
        }

        return null;
    }

    return cachedArtifacts;
};

const getTriggerCredentials = () => {
    if (TRIGGER_CLIENT_ID && TRIGGER_CLIENT_SECRET) {
        return {
            clientId: TRIGGER_CLIENT_ID,
            clientSecret: TRIGGER_CLIENT_SECRET,
            source: "trigger-env"
        };
    }

    return null;
};

app.post("/connectTenant", async (req, res) => {
    let { clientId, clientSecret, tokenUrl, baseUrl } = req.body;

    tokenUrl = cleanUrl(tokenUrl);
    baseUrl  = cleanUrl(baseUrl);

    if (!tokenUrl || !baseUrl) {
        return res.status(400).json({ message: "tokenUrl and baseUrl are required." });
    }

    try {
        const tokenEndpoint = tokenUrl.endsWith("/oauth/token")
            ? tokenUrl
            : `${tokenUrl}/oauth/token`;

        const tokenResponse = await axios.post(
            tokenEndpoint,
            "grant_type=client_credentials",
            {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                auth: { username: clientId, password: clientSecret }
            }
        );

        const token = tokenResponse.data.access_token;

        const { apiBaseUrl, packages } = await fetchPackages(baseUrl, token);

        res.json({
            message: "Tenant Connected Successfully",
            packages,
            token: token,
            credentialSource: "tenant-session",
            baseUrl: apiBaseUrl
        });

    } catch (error) {
        console.error("connectTenant error:", error.response?.data || error.message);
        const status = error.response?.status;
        const message = status === 401
            ? "Tenant Connection Failed: invalid client credentials or token URL."
            : "Tenant Connection Failed";
        res.status(500).json({
            message,
            detail: error.response?.data || error.message
        });
    }
});

app.post("/getArtifacts", async (req, res) => {
    let { packageId, token, baseUrl } = req.body;
    baseUrl = cleanUrl(baseUrl);

    try {
        let artifacts = [];
        const { apiBaseUrl, packages } = await fetchPackages(baseUrl, token);
        const cacheKey = `${apiBaseUrl}::${packageId || "All"}`;
        const cachedArtifacts = getArtifactCacheEntry(cacheKey);

        if (cachedArtifacts) {
            return res.json({
                artifacts: cachedArtifacts.artifacts,
                packages,
                baseUrl: apiBaseUrl,
                cached: true
            });
        }

        if (!packageId || packageId === "All") {
            const cachedPackageArtifacts = [];
            const missingPackages = [];

            packages.forEach((pkg) => {
                const packageCacheKey = `${apiBaseUrl}::${pkg.Id}`;
                const cachedPackage = getArtifactCacheEntry(packageCacheKey);

                if (cachedPackage) {
                    cachedPackageArtifacts.push(cachedPackage.artifacts);
                } else {
                    missingPackages.push(pkg);
                }
            });

            const fetchedPackageResults = missingPackages.length
                ? await fetchArtifactsForPackagesInBatches(apiBaseUrl, token, missingPackages)
                : [];

            fetchedPackageResults.forEach(({ packageId: fetchedPackageId, artifacts: fetchedArtifacts }) => {
                artifactCache.set(`${apiBaseUrl}::${fetchedPackageId}`, {
                    artifacts: fetchedArtifacts,
                    expiresAt: Date.now() + ARTIFACT_CACHE_TTL_MS
                });
            });

            artifacts = [
                ...cachedPackageArtifacts.flat(),
                ...fetchedPackageResults.flatMap(({ artifacts: fetchedArtifacts }) => fetchedArtifacts)
            ];
        } else {
            artifacts = await fetchArtifactsForPackage(apiBaseUrl, token, packageId);
            artifactCache.set(`${apiBaseUrl}::${packageId}`, {
                artifacts,
                expiresAt: Date.now() + ARTIFACT_CACHE_TTL_MS
            });
        }

        artifactCache.set(cacheKey, {
            artifacts,
            expiresAt: Date.now() + ARTIFACT_CACHE_TTL_MS
        });

        res.json({ artifacts, packages, baseUrl: apiBaseUrl });

    } catch (error) {
        console.error("getArtifacts error:", error.response?.data || error.message);
        res.status(500).json({ message: "Failed to fetch artifacts" });
    }
});

const parseSapDate = (sapDate) => {
    if (!sapDate) return null;
    const match = sapDate.match(/\/Date\((\d+)\)\//);
    return match ? parseInt(match[1]) : null;
};

app.post("/getMessages", async (req, res) => {
    let { token, baseUrl, status, artifactName, fromDate, toDate } = req.body;
    baseUrl = cleanUrl(baseUrl);

    try {
        const params = new URLSearchParams();

        if (status && status !== "All") {
            params.append("$filter", `Status eq '${status}'`);
        }

        params.append("$orderby", "LogStart desc");
        params.append("$top", "200");

        const url = `${baseUrl}/api/v1/MessageProcessingLogs?${params.toString()}`;

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });

        let messages = response.data.d.results;
        if (artifactName && artifactName !== "All") {
            messages = messages.filter(msg => msg.IntegrationFlowName === artifactName);
        }
        if (fromDate && toDate) {
            const fromMs = new Date(fromDate).getTime();
            const toMs   = new Date(toDate).getTime();

            messages = messages.filter(msg => {
                const logMs = parseSapDate(msg.LogStart);
                if (logMs === null) return false;
                return logMs >= fromMs && logMs <= toMs;
            });
        }

        res.json({ messages });

    } catch (error) {
        console.error("getMessages error:", error.response?.data || error.message);
        res.status(500).json({
            message: "Failed to fetch messages",
            detail: error.response?.data || error.message
        });
    }
});


async function getAccessToken() {
    if (!TOKEN_URL || !CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("OAuth configuration is incomplete");
    }
    const tokenResponse = await axios.post(
        TOKEN_URL,
        "grant_type=client_credentials",
        {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            auth: { username: CLIENT_ID, password: CLIENT_SECRET }
        }
    );
    return tokenResponse.data.access_token;
}

let cpiMessages = [];

app.post("/cpi-data", (req, res) => {
    const payload = req.body;
    const message = {
        timestamp: new Date().toISOString(),
        content: payload
    };
    cpiMessages.push(message);
    console.log("\nCPI DATA RECEIVED");
    console.log(payload);
    res.status(200).send("CPI data received");
});

app.get("/cpi-data", (req, res) => {
    if (cpiMessages.length === 0) {
        return res.send("No CPI data received yet.");
    }
    const formattedData = cpiMessages
        .map(
            (msg) =>
                `Timestamp: ${msg.timestamp}\n${msg.content}`
        )
        .join("\n\n----------------------------------\n\n");
    res.setHeader("Content-Type", "text/plain");
    res.send(formattedData);
});

app.post("/trigger-cpi", async (req, res) => {
    if (!CPI_TRIGGER_ENDPOINT) {
        return res.status(500).json({ message: "CPI trigger endpoint not configured." });
    }
    try {
        const credentials = getTriggerCredentials();

        if (!credentials) {
            return res.status(500).json({ message: "CPI client credentials not configured." });
        }

        const response = await axios.post(CPI_TRIGGER_ENDPOINT, req.body, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`,
                "Content-Type": "application/json"
            },
            timeout: 120000,
            validateStatus: () => true
        });

        const payload = typeof response.data === "string"?response.data:JSON.stringify(response.data, null, 2);

        console.log("trigger-cpi status:", response.status);
        console.log("trigger-cpi payload:", req.body);
        return res.status(response.status).send(payload);
    } catch (err) {
        console.error("trigger-cpi error:", err.response?.data || err.message);
        const errorPayload = typeof err.response?.data==="string"?err.response.data:JSON.stringify(err.response?.data || err.message, null, 2);
        res.setHeader("Content-Type", "text/plain");
        return res.status(500).send(errorPayload);
    }
});

app.post("/post-selection", async (req, res) => {
    const { iflowName, status, fromDate, toDate } = req.body;

    if (!iflowName || !status || !fromDate || !toDate) {
        return res.status(400).json({
            message: "iflowName, status, fromDate, and toDate are required."
        });
    }
    if (!CPI_TRIGGER_ENDPOINT) {
        return res.status(500).json({ message: "CPI trigger endpoint not configured." });
    }
    try {
        const accessToken = await getAccessToken();
        const payload = {
            iflowName,
            status,
            fromDate,
            toDate
        };
        const response = await axios.post(CPI_TRIGGER_ENDPOINT, payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            validateStatus: () => true
        });
        return res.status(response.status).json({
            message: "Posted to CPI successfully.",
            payload,
            response: response.data
        });
    } catch (error) {
        console.error("post-selection error:", error.response?.data || error.message);
        return res.status(500).json({
            message: "Failed to post selection to CPI.",
            detail: error.response?.data || error.message
        });
    }
});

app.get("/latest-report", async (req, res) => {
  let conn;
  try {
    conn = getConnection();
    const reports = getReportRows(conn);
    if (!reports.length) {
      return res.json({ reports: [] });
    }
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) conn.disconnect();
  }
});

app.get("/payload-file", async (req, res) => {
  const { mplId, logStart, attachmentTimestamp } = req.query;
  if (!mplId || !logStart || !attachmentTimestamp) {
    return res.status(400).json({ message: "mplId, logStart, attachmentTimestamp are required." });
  }

  let conn;
  try {
    conn = getConnection();
    const row = getPayloadRow(conn, mplId, logStart, attachmentTimestamp);
    if (!row) {
      return res.status(404).json({ message: "Payload not found." });
    }

    const decoded = decodePayload(row.PAYLOAD);
    const filename = formatFileName(row.PAYLOAD_FILE_NAME, row.PAYLOAD_FILE_TYPE, `payload-${mplId}`);
    res.setHeader("Content-Type", row.PAYLOAD_MIME_TYPE || "text/plain");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    return res.send(decoded);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load payload.", detail: err.message });
  } finally {
    if (conn) conn.disconnect();
  }
});

app.get("/export-reports-excel", async (req, res) => {
  let conn;
  try {
    conn = getConnection();
    const reports = getReportRows(conn);
    if (!reports.length) {
      return res.status(404).json({ message: "No report data available." });
    }

    const buffer = await createReportsExcelBuffer(reports);
    const fileName = `${reports[0]?.iflowName || "Monitoring_Overview"}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ message: "Failed to export Excel.", detail: err.message });
  } finally {
    if (conn) conn.disconnect();
  }
});

app.post("/send-excel-email", async (req, res) => {
  const { from, to, subject } = req.body || {};

  if (!to) {
    return res.status(400).json({ message: "Recipient address is required." });
  }

  let conn;
  try {
    conn = getConnection();
    const reports = getReportRows(conn);
    if (!reports.length) {
      return res.status(404).json({ message: "No report data available." });
    }

    const buffer = await createReportsExcelBuffer(reports);
    const fileName = `${reports[0]?.iflowName || "Monitoring_Overview"}.xlsx`;
    const mailSubject = subject || `Monitoring Overview of ${reports[0]?.iflowName || "Iflow"}`;

    const transporter = createMailTransport();
    await transporter.sendMail({
      from: from || SMTP_FROM,
      to,
      subject: mailSubject,
      text: "Please find the monitoring overview attached.",
      attachments: [
        {
          filename: fileName,
          content: buffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      ]
    });

    return res.json({ message: "Email sent successfully." });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to send email.",
      detail: err.message
    });
  } finally {
    if (conn) conn.disconnect();
  }
});

app.get("/download-reports-zip", async (req, res) => {
  let conn;
  try {
    conn = getConnection();
    const reports = getReportRows(conn);

    if (!reports.length) {
      return res.status(404).json({ message: "No payload files found to download." });
    }

    const { zipBuffer, zipFileName } = await createReportsZip(reports);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ error: typeof err === "string" ? err : err.message });
  } finally {
    if (conn) conn.disconnect();
  }
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
