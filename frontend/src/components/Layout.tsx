import { ElementType, ReactNode, useEffect, useMemo, useState } from 'react'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  useMediaQuery,
  useTheme,
  IconButton,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  Menu as MenuIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  DashboardRounded,
  WorkOutlineRounded,
  InsightsRounded,
  PeopleOutlineRounded,
  ShowChartRounded,
  CalculateOutlined,
  GroupsOutlined,
  AutoAwesomeRounded,
  ApartmentRounded,
  AdminPanelSettingsRounded,
  ChatBubbleOutlineRounded,
} from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { logout } from '../store/slices/authSlice'
import { useThemeMode } from './ThemeModeContext'
import PWAInstallBanner from './PWAInstallBanner'

interface LayoutProps {
  children: ReactNode
}

const drawerWidth = 272
const mobileDrawerWidth = 0

const pipelineMenuItems: Array<{ text: string; path: string; icon: ElementType }> = [
  { text: 'Dashboard', path: '/dashboard', icon: DashboardRounded },
  { text: 'Opportunities', path: '/opportunities', icon: WorkOutlineRounded },
  { text: 'Market Intelligence', path: '/market-intel', icon: InsightsRounded },
  { text: 'CRM', path: '/crm', icon: PeopleOutlineRounded },
  { text: 'Price-to-Win', path: '/ptw', icon: ShowChartRounded },
  { text: 'PWin Calculator', path: '/pwin', icon: CalculateOutlined },
  { text: 'Teaming', path: '/teaming', icon: GroupsOutlined },
  { text: 'AI Assistant', path: '/ai-assistant', icon: AutoAwesomeRounded },
  { text: 'Company Profile', path: '/company-profile', icon: ApartmentRounded },
  { text: 'Admin', path: '/admin', icon: AdminPanelSettingsRounded },
]

function parseEkchatSelection(search: string) {
  const params = new URLSearchParams(search)
  const mode = params.get('mode')
  const tab = params.get('tab')
  const historySubsection = params.get('historySubsection') || ''
  const analyzeSubsection = params.get('analyzeSubsection') || ''

  const safeMode = mode === 'generate' ? 'generate' : 'chats'
  const safeTab = ['history', 'rfp', 'analyze', 'edit', 'sections'].includes(tab || '')
    ? (tab as 'history' | 'rfp' | 'analyze' | 'edit' | 'sections')
    : undefined

  return {
    mode: safeMode,
    tab: safeTab,
    historySubsection,
    analyzeSubsection,
  }
}

