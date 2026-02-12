# PipelinePro API Documentation

## Base URL
```
http://localhost:8000/api/v1
```

## Authentication

All endpoints (except `/auth/login`) require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123",
  "mfa_token": "123456"  // Optional if MFA enabled
}
```

### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "<refresh_token>"
}
```

## Endpoints

### Dashboard
- `GET /dashboard/metrics` - Get pipeline metrics
- `GET /dashboard/funnel` - Get funnel data
- `GET /dashboard/trends` - Get win/loss trends
- `GET /dashboard/drill-down?group_by=agency` - Get drill-down data
- `GET /dashboard/forecast` - Get forecast data
- `GET /dashboard/export/pdf` - Export as PDF
- `GET /dashboard/export/excel` - Export as Excel
- `GET /dashboard/export/powerpoint` - Export as PowerPoint

### Opportunities
- `GET /opportunities/opportunities` - List opportunities
- `POST /opportunities/opportunities` - Create opportunity
- `GET /opportunities/opportunities/{id}` - Get opportunity
- `PUT /opportunities/opportunities/{id}` - Update opportunity
- `POST /opportunities/opportunities/{id}/contacts` - Add contact
- `GET /opportunities/opportunities/{id}/timeline` - Get timeline
- `POST /opportunities/opportunities/{id}/activities` - Add activity

### Market Intelligence
- `GET /market-intel/intel` - List market intelligence
- `POST /market-intel/intel` - Create market intelligence
- `PATCH /market-intel/intel/{id}/stage` - Update stage (Kanban)
- `GET /market-intel/sam-gov/search?keywords=...` - Search SAM.gov
- `GET /market-intel/intel/{id}/similar` - Find similar opportunities

### CRM
- `GET /crm/accounts` - List accounts
- `POST /crm/accounts` - Create account
- `GET /crm/accounts/{id}/health` - Get relationship health
- `GET /crm/accounts/{id}/org-chart` - Get org chart
- `POST /crm/contacts` - Create contact

### Proposals
- `GET /proposals/proposals` - List proposals
- `POST /proposals/proposals` - Create proposal
- `POST /proposals/proposals/{id}/parse-rfp` - Parse RFP document
- `POST /proposals/proposals/{id}/transition` - Transition phase
- `POST /proposals/proposals/{id}/tasks` - Create task
- `POST /proposals/proposals/{id}/comments` - Add comment

### Price-to-Win
- `POST /ptw/scenarios` - Create PTW scenario
- `GET /ptw/opportunities/{id}/scenarios` - Compare scenarios

### PWin Calculator
- `POST /pwin/scores` - Create PWin score
- `GET /pwin/opportunities/{id}/scores` - Get score history

### AI Assistant
- `POST /ai/parse-rfp` - Parse RFP and generate summary
- `POST /ai/tailor-resume` - Tailor resume to SOW
- `POST /ai/draft-proposal` - Draft proposal section
- `GET /ai/opportunities/{id}/win-themes` - Get win theme suggestions
- `POST /ai/analyze-risks` - Identify risks

### Administration
- `GET /admin/settings` - Get tenant settings
- `PUT /admin/settings` - Update tenant settings
- `GET /admin/users` - List users
- `POST /admin/users` - Create user
- `DELETE /admin/users/{id}` - Deactivate user
- `GET /admin/audit-logs` - Get audit logs
- `GET /admin/compliance-report` - Generate compliance report
- `POST /admin/cleanup` - Clean up old data

### Teaming & Partners
- `GET /teaming/partners` - List partners
- `POST /teaming/partners` - Create partner
- `POST /teaming/partners/{id}/calculate-fit` - Calculate fit score

### Integrations
- `GET /integrations/integrations` - List integrations
- `POST /integrations/integrations/{name}/connect` - Connect integration

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message"
}
```

Common status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API requests are rate-limited to 60 requests per minute per user.

## Multi-Tenancy

All endpoints automatically filter data by tenant based on the authenticated user's tenant_id.

