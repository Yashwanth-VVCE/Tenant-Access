import React from "react";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import {
  AppBar,
  Box,
  Button,
  Container,
  Stack,
  Toolbar,
  Typography
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const TopBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("baseUrl");
    localStorage.removeItem("packages");
    navigate("/");
  };

  return (
    <AppBar
      position="sticky"
      color="transparent"
      elevation={0}
      sx={{
        borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
        bgcolor: "rgba(248, 250, 252, 0.82)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: 76 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: "primary.main",
                boxShadow: "0 0 0 6px rgba(13, 148, 136, 0.2)"
              }}
            />
            <Box>
              <Typography variant="overline" sx={{ color: "primary.dark", lineHeight: 1.2 }}>
                Tenant Access
              </Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.15 }}>
                SAP CPI Monitor
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            {location.pathname !== "/status" && location.pathname !== "/tenant" && (
              <Button
                variant="outlined"
                color="primary"
                onClick={() => navigate("/status")}
                sx={{ borderRadius: 12 }}
              >
                Status
              </Button>
            )}
            <Button
              variant="outlined"
              color="primary"
              startIcon={<LogoutRoundedIcon />}
              onClick={handleLogout}
              sx={{ borderRadius: 12 }}
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default TopBar;
