import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#0f766e",
      light: "#5eead4",
      dark: "#115e59"
    },
    secondary: {
      main: "#f97316"
    },
    background: {
      default: "#f4f7fb",
      paper: "#ffffff"
    },
    success: {
      main: "#15803d"
    },
    error: {
      main: "#b91c1c"
    },
    warning: {
      main: "#b45309"
    }
  },
  shape: {
    borderRadius: 10
  },
  typography: {
    fontFamily:
      '"Bahnschrift", "Segoe UI Variable Text", "Segoe UI", "Helvetica Neue", sans-serif',
    h2: {
      fontWeight: 800,
      letterSpacing: "-0.03em"
    },
    h6: {
      fontWeight: 700,
      letterSpacing: "0.02em"
    },
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.02em"
    },
    h5: {
      fontWeight: 700
    },
    button: {
      fontWeight: 700,
      textTransform: "none"
    }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(16px)"
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontWeight: 700
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        fullWidth: true
      },
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 12,
            backgroundColor: "rgba(255, 255, 255, 0.9)"
          }
        }
      }
    },
    MuiFormControl: {
      defaultProps: {
        fullWidth: true
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: "rgba(148, 163, 184, 0.5)"
        }
      }
    }
  }
});

export default theme;
