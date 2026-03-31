import React from "react";
import LockPersonRoundedIcon from "@mui/icons-material/LockPersonRounded";
import { Box, Button, Container, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

const Unauthorized = () => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 12% 14%, rgba(94, 234, 212, 0.28), transparent 32%), radial-gradient(circle at 90% 12%, rgba(56, 189, 248, 0.22), transparent 40%), linear-gradient(160deg, #f7fafc 0%, #eef2f7 100%)"
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 5 },
            borderRadius: 3,
            textAlign: "center",
            border: "1px solid rgba(148, 163, 184, 0.35)",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.12)"
          }}
        >
          <Stack spacing={2} alignItems="center">
            <LockPersonRoundedIcon color="primary" sx={{ fontSize: 54 }} />
            <Typography variant="h4">Unauthorized access</Typography>
            <Typography color="text.secondary">
              You must be logged in before you can access the tenant configuration or status pages.
            </Typography>
            <Button component={Link} to="/" variant="contained" sx={{ mt: 1, borderRadius: 2 }}>
              Go to login
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
};

export default Unauthorized;
