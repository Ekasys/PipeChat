export interface EkchatChat {
  id: string
  title: string
  model: string
  created_at?: string
  updated_at?: string
}

export interface EkchatMessage {
  id?: string
  role: 'user' | 'assistant' | string
  content: string
  ts?: string
}

export interface StreamEvent {
  event: string
  data: any
}

export interface RfpFileItem {
  id: string
  name: string
  mime_type?: string
  size?: number
  created_at?: string
}

export interface CapabilityMatrixRow {
  rfp_requirement_id: string
  capability_area: string
  requirement_text: string
  clause_breakdown?: string
  coverage_score?: number
  clause_level_findings?: string
  evidence_summary?: string
  evidence_source?: string
  gaps_actions?: string
}

export interface ShredRow {
  section: string
  requirement: string
}

export interface DataTableItem {
  id: string
  name: string
  source_file_id?: string
  sheet?: string
  n_rows?: number
  parse_error?: string
  columns?: Array<{ name: string; kind: string }>
}

export interface DataPreviewResult {
  table_id: string
  columns: Array<{ name: string; kind: string }>
  rows: Array<Record<string, any>>
  n_rows: number
  sheet?: string
}

export type RfpExportFormat = 'txt' | 'md' | 'docx' | 'pdf'

const EKCHAT_BASE = '/api/ekchat/v1'

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = localStorage.getItem('accessToken')
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function extractFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get('content-disposition') || response.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i)
  return match?.[1] || fallback
}

async function* streamSseFromEndpoint(
  endpoint: string,
  body: Record<string, unknown>,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Streaming request failed with status ${response.status}`)
  }

  if (!response.body) {
    throw new Error('No response stream available')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let pendingEvent = 'message'

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''

    for (const block of blocks) {
      const lines = block.split('\n')
      let eventName = pendingEvent
      let dataPayload = ''

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        }
        if (line.startsWith('data:')) {
          dataPayload += line.slice(5).trim()
        }
      }

      if (!dataPayload) continue

      let parsed: any = dataPayload
      try {
        parsed = JSON.parse(dataPayload)
      } catch {
        // Keep raw payload.
      }

      pendingEvent = eventName
      yield { event: eventName, data: parsed }
    }
  }
}

export async function getModels(): Promise<string[]> {
  const response = await fetch(`${EKCHAT_BASE}/models`, {
    headers: authHeaders(),
  })
  const body = await parseJson<{ models: string[] }>(response)
  return body.models || []
}

export async function listChats(): Promise<EkchatChat[]> {
  const response = await fetch(`${EKCHAT_BASE}/chats`, {
    headers: authHeaders(),
  })
  const body = await parseJson<{ chats: EkchatChat[] }>(response)
  return body.chats || []
}

export async function createChat(model: string, title?: string): Promise<EkchatChat> {
  const response = await fetch(`${EKCHAT_BASE}/chats`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ model, title }),
  })
  const body = await parseJson<{ chat: EkchatChat }>(response)
  return body.chat
}

export async function getChatMessages(chatId: string): Promise<EkchatMessage[]> {
  const response = await fetch(`${EKCHAT_BASE}/chats/${chatId}/messages`, {
    headers: authHeaders(),
  })
  const body = await parseJson<{ messages: EkchatMessage[] }>(response)
  return body.messages || []
}

export async function setChatModel(chatId: string, model: string): Promise<void> {
  const response = await fetch(`${EKCHAT_BASE}/chats/${chatId}/model`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ model }),
  })
  await parseJson(response)
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  const response = await fetch(`${EKCHAT_BASE}/chats/${chatId}/title`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title }),
  })
  await parseJson(response)
}

export async function deleteChat(chatId: string): Promise<void> {
  const response = await fetch(`${EKCHAT_BASE}/chats/${chatId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  await parseJson(response)
}

export async function listFiles(chatId: string): Promise<Array<{ id: string; name: string; size?: number }>> {
  const response = await fetch(`${EKCHAT_BASE}/files/list?chat_id=${encodeURIComponent(chatId)}`, {
    headers: authHeaders(),
  })
  const body = await parseJson<{ files: Array<{ id: string; name: string; size?: number }> }>(response)
  return body.files || []
}

export async function uploadFile(chatId: string, file: File): Promise<void> {
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('file', file)

  const response = await fetch(`${EKCHAT_BASE}/files/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })

  await parseJson(response)
}

export async function* streamMessage(
  chatId: string,
  content: string,
  model?: string,
): AsyncGenerator<StreamEvent> {
  yield* streamSseFromEndpoint(`${EKCHAT_BASE}/chats/${chatId}/message`, { content, model })
}

export async function* streamWebSearch(
  chatId: string,
  query: string,
  model?: string,
): AsyncGenerator<StreamEvent> {
  yield* streamSseFromEndpoint(`${EKCHAT_BASE}/chats/${chatId}/websearch`, {
    content: query,
    model,
  })
}

export async function uploadRfpHistoryFiles(files: File[]): Promise<Array<{ id: string; name: string; size?: number }>> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))

  const response = await fetch(`${EKCHAT_BASE}/rfp/history/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  const body = await parseJson<{ uploaded: Array<{ id: string; name: string; size?: number }> }>(response)
  return body.uploaded || []
}

export async function listRfpHistoryFiles(): Promise<RfpFileItem[]> {
  const response = await fetch(`${EKCHAT_BASE}/rfp/history/list`, {
    headers: authHeaders(),
  })
  const body = await parseJson<{ files: RfpFileItem[] }>(response)
  return body.files || []
}

export async function deleteRfpHistoryFile(name: string): Promise<RfpFileItem[]> {
  const response = await fetch(`${EKCHAT_BASE}/rfp/history/delete`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  })
  const body = await parseJson<{ files: RfpFileItem[] }>(response)
  return body.files || []
}

export async function uploadRfpAnalyzeFiles(files: File[]): Promise<Array<{ id: string; name: string; size?: number }>> {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))

  const response = await fetch(`${EKCHAT_BASE}/rfp/analyze/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  const body = await parseJson<{ uploaded: Array<{ id: string; name: string; size?: number }> }>(response)
  return body.uploaded || []
}

export async function listRfpAnalyzeFiles(): Promise<RfpFileItem[]> {
  const response = await fetch(`${EKCHAT_BASE}/rfp/analyze/list`, {
    headers: authHeaders(),
  })
  const body = await parseJson<{ files: RfpFileItem[] }>(response)
  return body.files || []
}

export async function deleteRfpAnalyzeFile(name: string): Promise<RfpFileItem[]> {
  const response = await fetch(`${EKCHAT_BASE}/rfp/analyze/delete`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  })
  const body = await parseJson<{ files: RfpFileItem[] }>(response)
  return body.files || []
}

export async function generateCapabilityMatrix(
  rfpName: string,
  model?: string,
): Promise<{ matrix: any; rows: CapabilityMatrixRow[] }> {
  const response = await fetch(`${EKCHAT_BASE}/rfp/capability-matrix/generate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ rfp_name: rfpName, model }),
  })
  const body = await parseJson<{ matrix: any; rows: CapabilityMatrixRow[] }>(response)
  return { matrix: body.matrix, rows: body.rows || [] }
}

