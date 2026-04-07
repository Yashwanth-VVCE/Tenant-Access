import React from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Paper,
  Stack,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "#ffffff",
        py: { xs: 6, md: 10 },
        display: "flex",
        alignItems: "center"
      }}
    >
      <Container maxWidth="md">
        <Grid container spacing={4} justifyContent="center">
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper
              elevation={0}
              sx={{
                height: { xs: "auto", md: 420 },
                p: { xs: 4, md: 6 },
                borderRadius: 2,
                color: "#0f172a",
                background: "#f6f8fb",
                position: "relative",
                overflow: "hidden",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
              }}
            >
              <Stack spacing={3} sx={{ position: "relative", zIndex: 1, height: "100%" }} justifyContent="center">
                <Box
                  component="img"
                  src="/Incture_Technologies_Logo.jpg"
                  alt="Incture"
                  sx={{
                    width: "100%",
                    maxWidth: 220,
                    height: "auto",
                    alignSelf: "center"
                  }}
                />
                <Chip
                  label="CPI Monitoring Overview"
                  color="primary"
                  variant="outlined"
                  sx={{
                    alignSelf: "center",
                    fontWeight: 1000,
                    fontSize: 20,
                    height: 46,
                    px: 4.5,
                    borderColor: "rgba(11, 132, 214, 0.4)",
                    color: "primary.dark"
                  }}
                />
                  <Button
                    size="large"
                    variant="contained"
                    color="primary"
                    onClick={() => navigate("/login")}
                    sx={{
                      alignSelf: "center",
                      background: "linear-gradient(90deg, #70bbec 0%, #372794 120%)",
                    }}
                  >
                    Login
                  </Button>

              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Home;