function navItemSx(level: number) {
  const levelPadding = level === 0 ? 2 : level === 1 ? 3 : 4

  return {
    pl: levelPadding,
    pr: 2,
    py: 1,
    borderRadius: 2,
    mx: 1,
    my: 1,
    position: 'relative',
    transition: 'background 180ms ease, transform 180ms ease, box-shadow 180ms ease',
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 8,
      top: 8,
      bottom: 8,
      width: 2,
      borderRadius: 999,
      background: 'transparent',
      transition: 'background 180ms ease',
    },
    '& .MuiListItemIcon-root': {
      minWidth: 32,
      color: 'inherit',
    },
    '& .MuiListItemText-primary': {
      fontSize: level === 0 ? 14.5 : 13.5,
      fontWeight: level === 0 ? 600 : 500,
      letterSpacing: level === 0 ? '0.01em' : 0,
    },
    '&:hover': {
      transform: 'translateX(2px)',
    },
    '&.Mui-selected::before': {
      background: 'linear-gradient(180deg, #72a2ff 0%, #9f7dff 100%)',
    },
    '&.Mui-selected .MuiListItemText-primary': {
      fontWeight: 700,
    },
  }
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const { mode, toggleMode } = useThemeMode()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pipelineOpen, setPipelineOpen] = useState(location.pathname !== '/ekchat')
  const [ekchatOpen, setEkchatOpen] = useState(location.pathname === '/ekchat')
  const [ekchatLibraryOpen, setEkchatLibraryOpen] = useState(
    location.pathname === '/ekchat' && location.search.includes('tab=history')
  )
  const [ekchatAnalyzeOpen, setEkchatAnalyzeOpen] = useState(
    location.pathname === '/ekchat' && location.search.includes('tab=analyze')
  )
  const ekchatSelection = useMemo(() => parseEkchatSelection(location.search), [location.search])
  const isEkchatRoute = location.pathname === '/ekchat'

  const handleLogout = () => {
    dispatch(logout())
    navigate('/login')
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const navigateTo = (path: string, search = '') => {
    navigate(`${path}${search}`)
    if (isMobile) {
      setMobileOpen(false)
    }
  }

  useEffect(() => {
    if (location.pathname === '/ekchat') {
      setEkchatOpen(true)
    } else {
      setPipelineOpen(true)
    }
  }, [location.pathname])

  useEffect(() => {
    if (!isEkchatRoute || ekchatSelection.mode !== 'generate') {
      return
    }
    if (ekchatSelection.tab === 'history') {
      setEkchatLibraryOpen(true)
    }
    if (ekchatSelection.tab === 'analyze') {
      setEkchatAnalyzeOpen(true)
    }
  }, [isEkchatRoute, ekchatSelection.mode, ekchatSelection.tab])

  const isEkchatGenerate = isEkchatRoute && ekchatSelection.mode === 'generate'
  const isEkchatHistory = isEkchatGenerate && (!ekchatSelection.tab || ekchatSelection.tab === 'history')
  const isEkchatAnalyze = isEkchatGenerate && ekchatSelection.tab === 'analyze'

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', height: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: `1px solid ${alpha(theme.palette.primary.light, 0.16)}`,
          ...(isMobile && { zIndex: (theme) => theme.zIndex.drawer + 1 }),
        }}
      >
        <Toolbar sx={{ minHeight: 72, px: { xs: 2, sm: 3 } }}>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #72a2ff 0%, #9f7dff 100%)',
                boxShadow: '0 0 18px rgba(127, 146, 255, 0.66)',
              }}
            />
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                letterSpacing: '0.02em',
              }}
            >
              PipelinePro
            </Typography>
          </Box>
          {!isMobile && (
            <Typography variant="body2" sx={{ mr: 2, color: 'text.secondary', maxWidth: 280 }} noWrap>
              {user?.email}
            </Typography>
          )}
          <IconButton
            color="inherit"
            onClick={toggleMode}
            size="small"
            sx={{
              mr: 1,
              border: `1px solid ${alpha(theme.palette.primary.light, 0.22)}`,
              background: alpha(theme.palette.primary.main, 0.06),
            }}
            title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
          >
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
          <Typography variant="body2" sx={{ cursor: 'pointer', color: 'text.secondary', fontWeight: 600 }} onClick={handleLogout}>
            Logout
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={handleDrawerToggle}
        sx={{
          width: isMobile ? mobileDrawerWidth : drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            borderRight: `1px solid ${alpha(theme.palette.primary.light, 0.17)}`,
          },
        }}
        ModalProps={{ keepMounted: true }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', py: 1, px: 1 }}>
          <List disablePadding>
            <ListItem disablePadding>
              <ListItemButton selected={location.pathname !== '/ekchat'} sx={navItemSx(0)} onClick={() => setPipelineOpen((prev) => !prev)}>
                <ListItemIcon>
                  <DashboardRounded fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="PipelinePro" />
                {pipelineOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </ListItemButton>
            </ListItem>
            <Collapse in={pipelineOpen} timeout="auto" unmountOnExit>
              <List disablePadding>
                {pipelineMenuItems.map((item) => (
                  <ListItem key={item.path} disablePadding>
                    <ListItemButton
                      selected={location.pathname === item.path}
                      sx={navItemSx(1)}
                      onClick={() => navigateTo(item.path)}
                    >
                      <ListItemIcon>
                        <item.icon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Collapse>
            <ListItem disablePadding>
              <ListItemButton selected={isEkchatRoute} sx={navItemSx(0)} onClick={() => setEkchatOpen((prev) => !prev)}>
                <ListItemIcon>
                  <ChatBubbleOutlineRounded fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="EkChat" />
                {ekchatOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </ListItemButton>
            </ListItem>
            <Collapse in={ekchatOpen} timeout="auto" unmountOnExit>
              <List disablePadding>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={isEkchatRoute && ekchatSelection.mode === 'chats'}
                    sx={navItemSx(1)}
                    onClick={() => navigateTo('/ekchat', '?mode=chats')}
                  >
                    <ListItemText primary="Chats" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    selected={isEkchatGenerate}
                    sx={navItemSx(1)}
                    onClick={() => navigateTo('/ekchat', '?mode=generate')}
                  >
                    <ListItemText primary="Generate" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton
                    selected={isEkchatHistory}
                    sx={navItemSx(1)}
                    onClick={() => {
                      setEkchatLibraryOpen((prev) => !prev)
                      navigateTo('/ekchat', '?mode=generate&tab=history')
                    }}
                  >
                    <ListItemText primary="Library" />
                    {ekchatLibraryOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={ekchatLibraryOpen} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={isEkchatHistory && ekchatSelection.historySubsection === 'style'}
                        sx={navItemSx(2)}
                        onClick={() => navigateTo('/ekchat', '?mode=generate&tab=history&historySubsection=style')}
                      >
                        <ListItemText primary="Writing style profile" />
                      </ListItemButton>
                    </ListItem>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={isEkchatHistory && ekchatSelection.historySubsection === 'chat'}
                        sx={navItemSx(2)}
                        onClick={() => navigateTo('/ekchat', '?mode=generate&tab=history&historySubsection=chat')}
                      >
                        <ListItemText primary="Chat with your documents" />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Collapse>

                <ListItem disablePadding>
                  <ListItemButton
                    selected={isEkchatGenerate && ekchatSelection.tab === 'rfp'}
                    sx={navItemSx(1)}
                    onClick={() => navigateTo('/ekchat', '?mode=generate&tab=rfp')}
                  >
                    <ListItemText primary="Draft Proposal" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton
                    selected={isEkchatAnalyze}
                    sx={navItemSx(1)}
                    onClick={() => {
                      setEkchatAnalyzeOpen((prev) => !prev)
                      navigateTo('/ekchat', '?mode=generate&tab=analyze')
                    }}
                  >
                    <ListItemText primary="Analyze Documents" />
                    {ekchatAnalyzeOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                  </ListItemButton>
                </ListItem>
                <Collapse in={ekchatAnalyzeOpen} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={isEkchatAnalyze && ekchatSelection.analyzeSubsection === 'rfp'}
                        sx={navItemSx(2)}
                        onClick={() => navigateTo('/ekchat', '?mode=generate&tab=analyze&analyzeSubsection=rfp')}
                      >
                        <ListItemText primary="Analyze RFP" />
                      </ListItemButton>
                    </ListItem>
                  </List>
                </Collapse>

                <ListItem disablePadding>
                  <ListItemButton
                    selected={isEkchatGenerate && ekchatSelection.tab === 'edit'}
                    sx={navItemSx(1)}
                    onClick={() => navigateTo('/ekchat', '?mode=generate&tab=edit')}
                  >
                    <ListItemText primary="Edit" />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding>
                  <ListItemButton
                    selected={isEkchatGenerate && ekchatSelection.tab === 'sections'}
                    sx={navItemSx(1)}
                    onClick={() => navigateTo('/ekchat', '?mode=generate&tab=sections')}
                  >
                    <ListItemText primary="Sections" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Collapse>
          </List>
        </Box>
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          p: isEkchatRoute ? 0 : { xs: 2, sm: 3 },
          height: '100%',
          minHeight: 0,
          overflow: isEkchatRoute ? 'hidden' : 'auto',
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        {isEkchatRoute ? (
          <>
            <Toolbar />
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</Box>
          </>
        ) : (
          <>
            <Toolbar />
            <PWAInstallBanner />
            {children}
          </>
        )}
      </Box>
    </Box>
  )
}
