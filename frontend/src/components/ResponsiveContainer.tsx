import { Box, BoxProps } from '@mui/material'
import { ReactNode } from 'react'

interface ResponsiveContainerProps extends BoxProps {
  children: ReactNode
}

export default function ResponsiveContainer({ children, ...props }: ResponsiveContainerProps) {
  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: { xs: '100%', sm: '600px', md: '960px', lg: '1280px', xl: '1920px' },
        mx: 'auto',
        px: { xs: 2, sm: 3, md: 4 },
        ...props.sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

