import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../hooks/redux'
import { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated)
  const accessToken = useAppSelector((state) => state.auth.accessToken)

  if (!isAuthenticated && !accessToken) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

