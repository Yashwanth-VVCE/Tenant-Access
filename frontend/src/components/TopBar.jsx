import React from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
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
  const showBackButton =
    location.pathname === "/status" || location.pathname === "/jms-queues";

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("baseUrl");
    localStorage.removeItem("packages");
    localStorage.removeItem("tenantAccessComplete");
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
      <Container maxWidth="xl">
        <Toolbar
          disableGutters
          sx={{
            minHeight: 100,
            justifyContent: "space-between",
            px: { xs: 2, md: 3 }
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              component="img"
              src="/Incture_Technologies_Logo.png"
              alt="Incture"
              sx={{
                height: 60,
                width: "auto",
                objectFit: "contain"
              }}
            />
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {showBackButton && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={() => navigate("/tenant")}
                sx={{ borderRadius: 12 }}
              >
                Back
              </Button>
            )}
            <Button
              variant="contained"
              color="error"
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
