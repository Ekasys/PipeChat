import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Container, Paper, TextField, Button, Typography, Box, Alert, useTheme, useMediaQuery } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { motion, useReducedMotion } from 'framer-motion'
import { useAppDispatch } from '../hooks/redux'
import { setCredentials } from '../store/slices/authSlice'
import { authService } from '../services/authService'

interface LoginForm {
  username: string
  password: string
  mfa_token?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const prefersReducedMotion = useReducedMotion()
  const [error, setError] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()
  const logoLift = isSmallScreen ? -124 : -164
  const logoDelay = prefersReducedMotion ? 0 : 0.05
  const logoDuration = prefersReducedMotion ? 0.01 : 2.9
  const cardDelay = prefersReducedMotion ? 0 : 2.85

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null)
      const response = await authService.login(data)
      dispatch(setCredentials({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      }))
      navigate('/dashboard')
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes('MFA')) {
        setMfaRequired(true)
      } else {
        setError(err.response?.data?.detail || 'Login failed')
      }
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.background.default,
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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        component={motion.div}
        initial={{ opacity: prefersReducedMotion ? 1 : 0.45 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.01 : 0.8, delay: prefersReducedMotion ? 0 : 2.0, ease: 'easeOut' }}
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
          background: isDark
            ? 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.14) 0%, transparent 52%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.14) 0%, transparent 52%)'
            : 'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 52%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.12) 0%, transparent 52%)',
        }}
      />

      <Box
        component={motion.div}
        initial={{ opacity: 0, scale: 0.97, y: 0 }}
        animate={
          prefersReducedMotion
            ? { opacity: 1, scale: 1, y: logoLift }
            : { opacity: [0, 1, 1, 1], scale: [0.97, 1, 1, 1], y: [0, 0, 0, logoLift] }
        }
        transition={{ duration: logoDuration, delay: logoDelay, ease: 'easeInOut', times: [0, 0.16, 0.82, 1] }}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          textAlign: 'center',
          px: 2,
        }}
      >
        <Box>
          <Typography
            component="h1"
            variant={isSmallScreen ? 'h3' : 'h2'}
            sx={{
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #7fa7ff 0%, #9f7dff 58%, #ef6ea9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 8px 30px rgba(80, 110, 214, 0.35)',
            }}
          >
            PipeChat
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mt: 1,
              color: 'text.secondary',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            AI Proposal Workspace
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 4 }}>
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            minHeight: { xs: 560, sm: 620 },
            display: 'grid',
            alignContent: 'end',
            justifyContent: 'center',
          }}
        >
          <Paper
            component={motion.div}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: cardDelay, duration: prefersReducedMotion ? 0.01 : 0.55, ease: 'easeOut' }}
            sx={{
              p: 4,
              width: '100%',
              background: isDark
                ? `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.94)} 0%, ${alpha('#090d16', 0.97)} 100%)`
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 249, 255, 0.99) 100%)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.28 : 0.2)}`,
              boxShadow: isDark ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : '0 12px 28px rgba(65, 92, 165, 0.14)',
              position: 'relative',
              zIndex: 5,
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              Sign in to PipeChat
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
              Enter your workspace credentials to continue.
            </Typography>
            <form onSubmit={handleSubmit(onSubmit)}>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <TextField
                fullWidth
                label="Username or Email"
                margin="normal"
                {...register('username', { required: 'Username is required' })}
                error={!!errors.username}
                helperText={errors.username?.message}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'var(--pp-dark-50)',
                    transition: 'box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
                    '&:hover': {
                      background: 'var(--pp-dark-70)',
                    },
                    '&.Mui-focused': {
                      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                  },
                }}
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                margin="normal"
                {...register('password', { required: 'Password is required' })}
                error={!!errors.password}
                helperText={errors.password?.message}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'var(--pp-dark-50)',
                    transition: 'box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
                    '&:hover': {
                      background: 'var(--pp-dark-70)',
                    },
                    '&.Mui-focused': {
                      boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
                    },
                  },
                }}
              />
              {mfaRequired && (
                <TextField
                  fullWidth
                  label="MFA Token"
                  margin="normal"
                  {...register('mfa_token', { required: 'MFA token is required' })}
                  error={!!errors.mfa_token}
                  helperText={errors.mfa_token?.message}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      background: 'var(--pp-dark-50)',
                      transition: 'box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
                      '&:hover': {
                        background: 'var(--pp-dark-70)',
                      },
                      '&.Mui-focused': {
                        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
                      },
                    },
                  }}
                />
              )}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  mb: 2,
                  py: 1.5,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
                  },
                }}
              >
                Sign In
              </Button>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Button size="small" variant="text" sx={{ px: 0.5, minWidth: 0, color: 'text.secondary' }}>
                  Forgot password
                </Button>
                <Button size="small" variant="text" sx={{ px: 0.5, minWidth: 0, color: 'text.secondary' }}>
                  Need access
                </Button>
              </Box>
            </form>
          </Paper>
        </Box>
      </Container>
    </Box>
  )
}
