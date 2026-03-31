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
      onClose={closeModal}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          boxShadow: "0 28px 70px rgba(15, 23, 42, 0.18)"
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
            <Typography variant="body2" color="text.secondary">
              Access the tenant monitor workspace
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack component="form" spacing={2.5} onSubmit={handleLogin}>
          {error && <Alert severity="error">{error}</Alert>}
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
          <Stack direction="row" spacing={1.5} justifyContent="flex-end">
            <Button color="inherit" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" variant="contained">
              Enter portal
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
