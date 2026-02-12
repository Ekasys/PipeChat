export const API_BASE = (import.meta.env?.VITE_API_BASE || '/api/ekchat/v1').replace(/\/$/, '');

function getAuthToken() {
  return localStorage.getItem('accessToken') || '';
}

function withAuthHeaders(headers = {}) {
  const token = getAuthToken();
  if (!token) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

async function authFetch(input, init = {}) {
  const nextInit = { ...init };
  nextInit.headers = withAuthHeaders(init.headers || {});
  return fetch(input, nextInit);
}

async function readJsonOrText(response) {
  const raw = await response.text().catch(() => '');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { detail: raw };
  }
}

async function ensureOk(response, fallbackMessage) {
  if (response.ok) return;
  const body = await readJsonOrText(response);
  const detail =
    body?.detail || body?.message || body?.error || `Request failed (HTTP ${response.status})`;
  throw new Error(detail || fallbackMessage);
}

function mapSseEvent(eventName, payload) {
  if (eventName === 'delta') {
    return { delta: payload?.content || '' };
  }
  if (eventName === 'done') {
    const content = payload?.content || payload?.text || '';
    return {
      type: 'done',
      content,
      text: payload?.text || content,
      coverage_ids: payload?.coverage_ids,
      anchor_terms_used: payload?.anchor_terms_used,
    };
  }
  if (eventName === 'error') {
    return { error: payload?.message || payload?.error || 'Streaming request failed.' };
  }
  if (eventName === 'row') {
    return { type: 'row', row: payload?.row, index: payload?.index, total_rows: payload?.total_rows };
  }
  if (eventName === 'init') {
    return { type: 'init', ...payload };
  }
  if (eventName === 'meta') {
    const mode = payload?.mode;
    if (mode === 'analysis') {
      return { channel: 'analysis', delta: payload?.content || '' };
    }
    return { type: 'meta', ...payload };
  }
  return payload || {};
}

function parseSseChunks() {
  const decoder = new TextDecoder();
  let buffer = '';

  return {
    push(value) {
      buffer += decoder.decode(value, { stream: true });
      const events = [];
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const lines = chunk.split('\n');
        let eventName = 'message';
        let payloadText = '';
        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            payloadText += line.slice(5).trim();
          }
        }
        if (!payloadText) continue;

        try {
          const parsed = JSON.parse(payloadText);
          events.push(mapSseEvent(eventName, parsed));
        } catch {
          events.push({ error: payloadText });
        }
      }
      return events;
    },
    flush() {
      const remaining = buffer.trim();
      buffer = '';
      return remaining ? [{ error: remaining }] : [];
    },
  };
}

async function* streamSse(url, body, opts = {}) {
  const { signal } = opts;
  const response = await authFetch(url, {
    method: 'POST',
    headers: {
      ...withAuthHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
    },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Streaming request failed (HTTP ${response.status})`);
  }

  const reader = response.body.getReader();
  const parser = parseSseChunks();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const evt of parser.push(value)) {
      yield evt;
    }
  }
  for (const trailing of parser.flush()) {
    yield trailing;
  }
}

export async function getModels() {
  const r = await authFetch(`${API_BASE}/models`);
  await ensureOk(r, 'Failed to fetch models');
  return (await r.json()).models || [];
}

export async function ensureModel(model) {
  const r = await authFetch(`${API_BASE}/models/ensure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  await ensureOk(r, 'Failed to ensure model');
  return await r.json();
}

export async function listChats() {
  const r = await authFetch(`${API_BASE}/chats`);
  await ensureOk(r, 'Failed to list chats');
  return (await r.json()).chats || [];
}

export async function createChat(model, title) {
  const r = await authFetch(`${API_BASE}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, title }),
  });
  await ensureOk(r, 'Failed to create chat');
  return (await r.json()).chat;
}

export async function getChatMessages(chatId) {
  const r = await authFetch(`${API_BASE}/chats/${chatId}/messages`);
  await ensureOk(r, 'Failed to read messages');
  return (await r.json()).messages || [];
}

export async function setChatModel(chatId, model) {
  const r = await authFetch(`${API_BASE}/chats/${chatId}/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  await ensureOk(r, 'Failed to update model');
  return await r.json();
}

export async function deleteChat(chatId) {
  const r = await authFetch(`${API_BASE}/chats/${chatId}`, { method: 'DELETE' });
  await ensureOk(r, 'Failed to delete chat');
  return await r.json();
}

export async function autoTitleChat(chatId, force = false) {
  const r = await authFetch(`${API_BASE}/chats/${chatId}/title/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  await ensureOk(r, 'Failed to auto-title chat');
  return await r.json();
}

export async function listFiles(chatId) {
  const r = await authFetch(`${API_BASE}/files/list?chat_id=${encodeURIComponent(chatId)}`);
  await ensureOk(r, 'Failed to list files');
  return (await r.json()).files || [];
}

export async function uploadFiles(chatId, files) {
  const uploaded = [];
  for (const f of files || []) {
    const fd = new FormData();
    fd.append('chat_id', chatId);
    fd.append('file', f);
    const r = await authFetch(`${API_BASE}/files/upload`, { method: 'POST', body: fd });
    await ensureOk(r, 'Failed to upload files');
    uploaded.push(await r.json());
  }
  return { uploaded };
}

export function fileDownloadUrl(chatId, name) {
  return `${API_BASE}/files/download?chat_id=${encodeURIComponent(chatId)}&name=${encodeURIComponent(name)}`;
}

export async function deleteFile(chatId, name) {
  const r = await authFetch(`${API_BASE}/files/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, name }),
  });
  await ensureOk(r, 'Failed to delete file');
  return await r.json();
}

export async function deleteHistoryFile(name) {
  const r = await authFetch(`${API_BASE}/rfp/history/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  await ensureOk(r, 'Failed to delete history file');
  return await r.json();
}

export async function prepareRfpSections(file, model) {
  const fd = new FormData();
  fd.append('file', file);
  if (model) fd.append('model', model);
  const r = await authFetch(`${API_BASE}/rfp/sections/prepare`, { method: 'POST', body: fd });
  await ensureOk(r, 'Failed to prepare sections');
  return await r.json();
}

export async function generateRfpSection(sessionId, sectionIndex, model) {
  const r = await authFetch(`${API_BASE}/rfp/sections/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, section_index: sectionIndex, model }),
  });
  await ensureOk(r, 'Failed to generate section');
  return await r.json();
}

export async function* streamRfpSection(sessionId, sectionIndex, model, opts = {}) {
  yield* streamSse(
    `${API_BASE}/rfp/sections/generate`,
    { session_id: sessionId, section_index: sectionIndex, model, stream: true },
    opts,
  );
}

export async function* streamCapabilityMatrix(rfpName, model, opts = {}) {
  yield* streamSse(
    `${API_BASE}/rfp/capability-matrix/generate`,
    { rfp_name: rfpName, model, stream: true },
    opts,
  );
}

export async function* streamMessage(chatId, content, model, _userId = 'user-42', opts = {}) {
  const payload = { content, model };
  if (Array.isArray(opts.sources) && opts.sources.length) {
    payload.sources = opts.sources;
  }
  yield* streamSse(`${API_BASE}/chats/${chatId}/message`, payload, opts);
}

export async function* streamWebSearch(chatId, query, opts = {}) {
  yield* streamSse(`${API_BASE}/chats/${chatId}/websearch`, { content: query }, opts);
}
