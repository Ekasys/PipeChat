import { alpha, createTheme } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material'

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'

  const backgroundDefault = isDark ? '#05070d' : '#f2f5fb'
  const backgroundPaper = isDark ? '#090d16' : '#ffffff'
  const borderColor = isDark ? 'rgba(122, 146, 194, 0.22)' : 'rgba(41, 55, 90, 0.16)'
  const glowShadow = isDark
    ? '0 20px 50px rgba(5, 12, 32, 0.55)'
    : '0 18px 40px rgba(42, 56, 95, 0.1)'

  return createTheme({
    spacing: 8,
    palette: {
      mode,
      primary: {
        main: '#5f86ff',
        light: '#8ba8ff',
        dark: '#395fe6',
      },
      secondary: {
        main: '#8a63ff',
        light: '#ab8dff',
        dark: '#6d48e0',
      },
      success: {
        main: '#35d388',
      },
      warning: {
        main: '#f4bc55',
      },
      error: {
        main: '#ff6579',
      },
      background: {
        default: backgroundDefault,
        paper: backgroundPaper,
      },
      text: {
        primary: isDark ? '#edf2ff' : '#111a34',
        secondary: isDark ? '#9aabca' : '#536286',
      },
    },
    typography: {
      fontFamily: ['"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
      h1: {
        fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
        fontWeight: 750,
        letterSpacing: '-0.03em',
      },
      h2: {
        fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
        fontWeight: 740,
        letterSpacing: '-0.028em',
      },
      h3: {
        fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
        fontWeight: 730,
        letterSpacing: '-0.024em',
      },
      h4: {
        fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
        fontWeight: 720,
        letterSpacing: '-0.02em',
      },
      h5: {
        fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
        fontWeight: 680,
      },
      h6: {
        fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
        fontWeight: 660,
      },
      subtitle2: {
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      },
      overline: {
        letterSpacing: '0.12em',
        fontWeight: 700,
      },
      caption: {
        fontFamily: ['"IBM Plex Mono"', '"SFMono-Regular"', 'monospace'].join(','),
      },
      button: {
        fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
        letterSpacing: '0.03em',
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: backgroundDefault,
            backgroundImage: isDark
              ? [
                  'radial-gradient(circle at 14% 10%, rgba(93, 116, 255, 0.14), transparent 34%)',
                  'radial-gradient(circle at 88% 88%, rgba(129, 82, 255, 0.14), transparent 35%)',
                  'linear-gradient(rgba(61, 78, 116, 0.08) 1px, transparent 1px)',
                  'linear-gradient(90deg, rgba(61, 78, 116, 0.08) 1px, transparent 1px)',
                ].join(', ')
              : [
                  'radial-gradient(circle at 10% 10%, rgba(95, 134, 255, 0.1), transparent 35%)',
                  'radial-gradient(circle at 88% 90%, rgba(130, 104, 255, 0.1), transparent 35%)',
                ].join(', '),
            backgroundSize: isDark ? '100% 100%, 100% 100%, 44px 44px, 44px 44px' : '100% 100%, 100% 100%',
            color: isDark ? '#edf2ff' : '#111a34',
          },
          '#root': {
            minHeight: '100vh',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background: isDark
              ? 'linear-gradient(180deg, rgba(6,10,18,0.95) 0%, rgba(4,7,13,0.95) 100%)'
              : 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(246,249,255,0.97) 100%)',
            borderBottom: `1px solid ${borderColor}`,
            boxShadow: isDark ? '0 14px 34px rgba(2, 6, 16, 0.5)' : '0 8px 24px rgba(27, 40, 72, 0.1)',
            backdropFilter: 'blur(12px)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: isDark
              ? 'linear-gradient(180deg, rgba(8,12,20,0.98) 0%, rgba(6,9,16,0.98) 100%)'
              : 'linear-gradient(180deg, rgba(252,254,255,0.98) 0%, rgba(244,248,255,0.98) 100%)',
            borderRight: `1px solid ${borderColor}`,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            background: isDark
              ? 'linear-gradient(180deg, rgba(12, 18, 30, 0.92) 0%, rgba(8, 14, 24, 0.92) 100%)'
              : '#ffffff',
            border: `1px solid ${borderColor}`,
            boxShadow: glowShadow,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            background: isDark
              ? 'linear-gradient(180deg, rgba(12, 18, 30, 0.94) 0%, rgba(8, 14, 24, 0.94) 100%)'
              : '#ffffff',
            border: `1px solid ${borderColor}`,
            boxShadow: glowShadow,
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 34,
            color: 'inherit',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            margin: '8px 8px',
            color: isDark ? '#b9c8e6' : '#243459',
            '&:hover': {
              background: isDark
                ? 'linear-gradient(90deg, rgba(97, 122, 214, 0.2) 0%, rgba(109, 77, 201, 0.2) 100%)'
                : 'linear-gradient(90deg, rgba(95, 134, 255, 0.14) 0%, rgba(138, 99, 255, 0.14) 100%)',
              color: isDark ? '#ecf2ff' : '#142147',
            },
            '&.Mui-selected': {
              background: isDark
                ? 'linear-gradient(90deg, rgba(102, 128, 225, 0.32) 0%, rgba(133, 84, 236, 0.36) 100%)'
                : 'linear-gradient(90deg, rgba(95, 134, 255, 0.25) 0%, rgba(138, 99, 255, 0.25) 100%)',
              color: isDark ? '#f2f6ff' : '#111a34',
              border: `1px solid ${alpha('#8ca4ff', isDark ? 0.34 : 0.25)}`,
              boxShadow: isDark
                ? '0 8px 20px rgba(84, 106, 194, 0.24)'
                : '0 8px 20px rgba(84, 106, 194, 0.14)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            fontWeight: 600,
            fontFamily: ['"Sora"', '"Manrope"', '"Segoe UI"', 'sans-serif'].join(','),
          },
          contained: {
            background: 'linear-gradient(120deg, #5f86ff 0%, #8a63ff 100%)',
            boxShadow: '0 12px 24px rgba(82, 104, 195, 0.3)',
            '&:hover': {
              background: 'linear-gradient(120deg, #7598ff 0%, #9a75ff 100%)',
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(6, 12, 22, 0.85)' : '#f6f8fc',
            '& fieldset': {
              borderColor: borderColor,
            },
            '&:hover fieldset': {
              borderColor: alpha('#8ba8ff', 0.6),
            },
            '&.Mui-focused fieldset': {
              borderColor: alpha('#8ba8ff', 0.95),
              boxShadow: `0 0 0 3px ${alpha('#7b8dff', 0.2)}`,
            },
          },
          input: {
            paddingTop: 10,
            paddingBottom: 10,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            background: isDark ? 'rgba(9, 14, 24, 0.94)' : '#1f2b4a',
            border: `1px solid ${borderColor}`,
          },
        },
      },
    },
  })
}

export default createAppTheme
