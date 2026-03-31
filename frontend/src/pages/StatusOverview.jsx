import React, { useEffect, useMemo, useState } from "react";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Container,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import TopBar from "../components/TopBar";
import { API_BASE_URL } from "../config";

const timeOptions = ["Last Hour", "Last Day", "Last Week", "Last Month", "Custom"];
const statusOptions = [
  "All",
  "COMPLETED",
  "FAILED",
  "PROCESSING",
  "RETRY",
  "ESCALATED",
  "CANCELLED",
  "DISCARDED",
  "ABANDONED"
];

const getMplId = (value) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const match = text.match(/MPL ID[^:]*:\s*([A-Za-z0-9]+)/i);
  return match ? match[1] : "";
};

const toDateTimeInputValue = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 16);
};

const toCpiDateTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
};

const getRangeForTime = (timeRange, customFromDate, customToDate) => {
  const now = new Date();

  switch (timeRange) {
    case "Last Hour":
      return {
        fromDate: toCpiDateTime(new Date(now.getTime() - 60 * 60 * 1000)),
        toDate: toCpiDateTime(now)
      };
    case "Last Day":
      return {
        fromDate: toCpiDateTime(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
        toDate: toCpiDateTime(now)
      };
    case "Last Week":
      return {
        fromDate: toCpiDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
        toDate: toCpiDateTime(now)
      };
    case "Last Month":
      return {
        fromDate: toCpiDateTime(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
        toDate: toCpiDateTime(now)
      };
    default:
      return {
        fromDate: toCpiDateTime(customFromDate),
        toDate: toCpiDateTime(customToDate)
      };
  }
};

const StatusOverview = () => {
  const token = localStorage.getItem("token");
  const baseUrl = localStorage.getItem("baseUrl");
  const [packages, setPackages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("packages") || "[]");
    } catch {
      return [];
    }
  });
  const [selectedPackage, setSelectedPackage] = useState("All");
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState("All");
  const [status, setStatus] = useState("All");
  const [timeRange, setTimeRange] = useState("Last Day");
  const [fromDate, setFromDate] = useState(() =>
    toDateTimeInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000))
  );
  const [toDate, setToDate] = useState(() => toDateTimeInputValue(new Date()));
  const [loading, setLoading] = useState(false);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [downloadAllLoading, setDownloadAllLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [reports, setReports] = useState([]);
  const [selectedPayloadRow, setSelectedPayloadRow] = useState(null);
  const [resolvedBaseUrl, setResolvedBaseUrl] = useState(baseUrl || "");
  const [hasTriggeredFetch, setHasTriggeredFetch] = useState(false);
  const [artifactMenuOpened, setArtifactMenuOpened] = useState(false);

  const loadReports = async () => {
    setReportsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/latest-report`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load reports.");
      }

      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (reportError) {
      console.error("failed to load reports", reportError);
      setFeedback("Failed to load data.");
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    async function loadArtifacts() {
      if (!token || !baseUrl) {
        setArtifacts([]);
        setArtifactsLoading(false);
        return;
      }

      const shouldLoadArtifacts =
        (selectedPackage && selectedPackage !== "All") || artifactMenuOpened;

      if (!shouldLoadArtifacts) {
        setArtifacts([]);
        setSelectedArtifact("All");
        setArtifactsLoading(false);
        return;
      }

      setArtifactsLoading(true);
      setError("");

      try {
        const resp = await fetch(`${API_BASE_URL}/getArtifacts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId:
              selectedPackage && selectedPackage !== "All"
                ? selectedPackage.Id
                : "All",
            token,
            baseUrl
          })
        });
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data.message || data.detail || "Failed to load artifacts.");
        }

        const nextArtifacts = Array.from(
          new Map((data.artifacts || []).map((artifact) => [artifact.Name, artifact])).values()
        );
        setArtifacts(nextArtifacts);
        setSelectedArtifact((currentArtifact) =>
          currentArtifact === "All" || nextArtifacts.some((artifact) => artifact.Name === currentArtifact)
            ? currentArtifact
            : "All"
        );
        if (Array.isArray(data.packages)) {
          setPackages(data.packages);
          localStorage.setItem("packages", JSON.stringify(data.packages));
        }
        if (data.baseUrl) {
          localStorage.setItem("baseUrl", data.baseUrl);
          setResolvedBaseUrl(data.baseUrl);
        }
      } catch (loadError) {
        console.error("failed to load artifacts", loadError);
        setError("Failed to load artifacts.");
      } finally {
        setArtifactsLoading(false);
      }
    }

    loadArtifacts();
  }, [token, baseUrl, selectedPackage, artifactMenuOpened]);

  const packageOptions = useMemo(() => {
    const uniquePackages = Array.from(
      new Map(
        packages.map((pkg) => [pkg.Id || `${pkg.Name || "Unnamed Package"}-${pkg.Version || ""}`, pkg])
      ).values()
    );

    return [
      "All",
      ...uniquePackages
        .slice()
        .sort((left, right) =>
          (left.Name || left.Id || "").localeCompare(right.Name || right.Id || "")
        )
    ];
  }, [packages]);

  const artifactOptions = useMemo(
    () => ["All", ...artifacts.map((artifact) => artifact.Name).sort((left, right) => left.localeCompare(right))],
    [artifacts]
  );

  const triggerIflow = async () => {
    setError("");
    setFeedback("");
    setReports([]);
    setSelectedPayloadRow(null);
    setHasTriggeredFetch(false);

    const range = getRangeForTime(timeRange, fromDate, toDate);

    if (timeRange === "Custom" && (!range.fromDate || !range.toDate)) {
      setError("Select from and to date.");
      return;
    }

    if (timeRange === "Custom" && new Date(fromDate) > new Date(toDate)) {
      setError("'From' date cannot be after 'To' date.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        BASE_URL: resolvedBaseUrl || baseUrl || "",
        IFLOW_NAME: selectedArtifact,
        STATUS: status,
        FROM_DATE: range.fromDate,
        TO_DATE: range.toDate
      };

      const response = await fetch(`${API_BASE_URL}/trigger-cpi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let responseBody;
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      setFeedback("Triggered. Fetching latest data...");
      setHasTriggeredFetch(true);
      setTimeout(() => {
        loadReports();
      }, 2000);

      const mplId = getMplId(responseBody?.response || responseBody);
      setFeedback(
        response.ok
          ? "Triggered."
          : mplId
            ? `Trigger failed. MPL ID: ${mplId}`
            : "Trigger failed."
      );
    } catch (requestError) {
      console.error("failed to trigger CPI:", requestError);
      setFeedback("Trigger failed.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPayload = (row) => {
    const blob = new Blob([row.decodedPayload || ""], {
      type: row.payloadMimeType || "text/plain"
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = row.payloadFileName || "payload.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  };

  const downloadAllPayloads = async () => {
    setDownloadAllLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/download-reports-zip`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to download zip file.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = reports[0]?.iflowName
        ? `${reports[0].iflowName}_Payload_files.zip`
        : "iFlow_Payload_files.zip";

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      console.error("failed to download payload zip", downloadError);
      setFeedback("Failed to download all payload files.");
    } finally {
      setDownloadAllLoading(false);
    }
  };

  const downloadExcelReport = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/export-reports-excel`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to export Excel.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileName = reports[0]?.iflowName
        ? `${reports[0].iflowName}.xlsx`
        : "Monitoring_Overview.xlsx";
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("excel export failed", error);
      setFeedback("Failed to export Excel.");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", pb: 8 }}>
      <TopBar />
      <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 } }}>
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 2,
              border: "1px solid rgba(15, 23, 42, 0.08)",
              background:
                "linear-gradient(135deg, rgba(29, 78, 216, 0.10), rgba(245, 158, 11, 0.08) 78%, rgba(255,255,255,0.96) 100%)"
            }}
          >
            <Typography variant="h5">Status Overview</Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 2,
              border: "1px solid rgba(15, 23, 42, 0.08)",
              boxShadow: "0 24px 60px rgba(37, 99, 235, 0.08)"
            }}
          >
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Autocomplete
                  fullWidth
                  options={packageOptions}
                  value={selectedPackage}
                  onChange={(_, value) => setSelectedPackage(value || "All")}
                  getOptionLabel={(option) =>
                    typeof option === "string" ? option : option.Name || option.Id || "Unnamed Package"
                  }
                  isOptionEqualToValue={(option, value) =>
                    typeof option === "string" || typeof value === "string"
                      ? option === value
                      : option.Id === value.Id
                  }
                  renderOption={(props, option) => {
                    const { key: _KEY, ...optionProps } = props;
                    const optionKey =
                      typeof option === "string"
                        ? option
                        : option.Id || `${option.Name || "Unnamed Package"}-${option.Version || ""}`;

                    return (
                      <Box component="li" key={optionKey} {...optionProps}>
                        {typeof option === "string"
                          ? option
                          : option.Name || option.Id || "Unnamed Package"}
                      </Box>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Package"
                      helperText="Filter artifacts."
                    />
                  )}
                />
              </Stack>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Autocomplete
                  fullWidth
                  options={artifactOptions}
                  value={selectedArtifact}
                  onChange={(_, value) => setSelectedArtifact(value || "All")}
                  onOpen={() => setArtifactMenuOpened(true)}
                  disabled={artifactsLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Artifact"
                      helperText={
                        selectedPackage === "All" && !artifactMenuOpened
                          ? "Open the list to load all tenant artifacts."
                          : "Filter by artifact name."
                      }
                      slotProps={{
                        ...params.slotProps,
                        input: {
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {artifactsLoading ? (
                                <InputAdornment position="end">
                                  <CircularProgress size={16} />
                                </InputAdornment>
                              ) : null}
                              {params.InputProps.endAdornment}
                            </>
                          )
                        }
                      }}
                    />
                  )}
                />
                <Autocomplete
                  fullWidth
                  options={statusOptions}
                  value={status}
                  onChange={(_, value) => setStatus(value || "All")}
                  renderInput={(params) => <TextField {...params} label="Status" />}
                />
                <Autocomplete
                  fullWidth
                  options={timeOptions}
                  value={timeRange}
                  onChange={(_, value) => setTimeRange(value || "Last Day")}
                  renderInput={(params) => <TextField {...params} label="Time" />}
                />
              </Stack>

              {timeRange === "Custom" && (
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    fullWidth
                    label="From"
                    type="datetime-local"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    fullWidth
                    label="To"
                    type="datetime-local"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
              )}

              {artifactsLoading && (
                <Alert severity="info" icon={<CircularProgress size={18} color="inherit" />}>
                  Loading artifacts...
                </Alert>
              )}

              {error && <Alert severity="error">{error}</Alert>}
              {feedback && <Alert severity={feedback === "Triggered." ? "success" : "warning"}>{feedback}</Alert>}

              {/* {resolvedBaseUrl && (
                <Typography variant="body2" color="text.secondary">
                  Active tenant: {resolvedBaseUrl}
                </Typography>
              )} */}

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<SendRoundedIcon />}
                  onClick={triggerIflow}
                  disabled={loading || artifactsLoading}
                  sx={{ borderRadius: 2, minWidth: 132 }}
                >
                  {loading ? "Sending..." : "Trigger"}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={() => {
                    setSelectedPackage("All");
                    setSelectedArtifact("All");
                    setStatus("All");
                    setTimeRange("Last Day");
                    setFromDate(toDateTimeInputValue(new Date(Date.now() - 24 * 60 * 60 * 1000)));
                    setToDate(toDateTimeInputValue(new Date()));
                    setFeedback("");
                    setError("");
                    setReports([]);
                    setSelectedPayloadRow(null);
                    setHasTriggeredFetch(false);
                  }}
                  sx={{ borderRadius: 2, minWidth: 132 }}
                >
                  Reset
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, md: 2 },
              borderRadius: 1,
              border: "1px solid #cbd5e1",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
              background: "#ffffff"
            }}
          >
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    color: "primary.dark",
                    position: "relative",
                    width: "fit-content",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      bottom: -6,
                      width: "62%",
                      height: 3,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #0b84d6 0%, #4cc3ff 100%)"
                    }
                  }}
                >
                  Monitoring Overview
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshRoundedIcon />}
                    onClick={loadReports}
                    disabled={reportsLoading || !hasTriggeredFetch}
                    sx={{ borderRadius: 2, alignSelf: "flex-start" }}
                  >
                    {reportsLoading ? "Loading..." : "Refresh table"}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={downloadExcelReport}
                    disabled={!hasTriggeredFetch || reportsLoading || reports.length === 0}
                    sx={{ borderRadius: 2, alignSelf: "flex-start" }}
                  >
                    Convert to Excel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={downloadAllPayloads}
                    disabled={!hasTriggeredFetch || reportsLoading || downloadAllLoading || reports.length === 0}
                    sx={{ borderRadius: 2, alignSelf: "flex-start" }}
                  >
                    {downloadAllLoading ? "Downloading..." : "Download all"}
                  </Button>
                </Stack>
              </Stack>

              <TableContainer
                sx={{
                  borderRadius: 0.5,
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  overflow: "auto"
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        MPL ID
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        IFLOW NAME
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        STATUS
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        LOG START
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        LOG END
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        ERROR INFO
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        ATTACHMENT NAME
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          borderRight: "1px solid #cbd5e1"
                        }}
                      >
                        ATTACHMENT TIMESTAMP
                      </TableCell>
                      <TableCell
                        sx={{
                          bgcolor: "#e2e8f0",
                          color: "#0f172a",
                          fontWeight: 800,
                          
                        }}
                      >
                        PAYLOAD
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reportsLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          <CircularProgress size={22} />
                        </TableCell>
                      </TableRow>
                    ) : reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center">
                          {hasTriggeredFetch
                            ? "No MLP ID records fetched."
                            : "Trigger the iFlow first to fetch data."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      reports.map((row, index) => (
                        <TableRow
                          key={row.id}
                          hover
                          sx={{
                            bgcolor: index % 2 === 0 ? "#ffffff" : "#f8fafc",
                            "& td": {
                              borderBottom: "1px solid #e2e8f0",
                              borderRight: "1px solid #e2e8f0",
                              py: 1.1,
                              verticalAlign: "top"
                            },
                            "&:hover": {
                              bgcolor: "#eff6ff"
                            }
                          }}
                        >
                          <TableCell>{row.mplId || "-"}</TableCell>
                          <TableCell>{row.iflowName || "-"}</TableCell>
                          <TableCell>{row.status || "-"}</TableCell>
                          <TableCell>{row.logStart ? `${row.logStart} IST` : "-"}</TableCell>
                          <TableCell>{row.logEnd ? `${row.logEnd} IST` : "-"}</TableCell>
                          <TableCell>{row.errorInfo || "-"}</TableCell>
                          <TableCell>{row.attachmentName || "-"}</TableCell>
                          <TableCell>{row.attachmentTimestamp ? `${row.attachmentTimestamp} IST` : "-"}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.25} alignItems="center">
                              {/* <Button
                                size="small"
                                variant="text"
                                onClick={() => downloadPayload(row)}
                                sx={{
                                  minWidth: 0,
                                  px: 0.5,
                                  textTransform: "none",
                                  fontWeight: 600,
                                  justifyContent: "flex-start",
                                  maxWidth: 120
                                }}
                              >
                                <Box
                                  component="span"
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    textDecoration: "underline"
                                  }}
                                >
                                  {row.payloadFileName || "-"}
                                </Box>
                              </Button> */}
                              <IconButton
                                size="small"
                                aria-label={`view ${row.payloadFileName}`}
                                onClick={() => setSelectedPayloadRow(row)}
                              >
                                <VisibilityRoundedIcon fontSize="small" />
                              </IconButton>

                              <IconButton
                                size="small"
                                aria-label={`download ${row.payloadFileName}`}
                                onClick={() => downloadPayload(row)}
                              >
                                <DownloadRoundedIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          </Paper>
        </Stack>
      </Container>

      <Dialog
        open={Boolean(selectedPayloadRow)}
        onClose={() => setSelectedPayloadRow(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Payload View</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              File: {selectedPayloadRow?.payloadFileName || "-"}
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                minHeight: 320,
                overflow: "auto",
                borderRadius: 2,
                bgcolor: "rgba(15, 23, 42, 0.04)",
                color: "text.primary",
                fontSize: 13,
                fontFamily: '"Consolas", "Courier New", monospace',
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}
            >
              {selectedPayloadRow?.decodedPayload || "No payload available."}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedPayloadRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StatusOverview;
