import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import OpportunitiesPage from './pages/OpportunitiesPage'
import MarketIntelPage from './pages/MarketIntelPage'
import PWinPage from './pages/PWinPage'
import CRMPage from './pages/CRMPage'
import AccountDetailPage from './pages/AccountDetailPage'
import ContactDetailPage from './pages/ContactDetailPage'
import PTWPage from './pages/PTWPage'
import TeamingPage from './pages/TeamingPage'
import AdminPage from './pages/AdminPage'
import AIAssistantPage from './pages/AIAssistantPage'
import ProposalWorkspacePage from './pages/ProposalWorkspacePage'
import ProposalsPage from './pages/ProposalsPage'
import CompanyProfilePage from './pages/CompanyProfilePage'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import EkchatPage from './features/ekchat/EkchatPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/opportunities" element={<OpportunitiesPage />} />
                <Route path="/opportunities/:opportunityId/proposals" element={<ProposalWorkspacePage />} />
                <Route path="/proposals" element={<ProposalsPage />} />
                <Route path="/market-intel" element={<MarketIntelPage />} />
                <Route path="/crm" element={<CRMPage />} />
                <Route path="/crm/accounts/:id" element={<AccountDetailPage />} />
                <Route path="/crm/contacts/:id" element={<ContactDetailPage />} />
                <Route path="/ptw" element={<PTWPage />} />
                <Route path="/pwin" element={<PWinPage />} />
                <Route path="/teaming" element={<TeamingPage />} />
                <Route path="/ai-assistant" element={<AIAssistantPage />} />
                <Route path="/ekchat" element={<EkchatPage />} />
                <Route path="/company-profile" element={<CompanyProfilePage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
