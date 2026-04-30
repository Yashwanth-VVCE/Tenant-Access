import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
  InputAdornment,
  CircularProgress
} from "@mui/material";

import CableRoundedIcon from "@mui/icons-material/CableRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";

import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { API_BASE_URL } from "../config";

const hasStoredTenantSession = () => {
  try {
    return Boolean(
      localStorage.getItem("tenantAccessComplete") === "true" &&
      localStorage.getItem("token") &&
      localStorage.getItem("baseUrl")
    );
  } catch {
    return false;
  }
};

const TenantAccess = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(hasStoredTenantSession);
  const [queueCount, setQueueCount] = useState(0);
  const [queueCountLoading, setQueueCountLoading] = useState(false);

  const navigate = useNavigate();

  const loadQueueCount = async () => {
    const token = localStorage.getItem("token");
    const baseUrl = localStorage.getItem("baseUrl");

    if (!token || !baseUrl) {
      return;
    }

    setQueueCountLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/jms-queues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, baseUrl })
      });
      const data = await response.json();
      
      if (response.ok && data.queues) {
        setQueueCount(data.queues.length);
      }
    } catch (error) {
      console.error("Failed to load queue count:", error);
    } finally {
      setQueueCountLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadQueueCount();
    }
  }, [isConnected]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setIsError(false);

    const cleanToken = tokenUrl.trim().replace(/\/+$/, "");
    const cleanBase = baseUrl.trim().replace(/\/+$/, "");

    if (cleanToken === cleanBase) {
      setIsError(true);
      setMessage("Token URL and Base URL cannot be the same.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/connectTenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, tokenUrl: cleanToken, baseUrl: cleanBase })
      });

      const result = await response.json();

      if (result.packages) {
        setIsError(false);
        setMessage(result.message);
        localStorage.setItem("token", result.token);
        localStorage.setItem("baseUrl", result.baseUrl || cleanBase);
        localStorage.setItem("packages", JSON.stringify(result.packages || []));
        localStorage.setItem("tenantAccessComplete", "true");
        setIsConnected(true);
      } else {
        setIsError(true);
        setMessage(result.message || "Connection Failed");
      }

    } catch {
      setIsError(true);
      setMessage("Connection Failed. Please check credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: isConnected ? "linear-gradient(135deg, #1e3a5f 0%, #2d5a8c 100%)" : "#f6f8fb",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <TopBar />

      {message && (
        <Box
          sx={{
            position: "absolute",
            top: 110,
            left: { xs: 16, md: 24 },
            zIndex: 2,
            width: { xs: "calc(100% - 32px)", sm: 360 }
          }}
        >
          <Alert
            severity={isError ? "error" : "success"}
            sx={{
              borderRadius: 2,
              boxShadow: "0 18px 34px rgba(15, 23, 42, 0.18)",
              border: "1px solid rgba(15, 23, 42, 0.12)"
            }}
          >
            {message}
          </Alert>
        </Box>
      )}

      <Container
        maxWidth={isConnected ? "md" : "sm"}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: { xs: 2, md: 3 },
          py: { xs: 4, md: 6 }
        }}
      >
        {isConnected ? (
          <Paper
            elevation={0}
            sx={{
              width: "100%",
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              background: "transparent",
              border: "none",
              boxShadow: "none"
            }}
          >
            <Stack spacing={3} sx={{ width: "100%" }}>
              <Stack spacing={1} alignItems="center">
                <Typography variant="h4" fontWeight="bold" sx={{ color: "#ffffff" }}>
                  Monitoring Status Overview
                </Typography>
                <Typography variant="body2" color="text.secondary">
                </Typography>
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2.5}
                justifyContent="center"
                alignItems="center"
              >
                <Paper
                  elevation={0}
                  sx={{
                    width: "100%",
                    maxWidth: { xs: "100%", sm: 260 },
                    minHeight: { xs: 140, sm: 180 },
                    borderRadius: 4,
                    background: "#ffffff",
                    border: "1px solid #e0e0e0",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                    p: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start"
                  }}
                >
                  <Button
                    fullWidth
                    onClick={() => navigate("/status")}
                    sx={{
                      height: "100%",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      px: 3,
                      py: 3,
                      textTransform: "none",
                      color: "#1f2937",
                      fontSize: 15,
                      fontWeight: 600,
                      textAlign: "left",
                      lineHeight: 1.4,
                      "&:hover": {
                        background: "rgba(11, 132, 214, 0.04)"
                      },
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "flex-start"
                    }}
                  >
                    <Typography variant="body2" sx={{ color: "#64748b", fontSize: 14, fontWeight: 500, mb: 2 }}>
                      Message Monitoring
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: "#64748b" }}>
                      Overview
                    </Typography>
                  </Button>
                </Paper>
                <Paper
                  elevation={0}
                  sx={{
                    width: "100%",
                    maxWidth: { xs: "100%", sm: 260 },
                    minHeight: { xs: 140, sm: 180 },
                    borderRadius: 4,
                    background: "#ffffff",
                    border: "1px solid #e0e0e0",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                    p: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center"
                  }}
                >
                  <Button
                    fullWidth
                    onClick={() => navigate("/jms-queues")}
                    sx={{
                      height: "100%",
                      justifyContent: "center",
                      alignItems: "center",
                      px: 3,
                      py: 3,
                      textTransform: "none",
                      color: "#0b63ce",
                      textAlign: "center",
                      lineHeight: 1.2,
                      "&:hover": {
                        background: "rgba(11, 132, 214, 0.04)"
                      },
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center"
                    }}
                  >
                    {queueCountLoading ? (
                      <CircularProgress size={56} sx={{ color: "#0b63ce", mb: 2 }} />
                    ) : (
                      <>
                        <Typography sx={{ fontSize: { xs: 48, md: 56 }, fontWeight: 600, color: "#6f89a5", lineHeight: 1 }}>
                          {queueCount}
                        </Typography>
                        <Typography variant="body1" sx={{ color: "#64748b", fontWeight: 500, mt: 2 }}>
                          Queues
                        </Typography>
                      </>
                    )}
                  </Button>
                </Paper>
              </Stack>
            </Stack>
          </Paper>
        ) : (
          <Paper
            elevation={8}
            sx={{
              width: "100%",
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              backdropFilter: "blur(10px)",
              background: "linear-gradient(150deg, rgba(112, 151, 156, 0.48) 0%, rgba(100, 152, 231, 0.44) 100%)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              boxShadow: "0 28px 70px rgba(15, 23, 42, 0.18)"
            }}
          >
            <Stack spacing={2} component="form" onSubmit={handleSubmit}>

              <Stack spacing={2} alignItems="center">
                <Typography variant="h4" fontWeight="bold">
                  Access Tenant
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  Connect your SAP tenant using Client Credentials
                </Typography>
              </Stack>

              <TextField
                placeholder="Client ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                fullWidth
                required
                InputProps={{
                  sx: {
                    fontSize: 15
                  },
                  startAdornment: (
                    <InputAdornment position="start">
                      <VpnKeyRoundedIcon />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                placeholder="Client Secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                fullWidth
                required
                InputProps={{
                  sx: {
                    fontSize: 15
                  },
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyRoundedIcon />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                placeholder="Token URL"
                value={tokenUrl}
                onChange={(e) => setTokenUrl(e.target.value)}
                fullWidth
                required
                InputProps={{
                  sx: {
                    fontSize: 15
                  },
                  startAdornment: (
                    <InputAdornment position="start">
                      <CableRoundedIcon />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                placeholder="Base URL"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                fullWidth
                required
                InputProps={{
                  sx: {
                    fontSize: 15
                  },
                  startAdornment: (
                    <InputAdornment position="start">
                      <HubRoundedIcon />
                    </InputAdornment>
                  )
                }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{
                  height: 50,
                  fontWeight: "bold",
                  borderRadius: 3,
                  background:
                    "linear-gradient(90deg,#0b84d6,#4cc3ff)"
                }}
              >
                {isLoading ? "Connecting..." : "Connect"}
              </Button>

            </Stack>
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default TenantAccess;
