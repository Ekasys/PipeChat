import { Box, CircularProgress, Typography } from '@mui/material'

interface LoadingSpinnerProps {
  message?: string
  fullScreen?: boolean
}

export default function LoadingSpinner({ message, fullScreen = false }: LoadingSpinnerProps) {
  const content = (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
      sx={fullScreen ? { minHeight: '100vh' } : { py: 4 }}
    >
      <CircularProgress
        size={fullScreen ? 60 : 40}
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          '& .MuiCircularProgress-circle': {
            stroke: 'url(#gradient)',
          },
        }}
      />
      {message && (
        <Typography variant="body1" color="text.secondary">
          {message}
        </Typography>
      )}
      <svg width={0} height={0}>
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  )

  return content
}

