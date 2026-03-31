import React, { useState } from "react";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
  InputAdornment
} from "@mui/material";

import CableRoundedIcon from "@mui/icons-material/CableRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";

import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { API_BASE_URL } from "../config";

const TenantAccess = () => {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tokenUrl, setTokenUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

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

        setTimeout(() => navigate("/status"), 1000);
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
        background:
          "radial-gradient(circle at 10% 12%, rgba(94, 234, 212, 0.35), transparent 36%), radial-gradient(circle at 90% 20%, rgba(56, 189, 248, 0.28), transparent 40%), linear-gradient(150deg, #f7fafc 0%, #eef2f7 45%, #e2e8f0 100%)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <TopBar />

      <Container
        maxWidth="sm"
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Paper
          elevation={8}
          sx={{
            width: "100%",
            p: 4,
            borderRadius: 3,
            backdropFilter: "blur(10px)",
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
          }}
        >
          <Stack spacing={2} component="form" onSubmit={handleSubmit}>

            <Stack spacing={2} alignItems="center">
              <Typography variant="h4" fontWeight="bold">
                Tenant Access
              </Typography>

              <Typography variant="body2" color="text.secondary">
                Connect your SAP tenant using Client Credentials
              </Typography>
            </Stack>

            {message && (
              <Alert severity={isError ? "error" : "success"}>
                {message}
              </Alert>
            )}

            <TextField
              label="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <VpnKeyRoundedIcon />
                  </InputAdornment>
                )
              }}
            />

            <TextField
              label="Client Secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyRoundedIcon />
                  </InputAdornment>
                )
              }}
            />

            <TextField
              label="Token URL"
              value={tokenUrl}
              onChange={(e) => setTokenUrl(e.target.value)}
              fullWidth
              required
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CableRoundedIcon />
                  </InputAdornment>
                )
              }}
            />

            <TextField
              label="Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              fullWidth
              required
              InputProps={{
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
                  "linear-gradient(90deg,#0f766e,#22c55e)"
              }}
            >
              {isLoading ? "Connecting..." : "Connect Tenant"}
            </Button>

          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default TenantAccess;
