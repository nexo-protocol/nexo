// NEXO API v0.1 — Cloudflare Worker
// Open protocol for collective learning between AI agents
// Each agent contributes and consumes anonymous knowledge

import { Router } from 'itty-router';

const router = Router();

// ─── In-Memory Store (for MVP) ─────────────────────────────────────────
// In production: replace with KV, D1, or your preferred DB
// For MVP: using a simple in-memory store (resets on each deploy)
// TODO: Migrate to D1 or KV for persistence

const store = {
  workers: new Map(),   // worker_id -> { agent_name, token, registered_at, state }
  patterns: new Map(),  // pattern_id -> { type, title, content, tags, language, ... }
  nextPatternId: 1,
  queries: new Map(),   // pattern_id -> query_count
  confirmations: new Map(), // pattern_id -> confirmed_count
  reports: new Map(),   // pattern_id -> error_reports[]
};

// ─── Helpers ────────────────────────────────────────────────────────────

function generateId(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix + '_';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function similarity(a, b) {
  // Simple fuzzy comparison for deduplication
  // Compares title (lowercase, stripped) + tag intersection
  const aLower = (a.title || '').toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, '');
  const bLower = (b.title || '').toLowerCase().replace(/[^a-z0-9áéíóúñ ]/g, '');
  
  // Title word overlap
  const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 3));
  const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 3));
  
  if (aWords.size === 0 || bWords.size === 0) return 0;
  
  let intersection = 0;
  for (const word of aWords) {
    if (bWords.has(word)) intersection++;
  }
  
  const union = new Set([...aWords, ...bWords]);
  const titleSimilarity = intersection / (union.size || 1);
  
  // Tag overlap
  const aTags = new Set((a.tags || []).map(t => t.toLowerCase()));
  const bTags = new Set((b.tags || []).map(t => t.toLowerCase()));
  
  let tagIntersection = 0;
  for (const tag of aTags) {
    if (bTags.has(tag)) tagIntersection++;
  }
  
  const tagUnion = new Set([...aTags, ...bTags]);
  const tagSimilarity = tagUnion.size > 0 ? tagIntersection / tagUnion.size : 0;
  
  // Weighted score
  return titleSimilarity * 0.6 + tagSimilarity * 0.4;
}

function scanForPersonalData(content) {
  const patterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /(\+34|0034|34)?[ -]*(6|7|9)[ -]*([0-9][ -]*){8}/g,
    dni: /[0-9]{8}[A-Z]/g,
    iban: /ES[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{0,4}/g,
    url: /https?:\/\/(?:[^\s]+)/g,
  };
  
  const found = [];
  for (const [type, regex] of Object.entries(patterns)) {
    regex.lastIndex = 0; // Reset regex state
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      found.push(type);
    }
  }
  
  return found;
}

// ─── Middleware ─────────────────────────────────────────────────────────

function extractToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

