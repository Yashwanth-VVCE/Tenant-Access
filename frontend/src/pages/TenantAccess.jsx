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
          "linear-gradient(150deg, #ffffff 0%, #ffffff 45%, #ffffff 100%)",
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
        maxWidth="sm"
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
      </Container>
    </Box>
  );
};

export default TenantAccess;