export async function generateShredDocument(
  rfpName: string,
  model?: string,
): Promise<{ document: any; rows: ShredRow[] }> {
  const response = await fetch(`${EKCHAT_BASE}/rfp/shred-document/generate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ rfp_name: rfpName, model }),
  })
  const body = await parseJson<{ document: any; rows: ShredRow[] }>(response)
  return { document: body.document, rows: body.rows || [] }
}

export async function listDataTables(chatId: string): Promise<DataTableItem[]> {
  const response = await fetch(`${EKCHAT_BASE}/data/tables?chat_id=${encodeURIComponent(chatId)}`, {
    headers: authHeaders(),
  })
  const body = await parseJson<{ tables: DataTableItem[] }>(response)
  return body.tables || []
}

export async function previewDataTable(chatId: string, table: string, limit = 20): Promise<DataPreviewResult> {
  const params = new URLSearchParams({
    chat_id: chatId,
    table,
    limit: String(limit),
  })
  const response = await fetch(`${EKCHAT_BASE}/data/preview?${params.toString()}`, {
    headers: authHeaders(),
  })
  return parseJson<DataPreviewResult>(response)
}

export async function generateDataPlot(payload: {
  chat_id: string
  table: string
  x?: string
  y?: string
  kind?: string
  name?: string
}): Promise<{ ok: boolean; plot: { id: string; name: string; kind?: string; x?: string; y?: string; url: string } }> {
  const response = await fetch(`${EKCHAT_BASE}/data/plot`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  return parseJson(response)
}

export async function downloadCapabilityMatrixExport(
  matrixId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    `${EKCHAT_BASE}/rfp/capability-matrix/export?matrix_id=${encodeURIComponent(matrixId)}`,
    { headers: authHeaders() },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }
  return {
    blob: await response.blob(),
    filename: extractFileName(response, 'capability-matrix.csv'),
  }
}

export async function downloadShredDocumentExport(
  documentId: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    `${EKCHAT_BASE}/rfp/shred-document/export?document_id=${encodeURIComponent(documentId)}`,
    { headers: authHeaders() },
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }
  return {
    blob: await response.blob(),
    filename: extractFileName(response, 'shred-document.csv'),
  }
}

export async function generateRfpResponseFromFile(
  file: File,
  model?: string,
): Promise<{ response_id: string; filename: string; content: string }> {
  const form = new FormData()
  form.append('file', file)
  if (model) {
    form.append('model', model)
  }

  const response = await fetch(`${EKCHAT_BASE}/rfp/response/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  return parseJson<{ response_id: string; filename: string; content: string }>(response)
}

export async function exportRfpResponse(
  payload: {
    response_id?: string
    content?: string
    filename?: string
    format: RfpExportFormat
  },
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${EKCHAT_BASE}/rfp/response/export`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  const fallbackName = `rfp-response.${payload.format}`
  return {
    blob: await response.blob(),
    filename: extractFileName(response, fallbackName),
  }
}
