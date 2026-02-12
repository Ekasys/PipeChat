import { ReactNode } from 'react'
import { Card, CardProps } from '@mui/material'
import { motion } from 'framer-motion'

interface AnimatedCardProps extends CardProps {
  children: ReactNode
  delay?: number
}

export default function AnimatedCard({ children, delay = 0, ...props }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card {...props}>{children}</Card>
    </motion.div>
  )
}

