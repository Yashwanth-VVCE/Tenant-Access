import React, { useCallback, useEffect, useMemo, useState } from "react";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Chip,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import TopBar from "../components/TopBar";
import { API_BASE_URL } from "../config";

const messageColumns = [
  { key: "jmsMessageId", label: "JMS Message ID", minWidth: 220, type: "id" },
  { key: "messageId", label: "Message ID", minWidth: 220, type: "id" },
  { key: "status", label: "Status", minWidth: 120, type: "status" },
  { key: "dueAt", label: "Due At", minWidth: 170 },
  { key: "createdAt", label: "Created At", minWidth: 170 },
  { key: "retainUntil", label: "Retain Until", minWidth: 170 },
  { key: "retryCount", label: "Retry Count", minWidth: 120, type: "count" },
  { key: "nextRetryOn", label: "Next Retry On", minWidth: 170 }
];

const getErrorDetail = (data, fallback) => {
  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data?.detail?.message) {
    return data.detail.message;
  }

  if (data?.detail?.error?.message?.value) {
    return data.detail.error.message.value;
  }

  return data?.message || fallback;
};

const renderCellValue = (column, value) => {
  if (!value) {
    return (
      <Typography variant="body2" sx={{ color: "#94a3b8" }}>
        -
      </Typography>
    );
  }

  if (column.type === "status") {
    return (
      <Chip
        label={value}
        size="small"
        sx={{
          borderRadius: 1.5,
          fontWeight: 700,
          backgroundColor: "#e8f4ff",
          color: "#0b5cab"
        }}
      />
    );
  }

  if (column.type === "count") {
    return (
      <Chip
        label={value}
        size="small"
        sx={{
          borderRadius: 1.5,
          fontWeight: 700,
          backgroundColor: "#f1f5f9",
          color: "#334155"
        }}
      />
    );
  }

  if (column.type === "id") {
    return (
      <Typography
        variant="body2"
        sx={{
          fontFamily: '"Consolas", "Courier New", monospace',
          fontSize: 12.5,
          color: "#0f172a",
          wordBreak: "break-word",
          lineHeight: 1.55
        }}
      >
        {value}
      </Typography>
    );
  }

  return (
    <Typography variant="body2" sx={{ color: "#0f172a", lineHeight: 1.55 }}>
      {value}
    </Typography>
  );
};