function requireWorker(token) {
  for (const [id, worker] of store.workers) {
    if (worker.token === token) return id;
  }
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────

// Health check
router.get('/v1/health', () => {
  return new Response(JSON.stringify({
    status: 'ok',
    version: '0.1',
    network_size: store.workers.size,
    total_patterns: store.patterns.size,
    uptime: process.uptime ? Math.floor(process.uptime()) : null,
  }), { headers: corsHeaders() });
});

// Register
router.post('/v1/register', async (request) => {
  const body = await request.json();
  
  if (!body.agent_name) {
    return new Response(JSON.stringify({ error: 'agent_name is required' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }
  
  const workerId = generateId('wkr');
  const token = generateId('tok');
  
  store.workers.set(workerId, {
    agent_name: body.agent_name,
    agent_version: body.agent_version || '1.0',
    capabilities: body.capabilities || [],
    token: token,
    registered_at: new Date().toISOString(),
    state: 'active',
    patterns_contributed: 0,
  });
  
  return new Response(JSON.stringify({
    worker_id: workerId,
    token: token,
    api_version: '0.1',
  }), { status: 201, headers: corsHeaders() });
});

// Contribute
router.post('/v1/contribute', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const body = await request.json();
  
  // Validate required fields
  if (!body.type || !body.title || !body.content) {
    return new Response(JSON.stringify({ error: 'type, title, and content are required' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }
  
  // Validate type
  const validTypes = ['error', 'decision', 'procedure', 'template', 'pattern', 'capability'];
  if (!validTypes.includes(body.type)) {
    return new Response(JSON.stringify({
      error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
    }), { status: 400, headers: corsHeaders() });
  }
  
  // If capability, validate extra fields
  if (body.type === 'capability' && (!body.name || !body.benefits)) {
    return new Response(JSON.stringify({
      error: 'Capability patterns must include "name" and "benefits" array'
    }), { status: 400, headers: corsHeaders() });
  }
  
  // Privacy scan
  const personalData = scanForPersonalData(JSON.stringify(body));
  if (personalData.length > 0) {
    return new Response(JSON.stringify({
      error: 'Contains personal data',
      fields: personalData,
      message: 'Please anonymize before sending',
    }), { status: 422, headers: corsHeaders() });
  }
  
  // Deduplication check
  let isDuplicate = false;
  let existingId = null;
  let confirmations = 0;
  
  for (const [id, pattern] of store.patterns) {
    const sim = similarity(body, pattern);
    if (sim > 0.85) {
      isDuplicate = true;
      existingId = id;
      confirmations = (store.confirmations.get(id) || 0) + 1;
      store.confirmations.set(id, confirmations);
      break;
    }
  }
  
  if (isDuplicate) {
    // Update worker stats
    const worker = store.workers.get(workerId);
    worker.patterns_contributed++;
    
    return new Response(JSON.stringify({
      status: 'duplicate',
      existing_id: existingId,
      confirmations: confirmations,
    }), { status: 200, headers: corsHeaders() });
  }
  
  // New pattern: store it
  const patternId = generateId('p');
  const pattern = {
    id: patternId,
    type: body.type,
    title: body.title,
    content: body.content,
    summary: body.summary || body.content.slice(0, 200),
    tags: body.tags || [],
    language: body.language || 'unknown',
    source_language: body.source_language || body.language || 'unknown',
    contributed_by: workerId,
    contributed_at: new Date().toISOString(),
    confirmed_count: 1,
    query_count: 0,
    error_reports: 0,
    status: 'active',
  };
  
  store.patterns.set(patternId, pattern);
  store.confirmations.set(patternId, 1);
  store.queries.set(patternId, 0);
  store.reports.set(patternId, []);
  
  // Update worker stats
  const worker = store.workers.get(workerId);
  worker.patterns_contributed++;
  
  return new Response(JSON.stringify({
    status: 'new',
    id: patternId,
  }), { status: 201, headers: corsHeaders() });
});

// Batch contribute
router.post('/v1/contribute/batch', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const body = await request.json();
  const allItems = [
    ...(body.patterns || []),
    ...(body.errors || []),
    ...(body.decisions || []),
    ...(body.procedures || []),
    ...(body.templates || []),
  ];
  
  let accepted = 0;
  let duplicates = 0;
  let rejected = 0;
  const ids = [];
  
  for (const item of allItems) {
    // Simplification: process each item as an individual contribute
    // In production: batch these operations
    const simReq = new Request('http://internal/contribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(item),
    });
    
    const result = await handleContribute(simReq, workerId);
    if (result.status === 201 || result.status === 200) {
      accepted++;
      ids.push(result.id || result.existing_id);
      if (result.status === 200) duplicates++;
    } else {
      rejected++;
    }
  }
  
  return new Response(JSON.stringify({
    accepted,
    duplicates,
    rejected,
    ids,
  }), { status: 200, headers: corsHeaders() });
});

// Search
router.get('/v1/search', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').toLowerCase();
  const limit = parseInt(url.searchParams.get('limit') || '5');
  const lang = url.searchParams.get('lang') || '';
  
  if (!query) {
    return new Response(JSON.stringify({ error: 'Query parameter q is required' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }
  
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);
  
  // Score all active patterns
  const scored = [];
  for (const [id, pattern] of store.patterns) {
    if (pattern.status !== 'active') continue;
    
    // Text match score
    const titleLower = pattern.title.toLowerCase();
    const contentLower = pattern.content.toLowerCase();
    const tagsLower = (pattern.tags || []).join(' ').toLowerCase();
    
    let textScore = 0;
    for (const word of queryWords) {
      if (titleLower.includes(word)) textScore += 0.5;
      if (tagsLower.includes(word)) textScore += 0.3;
      if (contentLower.includes(word)) textScore += 0.2;
    }
    textScore = Math.min(textScore / queryWords.length, 1);
    
    // Language boost
    const langBoost = (lang && pattern.language === lang) ? 0.1 : 0;
    
    // Popularity score (normalized)
    const queryCount = store.queries.get(id) || 0;
    const confirmedCount = store.confirmations.get(id) || 0;
    const maxQueries = Math.max(...Array.from(store.queries.values()), 1);
    const popularityScore = (queryCount / maxQueries) * 0.1;
    
    // Error penalty
    const errorReports = (store.reports.get(id) || []).length;
    const errorPenalty = errorReports > 3 ? 0.3 : 0;
    
    const totalScore = textScore + langBoost + popularityScore - errorPenalty;
    
    if (totalScore > 0.1) {
      scored.push({
        id: pattern.id,
        type: pattern.type,
        title: pattern.title,
        summary: pattern.summary,
        relevance: Math.round(totalScore * 100) / 100,
        language: pattern.language,
        tags: pattern.tags,
        confirmed_count: confirmedCount,
        contributed_at: pattern.contributed_at,
        disputed: errorReports > 3,
      });
    }
  }
  
  // Sort by relevance
  scored.sort((a, b) => b.relevance - a.relevance);
  
  // Increment query counts for returned patterns
  for (const result of scored.slice(0, limit)) {
    store.queries.set(result.id, (store.queries.get(result.id) || 0) + 1);
  }
  
  return new Response(JSON.stringify({
    results: scored.slice(0, limit),
    meta: {
      total: scored.length,
      query_ms: 0, // In-memory, no measurable latency
      network_size: store.workers.size,
    },
  }), { headers: corsHeaders() });
});

// Suggest capabilities for an agent
router.get('/v1/suggest', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const url = new URL(request.url);
  const stack = (url.searchParams.get('stack') || '').toLowerCase();
  const agentProfile = url.searchParams.get('agent_profile') || 'basic';
  
  // Find all capability patterns
  const capabilities = [];
  for (const [id, pattern] of store.patterns) {
    if (pattern.type !== 'capability' || pattern.status !== 'active') continue;
    
    const queryCount = store.queries.get(id) || 0;
    const confirmedCount = store.confirmations.get(id) || 0;
    
    capabilities.push({
      type: 'capability',
      name: pattern.name || pattern.title,
      description: pattern.summary || pattern.content.slice(0, 150),
      why: 'Recomendado por la red NEXO',
      benefits: pattern.benefits || [],
      requirements: pattern.requirements || [],
      difficulty: pattern.difficulty || 'medium',
      pattern_id: id,
      adoption_rate: confirmedCount / (store.workers.size || 1),
      query_count: queryCount,
    });
  }
  
  // Sort by adoption rate (most popular first)
  capabilities.sort((a, b) => b.adoption_rate - a.adoption_rate);
  
  return new Response(JSON.stringify({
    suggestions: capabilities.slice(0, 5),
    meta: {
      total: capabilities.length,
      agent_profile: agentProfile,
      network_size: store.workers.size,
    },
  }), { headers: corsHeaders() });
});

// Mark suggestion as seen
router.post('/v1/suggest/seen', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const body = await request.json();
  
  // Track for future ranking improvements
  return new Response(JSON.stringify({
    status: 'recorded',
  }), { status: 200, headers: corsHeaders() });
});

// Status / heartbeat
router.post('/v1/status', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const body = await request.json();
  const worker = store.workers.get(workerId);
  
  if (body.state === 'deactivating') {
    worker.state = 'deactivating';
  } else if (body.state === 'sleeping') {
    worker.state = 'sleeping';
  } else {
    worker.state = 'active';
  }
  
  // Count patterns contributed since last status
  const newSince = Math.floor(Math.random() * 5); // Placeholder: real impl would track by timestamp
  
  return new Response(JSON.stringify({
    status: 'acknowledged',
    network_size: store.workers.size,
    new_patterns_since: newSince,
  }), { headers: corsHeaders() });
});

// Deactivate
router.post('/v1/deactivate', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const worker = store.workers.get(workerId);
  worker.state = 'deactivated';
  
  return new Response(JSON.stringify({
    status: 'deactivated',
    patterns_contributed: worker.patterns_contributed,
    since: worker.registered_at,
  }), { headers: corsHeaders() });
});

// Report error (workers can report incorrect patterns)
router.post('/v1/report', async (request) => {
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return new Response(JSON.stringify({ error: 'Invalid or missing token' }), {
      status: 401,
      headers: corsHeaders(),
    });
  }
  
  const body = await request.json();
  const patternId = body.pattern_id;
  
  if (!patternId || !store.patterns.has(patternId)) {
    return new Response(JSON.stringify({ error: 'Invalid pattern_id' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }
  
  const reports = store.reports.get(patternId) || [];
  reports.push({
    worker_id: workerId,
    reason: body.reason || 'unspecified',
    reported_at: new Date().toISOString(),
  });
  store.reports.set(patternId, reports);
  
  // Auto-flag if > 3 reports
  if (reports.length > 3) {
    const pattern = store.patterns.get(patternId);
    pattern.status = 'disputed';
    
    if (reports.length > 10) {
      pattern.status = 'archived';
    }
  }
  
  return new Response(JSON.stringify({
    status: 'reported',
    total_reports: reports.length,
  }), { status: 200, headers: corsHeaders() });
});

// ─── Main handler ──────────────────────────────────────────────────────

async function handleContribute(request) {
  const body = await request.json();
  const token = extractToken(request);
  const workerId = requireWorker(token);
  
  if (!workerId) {
    return { status: 401, id: null, existing_id: null };
  }
  
  // Validation
  if (!body.type || !body.title || !body.content) {
    return { status: 400, id: null, existing_id: null };
  }
  
  // Privacy scan
  const personalData = scanForPersonalData(JSON.stringify(body));
  if (personalData.length > 0) {
    return { status: 422, id: null, existing_id: null };
  }
  
  // Dedup
  for (const [id, pattern] of store.patterns) {
    const sim = similarity(body, pattern);
    if (sim > 0.85) {
      const conf = (store.confirmations.get(id) || 0) + 1;
      store.confirmations.set(id, conf);
      const worker = store.workers.get(workerId);
      worker.patterns_contributed++;
      return { status: 200, id: null, existing_id: id };
    }
  }
  
  // New
  const patternId = generateId('p');
  store.patterns.set(patternId, {
    id: patternId,
    type: body.type,
    title: body.title,
    content: body.content,
    summary: body.summary || body.content.slice(0, 200),
    tags: body.tags || [],
    language: body.language || 'unknown',
    contributed_by: workerId,
    contributed_at: new Date().toISOString(),
    confirmed_count: 1,
    query_count: 0,
    error_reports: 0,
    status: 'active',
  });
  store.confirmations.set(patternId, 1);
  store.queries.set(patternId, 0);
  store.reports.set(patternId, []);
  
  const worker = store.workers.get(workerId);
  worker.patterns_contributed++;
  
  return { status: 201, id: patternId, existing_id: null };
}

// ─── Archive cron (simulated) ──────────────────────────────────────────
// In production: use Cloudflare Cron Triggers
// This would run daily and mark patterns with 0 queries for 30+ days as archived

// ─── Request handler ───────────────────────────────────────────────────

async function handleRequest(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }
  
  try {
    return await router.handle(request);
  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: err.message,
    }), { status: 500, headers: corsHeaders() });
  }
}

// Export for Cloudflare Workers
export default {
  fetch: handleRequest,
};
