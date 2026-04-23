import React, { useCallback, useEffect, useMemo, useState } from "react";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import FormatListBulletedRoundedIcon from "@mui/icons-material/FormatListBulletedRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import TopBar from "../components/TopBar";
import { API_BASE_URL } from "../config";

const messageFields = [
  { key: "messageId", label: "Message ID", color: "#0b63ce", isLinkish: true },
  { key: "status", label: "Status", toneMap: { Failed: "#c62828", Waiting: "#9a6700", Available: "#2e7d32" } },
  { key: "dueAt", label: "Due At" },
  { key: "createdAt", label: "Created At" },
  { key: "retainUntil", label: "Retain Until" },
  { key: "retryCount", label: "Retry Count" },
  { key: "nextRetryOn", label: "Next Retry On" },
  { key: "correlationId", label: "Correlation ID", color: "#0b63ce", isLinkish: true },
  { key: "iflowName", label: "iFlow Name" },
  { key: "packageName", label: "Package Name" }
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
  const [queueFilter, setQueueFilter] = useState("");
  const [messageFilter, setMessageFilter] = useState("");
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [targetQueueName, setTargetQueueName] = useState("");
  const [moveLoading, setMoveLoading] = useState(false);

  const filteredQueues = useMemo(() => {
    const normalizedFilter = queueFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return queues;
    }

    return queues.filter((queue) => queue.name.toLowerCase().includes(normalizedFilter));
  }, [queueFilter, queues]);

  const filteredMessages = useMemo(() => {
    const normalizedFilter = messageFilter.trim().toLowerCase();
    if (!normalizedFilter) {
      return messages;
    }

    return messages.filter((message) =>
      [message.jmsMessageId, message.messageId, message.correlationId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedFilter))
    );
  }, [messageFilter, messages]);

  const allVisibleMessageIds = useMemo(
    () => filteredMessages.map((message) => message.id),
    [filteredMessages]
  );

  const allVisibleSelected =
    allVisibleMessageIds.length > 0 &&
    allVisibleMessageIds.every((messageId) => selectedMessageIds.includes(messageId));

  const hasPartialSelection =
    allVisibleMessageIds.some((messageId) => selectedMessageIds.includes(messageId)) &&
    !allVisibleSelected;

  const toggleMessageSelection = (messageId) => {
    setSelectedMessageIds((currentIds) =>
      currentIds.includes(messageId)
        ? currentIds.filter((id) => id !== messageId)
        : [...currentIds, messageId]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedMessageIds((currentIds) => {
      if (allVisibleSelected) {
        return currentIds.filter((id) => !allVisibleMessageIds.includes(id));
      }

      return Array.from(new Set([...currentIds, ...allVisibleMessageIds]));
    });
  };

  const toggleSelectionMode = () => {
    setSelectionMode((currentValue) => {
      if (currentValue) {
        setSelectedMessageIds([]);
      }

      return !currentValue;
    });
  };

  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedMessageIds.includes(message.id)),
    [messages, selectedMessageIds]
  );

  const loadQueues = useCallback(async () => {
    setQueuesLoading(true);
    setError("");
    setMessages([]);
    setSelectedQueue("");
    setSelectedMessageIds([]);
    setSelectionMode(false);

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
    setMessages([]);
    setMessagesLoading(true);
    setError("");
    setSelectedMessageIds([]);
    setSelectionMode(false);

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

  const openMoveDialog = () => {
    setTargetQueueName("");
    setMoveDialogOpen(true);
  };

  const closeMoveDialog = () => {
    if (moveLoading) {
      return;
    }

    setMoveDialogOpen(false);
    setTargetQueueName("");
  };

  const handleMoveMessages = async () => {
    if (!targetQueueName || !selectedQueue || selectedMessages.length === 0) {
      return;
    }

    setMoveLoading(true);
    setError("");

    try {
      const sourceQueue = queues.find((queue) => (queue.key || queue.name) === selectedQueue);
      const response = await fetch(`${API_BASE_URL}/jms-messages/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          baseUrl,
          sourceQueueName: sourceQueue?.name || selectedQueue,
          targetQueueName,
          messages: selectedMessages.map((message) => ({
            jmsMessageId: message.jmsMessageId,
            failed: message.failed
          }))
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorDetail(data, "Failed to move JMS messages."));
      }

      closeMoveDialog();
      if (sourceQueue) {
        await loadMessages(sourceQueue);
      }
      await loadQueues();
    } catch (moveError) {
      console.error("failed to move JMS messages", moveError);
      setError(moveError.message || "Failed to move JMS messages.");
    } finally {
      setMoveLoading(false);
    }
  };

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
              <Stack justifyContent="flex-end" alignItems="flex-end">
                <ArrowForwardRoundedIcon sx={{ fontSize: 28, color: "#0b84d6" }} />
              </Stack>
            </Button>
          </Paper>

          {showQueueDetails && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} alignItems="stretch">
              <Paper
                elevation={0}
                sx={{
                  width: { xs: "100%", md: 420 },
                  border: "1px solid #d7dee8",
                  borderRadius: 3,
                  overflow: "hidden",
                  background: "#ffffff",
                  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.05)"
                }}
              >
                <Stack spacing={1.5} sx={{ px: 2.25, py: 1.75, borderBottom: "1px solid #d7dee8", background: "#fbfdff" }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h5" fontWeight={800}>
                      Queues ({queues.length})
                    </Typography>
                    <IconButton size="small">
                      <MoreHorizRoundedIcon />
                    </IconButton>
                  </Stack>
                  <TextField
                    size="small"
                    placeholder="Filter by Name"
                    value={queueFilter}
                    onChange={(event) => setQueueFilter(event.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchRoundedIcon fontSize="small" />
                          </InputAdornment>
                        )
                      }
                    }}
                    sx={{
                      maxWidth: 280,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        backgroundColor: "#ffffff"
                      }
                    }}
                  />
                </Stack>
                <Stack sx={{ maxHeight: 620, overflow: "auto" }}>
                  {queuesLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                      <CircularProgress size={28} />
                    </Box>
                  ) : filteredQueues.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No queues found.
                    </Typography>
                  ) : (
                    filteredQueues.map((queue) => (
                      <Box
                        key={queue.key || queue.name}
                        sx={{
                          px: 2.25,
                          py: 1.8,
                          bgcolor: selectedQueue === (queue.key || queue.name) ? "#edf6ff" : "#ffffff",
                          borderBottom: "1px solid #eef2f6",
                          borderLeft: selectedQueue === (queue.key || queue.name) ? "3px solid #0b63ce" : "3px solid transparent"
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              sx={{
                                fontSize: 16,
                                fontWeight: 500,
                                color: "#3d5d87",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                              }}
                            >
                              {queue.name}
                            </Typography>
                            <Stack spacing={0.35} sx={{ mt: 1.25 }}>
                              <Typography variant="body2" sx={{ color: "#4f6b8a" }}>
                                Access Type:
                                {" "}
                                <Box component="span" sx={{ color: "#1f2937" }}>{queue.accessType}</Box>
                              </Typography>
                              <Typography variant="body2" sx={{ color: "#4f6b8a" }}>
                                Usage:
                                {" "}
                                <Box component="span" sx={{ color: queue.usage === "OK" ? "#2e7d32" : "#c62828" }}>{queue.usage}</Box>
                              </Typography>
                              <Typography variant="body2" sx={{ color: "#4f6b8a" }}>
                                State:
                                {" "}
                                <Box component="span" sx={{ color: queue.state === "Started" ? "#2e7d32" : "#c62828" }}>{queue.state}</Box>
                              </Typography>
                              <Typography variant="body2" sx={{ color: "#4f6b8a" }}>
                                Entries:
                                {" "}
                                <Box component="span" sx={{ color: "#1f2937" }}>{queue.entries ?? 0}</Box>
                              </Typography>
                            </Stack>
                          </Box>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <IconButton size="small">
                              <MoreHorizRoundedIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={() => loadMessages(queue)}>
                              <ArrowForwardRoundedIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </Box>
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
                    <Typography variant="h5" fontWeight={800}>Messages ({filteredMessages.length})</Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ width: { xs: "100%", sm: "auto" } }}>
                    <TextField
                      size="small"
                      placeholder="Message ID, Correlation ID"
                      value={messageFilter}
                      onChange={(event) => setMessageFilter(event.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchRoundedIcon fontSize="small" />
                            </InputAdornment>
                          )
                        }
                      }}
                      sx={{
                        minWidth: { xs: "100%", sm: 300 },
                        "& .MuiOutlinedInput-root": {
                          borderRadius: 2,
                          backgroundColor: "#ffffff"
                        }
                      }}
                    />
                    <Button
                      variant="text"
                      startIcon={<DriveFileMoveOutlinedIcon />}
                      disabled={!selectionMode || selectedMessageIds.length === 0}
                      onClick={openMoveDialog}
                      sx={{ textTransform: "none", fontWeight: 600, color: "#91b8ee" }}
                    >
                      Move
                    </Button>
                    <Button
                      variant="text"
                      startIcon={<ReplayRoundedIcon />}
                      disabled={!selectionMode || selectedMessageIds.length === 0}
                      sx={{ textTransform: "none", fontWeight: 600, color: "#91b8ee" }}
                    >
                      Retry
                    </Button>
                    <Button
                      variant="text"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      disabled={!selectionMode || selectedMessageIds.length === 0}
                      sx={{ textTransform: "none", fontWeight: 600, color: "#91b8ee" }}
                    >
                      Delete
                    </Button>
                    <IconButton size="small" sx={{ color: selectionMode ? "#0b63ce" : "#5f7fa5" }} onClick={toggleSelectionMode}>
                      <FormatListBulletedRoundedIcon />
                    </IconButton>
                    <IconButton size="small" sx={{ color: "#0b63ce" }}>
                      <MoreHorizRoundedIcon />
                    </IconButton>
                    {messagesLoading && <CircularProgress size={22} />}
                  </Stack>
                </Stack>

                <Stack sx={{ maxHeight: 620, overflow: "auto", background: "#ffffff" }}>
                  {!selectedQueue ? (
                    <Typography sx={{ p: 3, color: "#64748b" }}>
                      Select a queue to view messages.
                    </Typography>
                  ) : messagesLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : filteredMessages.length === 0 ? (
                    <Typography sx={{ p: 3, color: "#64748b" }}>
                      No messages found in this queue.
                    </Typography>
                  ) : (
                    <>
                      <Box
                        sx={{
                          px: 2.25,
                          py: 1.2,
                          borderBottom: "1px solid #dde6ef",
                          backgroundColor: "#ffffff"
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {selectionMode && (
                            <Checkbox
                              checked={allVisibleSelected}
                              indeterminate={hasPartialSelection}
                              onChange={toggleSelectAllVisible}
                              sx={{ p: 0.5, color: "#6b85a4" }}
                            />
                          )}
                          <Typography sx={{ fontSize: 15, fontWeight: 700, color: "#24364d" }}>
                            JMS Message ID
                          </Typography>
                        </Stack>
                      </Box>
                      {filteredMessages.map((message, index) => (
                        <Box
                          key={message.id}
                          sx={{
                            px: 2.25,
                            py: 2.25,
                            backgroundColor: index % 2 === 1 ? "#f4f7fb" : "#ffffff",
                            borderBottom: "1px solid #dde6ef"
                          }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            {selectionMode && (
                              <Checkbox
                                checked={selectedMessageIds.includes(message.id)}
                                onChange={() => toggleMessageSelection(message.id)}
                                sx={{ p: 0.5, mt: 0.1, color: "#6b85a4" }}
                              />
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontSize: 16,
                                  fontWeight: 500,
                                  color: "#1f2937",
                                  wordBreak: "break-word"
                                }}
                              >
                                {message.jmsMessageId || "-"}
                              </Typography>
                              <Stack spacing={0.7} sx={{ mt: 1.5 }}>
                                {messageFields.map((field) => {
                                  const value = message[field.key];
                                  const displayValue = value || "-";
                                  return (
                                    <Typography key={`${message.id}-${field.key}`} sx={{ fontSize: 15, color: "#4f6b8a", lineHeight: 1.45 }}>
                                      {field.label}
                                      :{" "}
                                      <Box
                                        component="span"
                                        sx={{
                                          color:
                                            field.key === "status"
                                              ? field.toneMap?.[value] || "#1f2937"
                                              : field.color || "#1f2937",
                                          fontWeight: field.key === "status" || field.isLinkish ? 500 : 400,
                                          wordBreak: "break-word"
                                        }}
                                      >
                                        {displayValue}
                                      </Box>
                                    </Typography>
                                  );
                                })}
                              </Stack>
                            </Box>
                          </Stack>
                        </Box>
                      ))}
                    </>
                  )}
                </Stack>
              </Paper>
            </Stack>
          )}
        </Stack>
      </Container>

      <Dialog open={moveDialogOpen} onClose={closeMoveDialog} fullWidth maxWidth="sm">
        <DialogTitle>Move Messages</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Selected messages: {selectedMessages.length}
            </Typography>
            <TextField
              select
              label="Target Queue"
              value={targetQueueName}
              onChange={(event) => setTargetQueueName(event.target.value)}
              fullWidth
            >
              {queues
                .filter((queue) => queue.name !== (queues.find((queue) => (queue.key || queue.name) === selectedQueue)?.name || selectedQueue))
                .map((queue) => (
                  <MenuItem key={queue.key || queue.name} value={queue.name}>
                    {queue.name}
                  </MenuItem>
                ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMoveDialog} disabled={moveLoading}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMoveMessages}
            disabled={!targetQueueName || moveLoading || selectedMessages.length === 0}
          >
            {moveLoading ? "Moving..." : "Move"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JmsQueues;
