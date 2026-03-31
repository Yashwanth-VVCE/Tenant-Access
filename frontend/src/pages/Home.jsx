import React, { useState } from "react";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import LoginModal from "../components/LoginModal";

const Home = () => {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 12% 18%, rgba(14, 165, 233, 0.28), transparent 40%), radial-gradient(circle at 88% 12%, rgba(59, 130, 246, 0.25), transparent 42%), linear-gradient(150deg, #f7fafc 0%, #eef2f7 40%, #e2e8f0 100%)",
        py: { xs: 4, md: 8 },
        display: "flex",
        alignItems: "center"
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper
              elevation={0}
              sx={{
                height: "100%",
                p: { xs: 4, md: 6 },
                borderRadius: 3,
                color: "#0f172a",
                background:
                  "linear-gradient(160deg, rgba(255,255,255,0.94) 0%, rgba(240,249,255,0.95) 52%, rgba(224,242,254,0.96) 100%)",
                position: "relative",
                overflow: "hidden",
                border: "1px solid rgba(14, 165, 233, 0.25)",
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: "auto -10% -18% auto",
                  width: 280,
                  height: 280,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(59, 130, 246, 0.22), transparent 70%)",
                  filter: "blur(12px)"
                }}
              />
              <Stack spacing={3} sx={{ position: "relative", zIndex: 1 }}>
                <Chip
                  label="Tenant operations cockpit"
                  color="primary"
                  variant="outlined"
                  sx={{
                    alignSelf: "flex-start",
                    fontWeight: 700,
                    borderColor: "rgba(14, 165, 233, 0.4)",
                    color: "primary.dark"
                  }}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    size="large"
                    variant="contained"
                    color="primary"
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => setShowLogin(true)}
                    sx={{
                      background: "linear-gradient(90deg, #0b84d6 0%, #4cc3ff 100%)"
                    }}
                  >
                    Open Portal
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
      {showLogin && <LoginModal closeModal={() => setShowLogin(false)} />}
    </Box>
  );
};

export default Home;
