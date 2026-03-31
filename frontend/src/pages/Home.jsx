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
          "radial-gradient(circle at 12% 18%, rgba(94, 234, 212, 0.35), transparent 38%), radial-gradient(circle at 88% 12%, rgba(56, 189, 248, 0.25), transparent 40%), linear-gradient(150deg, #f7fafc 0%, #eef2f7 40%, #e2e8f0 100%)",
        py: { xs: 4, md: 8 }
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="stretch">
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper
              elevation={0}
              sx={{
                height: "100%",
                p: { xs: 4, md: 6 },
                borderRadius: 3,
                color: "common.white",
                background:
                  "linear-gradient(160deg, #0b3b36 0%, #0f766e 45%, #22c55e 100%)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: "auto -10% -18% auto",
                  width: 280,
                  height: 280,
                  borderRadius: "50%",
                  background: "rgba(255, 237, 213, 0.22)",
                  filter: "blur(12px)"
                }}
              />
              <Stack spacing={3} sx={{ position: "relative", zIndex: 1 }}>
                <Chip
                  label="Tenant operations cockpit"
                  color="secondary"
                  sx={{ alignSelf: "flex-start", fontWeight: 700 }}
                />
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    size="large"
                    variant="contained"
                    color="secondary"
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => setShowLogin(true)}
                  >
                    Open portal
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
        
          </Grid>
        </Grid>
      </Container>
      {showLogin && <LoginModal closeModal={() => setShowLogin(false)} />}
    </Box>
  );
};

export default Home;