const JmsQueues = () => {
  const token = localStorage.getItem("token");
  const baseUrl = localStorage.getItem("baseUrl");
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState("");
  const [messages, setMessages] = useState([]);
  const [queuesLoading, setQueuesLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQueueDetails, setShowQueueDetails] = useState(false);
  const [selectedQueueLabel, setSelectedQueueLabel] = useState("");

  const queueHeading = useMemo(
    () => selectedQueueLabel || "Select a queue",
    [selectedQueueLabel]
  );

  const loadQueues = useCallback(async () => {
    setQueuesLoading(true);
    setError("");
    setMessages([]);
    setSelectedQueue("");
    setSelectedQueueLabel("");

    try {
      const response = await fetch(`${API_BASE_URL}/jms-queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, baseUrl })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorDetail(data, "Failed to load JMS queues."));
      }

      setQueues(Array.isArray(data.queues) ? data.queues : []);
    } catch (loadError) {
      console.error("failed to load JMS queues", loadError);
      setError(loadError.message || "Failed to load JMS queues.");
    } finally {
      setQueuesLoading(false);
    }
  }, [baseUrl, token]);

  const loadMessages = useCallback(async (queue) => {
    setShowQueueDetails(true);
    setSelectedQueue(queue.key || queue.name);
    setSelectedQueueLabel(queue.name);
    setMessages([]);
    setMessagesLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/jms-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          baseUrl,
          queueName: queue.name,
          queueKey: queue.key || queue.name
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorDetail(data, "Failed to load JMS messages."));
      }

      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (loadError) {
      console.error("failed to load JMS messages", loadError);
      setError(loadError.message || "Failed to load JMS messages.");
    } finally {
      setMessagesLoading(false);
    }
  }, [baseUrl, token]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  return (
    <Box sx={{ minHeight: "100vh", background: "#f6f8fb", pb: 6 }}>
      <TopBar />
      <Container maxWidth="xl" sx={{ pt: { xs: 3, md: 5 } }}>
        <Stack spacing={2.5}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 2,
              border: "1px solid #d7dee8",
              background: "#ffffff"
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1.5}
            >
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  JMS Queues
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View the message queue count first, then open it to inspect queue messages.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <Button
                  variant="contained"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={loadQueues}
                  disabled={queuesLoading}
                  sx={{ borderRadius: 2, background: "#0b84d6" }}
                >
                  {queuesLoading ? "Loading..." : "Refresh"}
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}

          <Paper
            elevation={0}
            sx={{
              width: "100%",
              maxWidth: 320,
              border: "1px solid #d7dee8",
              borderRadius: 3,
              background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
              boxShadow: "0 14px 28px rgba(15, 23, 42, 0.06)",
              overflow: "hidden"
            }}
          >
            <Button
              fullWidth
              onClick={() => setShowQueueDetails(true)}
              disabled={queuesLoading || queues.length === 0}
              sx={{
                minHeight: 196,
                px: 3,
                py: 3,
                display: "flex",
                alignItems: "stretch",
                justifyContent: "space-between",
                textTransform: "none",
                color: "inherit"
              }}
            >
              <Stack justifyContent="space-between" alignItems="flex-start" sx={{ height: "100%" }}>
                <Typography variant="h5" fontWeight={800} color="#1f2937">
                  Message Queues
                </Typography>
                <Typography variant="h3" sx={{ fontSize: { xs: 54, md: 64 }, color: "#6f89a5", fontWeight: 600 }}>
                  {queuesLoading ? <CircularProgress size={42} /> : queues.length}
                </Typography>
                <Typography variant="body1" color="#516b89" fontWeight={600}>
                  Available queues
                </Typography>
              </Stack>
              <Stack justifyContent="space-between" alignItems="flex-end">
                <DnsRoundedIcon sx={{ fontSize: 38, color: "#9db2c9" }} />
                <ArrowForwardRoundedIcon sx={{ fontSize: 28, color: "#0b84d6" }} />
              </Stack>
            </Button>
          </Paper>

          {showQueueDetails && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems="stretch">
              <Paper
                elevation={0}
                sx={{
                  width: { xs: "100%", md: 390 },
                  border: "1px solid #d7dee8",
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "#ffffff",
                  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.05)"
                }}
              >
                <Box sx={{ px: 2.25, py: 1.75, borderBottom: "1px solid #d7dee8", background: "#fbfdff" }}>
                  <Typography variant="h6" fontWeight={800}>Queues</Typography>
                </Box>
                <Stack sx={{ maxHeight: 620, overflow: "auto" }}>
                  {queuesLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : queues.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No queues found.
                    </Typography>
                  ) : (
                    queues.map((queue) => (
                      <Button
                        key={queue.key || queue.name}
                        onClick={() => loadMessages(queue)}
                        endIcon={<ArrowForwardRoundedIcon />}
                        sx={{
                          justifyContent: "space-between",
                          px: 2.25,
                          py: 1.5,
                          borderRadius: 0,
                          color: selectedQueue === (queue.key || queue.name) ? "primary.dark" : "text.primary",
                          bgcolor: selectedQueue === (queue.key || queue.name) ? "#edf6ff" : "#ffffff",
                          borderBottom: "1px solid #eef2f6",
                          textAlign: "left",
                          textTransform: "none",
                          fontWeight: 700
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{
                            minWidth: 0,
                            flex: 1,
                            justifyContent: "space-between"
                          }}
                        >
                          <Box
                            component="span"
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: 16,
                              minWidth: 0,
                              flex: 1
                            }}
                          >
                            {queue.name}
                          </Box>
                          <Chip
                            label={queue.entries ?? 0}
                            size="small"
                            sx={{
                              borderRadius: 1.5,
                              fontWeight: 700,
                              minWidth: 34,
                              backgroundColor: "#eef6ff",
                              color: "#0b84d6"
                            }}
                          />
                        </Stack>
                      </Button>
                    ))
                  )}
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  border: "1px solid #d7dee8",
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "#ffffff",
                  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.05)"
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1.5}
                  sx={{ px: 2.5, py: 2, borderBottom: "1px solid #d7dee8", background: "#fbfdff" }}
                >
                  <Box>
                    <Typography variant="h5" fontWeight={800}>Messages</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                      {queueHeading}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {!messagesLoading && selectedQueue && (
                      <Chip
                        label={`${messages.length} message${messages.length === 1 ? "" : "s"}`}
                        size="small"
                        sx={{
                          borderRadius: 1.5,
                          fontWeight: 700,
                          backgroundColor: "#eef6ff",
                          color: "#0b84d6"
                        }}
                      />
                    )}
                    {messagesLoading && <CircularProgress size={22} />}
                  </Stack>
                </Stack>

                <TableContainer sx={{ maxHeight: 620, background: "#ffffff" }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        {messageColumns.map((column) => (
                          <TableCell
                            key={column.key}
                            sx={{
                              bgcolor: "#edf3fa",
                              fontWeight: 800,
                              color: "#0f172a",
                              borderRight: "1px solid #d7e0ea",
                              whiteSpace: "nowrap",
                              minWidth: column.minWidth
                            }}
                          >
                            {column.label}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {!selectedQueue ? (
                        <TableRow>
                          <TableCell colSpan={messageColumns.length} align="center">
                            Select a queue to view messages.
                          </TableCell>
                        </TableRow>
                      ) : messagesLoading ? (
                        <TableRow>
                          <TableCell colSpan={messageColumns.length} align="center">
                            <CircularProgress size={22} />
                          </TableCell>
                        </TableRow>
                      ) : messages.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={messageColumns.length} align="center">
                            No messages found in this queue.
                          </TableCell>
                        </TableRow>
                      ) : (
                        messages.map((message) => (
                          <TableRow
                            key={message.id}
                            hover
                            sx={{
                              "&:nth-of-type(even)": {
                                backgroundColor: "#fafcff"
                              },
                              "&:hover": {
                                backgroundColor: "#f2f8ff"
                              }
                            }}
                          >
                            {messageColumns.map((column) => (
                              <TableCell
                                key={`${message.id}-${column.key}`}
                                sx={{
                                  borderRight: "1px solid #e2e8f0",
                                  borderBottom: "1px solid #edf2f7",
                                  verticalAlign: "top",
                                  minWidth: column.minWidth,
                                  maxWidth: column.type === "id" ? 260 : 190,
                                  py: 1.75
                                }}
                              >
                                {renderCellValue(column, message[column.key])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default JmsQueues;
