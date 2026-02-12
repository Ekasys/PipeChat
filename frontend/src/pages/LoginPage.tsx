import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Container, Paper, TextField, Button, Typography, Box, Alert } from '@mui/material'
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
  const [error, setError] = useState<string | null>(null)
  const [mfaRequired, setMfaRequired] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()

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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 
            'radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.2) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(236, 72, 153, 0.2) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography 
            component="h1" 
            variant="h3" 
            gutterBottom
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1,
            }}
          >
            PipelinePro
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, opacity: 0.8 }}>
            GovCon SaaS Platform
          </Typography>
          <Paper 
            sx={{ 
              p: 4, 
              width: '100%',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
            }}
          >
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
                  background: 'rgba(15, 23, 42, 0.5)',
                  '&:hover': {
                    background: 'rgba(15, 23, 42, 0.7)',
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
                  background: 'rgba(15, 23, 42, 0.5)',
                  '&:hover': {
                    background: 'rgba(15, 23, 42, 0.7)',
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
                    background: 'rgba(15, 23, 42, 0.5)',
                    '&:hover': {
                      background: 'rgba(15, 23, 42, 0.7)',
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
          </form>
        </Paper>
      </Box>
    </Container>
    </Box>
  )
}

