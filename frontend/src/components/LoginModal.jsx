import React, { useState } from "react";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useNavigate } from "react-router-dom";

const LoginModal = ({ closeModal }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    setError("");

    const users = [
      { username: "admin", password: "admin123" },
      { username: "user", password: "user123" }
    ];

    const validUser = users.find(
      (user) => user.username === username && user.password === password
    );

    if (validUser) {
      localStorage.setItem("user", JSON.stringify(validUser));
      closeModal();
      navigate("/tenant");
      return;
    }

    setError("Invalid credentials.");
  };

  return (
    <Dialog
      open
      onClose={(_, reason) => {
        if (reason === "backdropClick") return;
        closeModal();
      }}
      disableEscapeKeyDown
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          boxShadow: "0 28px 70px rgba(15, 23, 42, 0.18)",
          minHeight: 120
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, background: "linear-gradient(120deg, #ecfeff, #f0fdf4)" }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: "primary.main", color: "common.white" }}>
            <LockOutlinedIcon />
          </Avatar>
          <Box>
            <Typography variant="h5">Sign in</Typography>
          </Box>
        </Stack>
        <IconButton
          aria-label="close"
          onClick={closeModal}
          sx={{ position: "absolute", right: 12, top: 12, color: "error.main" }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack component="form" spacing={3.5} onSubmit={handleLogin}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ pt: 1 }} />
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }
            }}
          />
          <Stack direction="row" spacing={1.5} justifyContent="center">
            <Button type="submit" variant="contained">
              Submit
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
