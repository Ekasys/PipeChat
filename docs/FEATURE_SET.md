 # Feature Set Quick Reference
 
 This document summarizes the current product capabilities at a glance.
 
 ## Core Modules
 - Dashboard: KPIs, activity summaries, and recent items.
 - Accounts: Account records with contact and opportunity relationships.
 - Contacts: Contact management tied to accounts.
 - Opportunities: Pipeline tracking with value, owner, PWin, and stage.
 - Proposals: Proposal creation, structure, and document outputs.
 - Proposal Workspace: Guided proposal workflow and collaboration.
 - Teaming: Partner records, fit scoring, and teaming support.
 - PTW (Price-to-Win): Scenario modeling and comparisons.
 - PWin: Probability-of-win tracking and analysis.
 - Market Intel: SAM.gov search and opportunity discovery.
 - AI Assistant: Drafting, parsing, and analysis workflows.
 - Compliance: FedRAMP, NIST 800-53, and CMMC reports.
 - Admin: Users, audit logs, AI providers, tenant settings.
 
 ## Key Workflows
 - Lead to opportunity tracking with account linkage.
 - Opportunity to proposal flow with proposal volumes.
 - PTW scenario comparison to support pricing decisions.
 - Partner fit scoring to support teaming decisions.
 - Market intel search to seed new pipeline items.
 
 ## AI Capabilities
 - RFP parsing and structured extraction.
 - Draft proposal sections and resumes.
 - Risk analysis and win-theme generation.
 - Company profile field generation.
 - Provider abstraction with configurable models.
 
 ## Document Management
 - Upload and validation for supported file types.
 - Proposal volume structure and content generation.
 - Export-ready artifacts (PDF/Excel/JSON in compliance views).
 
 ## Compliance & Governance
 - Compliance report views and export options.
 - Audit log tracking (user actions, resource types, filters).
 - Tenant-level settings for compliance and data residency.
 
 ## User & Access Management
 - Role-based access control (admin, capture, proposal, analyst).
 - User creation and deactivation.
 - Admin password reset with one-time temporary password.
 - JWT-based authentication with refresh support.
 
 ## PWA & Offline
 - Service worker caching for static assets.
 - Offline fallback page for basic continuity.
 
 ## Integrations
 - SAM.gov market intel search.
 - AI provider configuration (OpenAI and extensible providers).
 
 ## Deployment Notes (High Level)
 - Backend: FastAPI + SQLAlchemy + PostgreSQL + Redis.
 - Frontend: React + Vite + Nginx container.
 - Dockerized services with CI/CD to ACR and Container Apps.
 
