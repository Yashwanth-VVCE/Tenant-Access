import React from "react";
import { Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import LoginModal from "../components/LoginModal";

const Login = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff"
      }}
    >
      <LoginModal closeModal={() => navigate("/")} />
    </Box>
  );
};

export default Login;
