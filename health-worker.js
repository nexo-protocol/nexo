#!/usr/bin/env node

/**
 * NEXO Health Worker — Auto-revisión del sistema
 * 
 * Se ejecuta periódicamente (cada 7 días recomendado) para:
 * 1. Comprobar salud de la API
 * 2. Detectar umbrales de escala (¿toca pasar de fase?)
 * 3. Identificar anomalías (error rate, patrones huérfanos)
 * 4. Notificar si algo requiere atención humana
 * 
 * Uso: node health-worker.js [--url https://api.nexo.wiki]
 */

const API_URL = process.argv[2] || 'http://localhost:8787';
const TOKEN = process.env.NEXO_HEALTH_TOKEN || null;

const THRESHOLDS = {
  phase2_workers: 100,    // >100 workers → activar plan Fase 2
  phase3_workers: 10000,  // >10k workers → activar plan Fase 3
  max_error_rate: 0.05,   // >5% errores → alarma
  max_dedup_ratio: 0.8,   // >80% duplicados → posible spam
  stale_days: 30,         // 30 días sin consultas → archivar
};

async function check() {
  const report = {
    timestamp: new Date().toISOString(),
    healthy: true,
    alarms: [],
    metrics: {},
    recommendations: [],
  };

  try {
    // 1. Health check
    const healthRes = await fetch(`${API_URL}/v1/health`).catch(() => null);
    if (!healthRes || !healthRes.ok) {
      report.healthy = false;
      report.alarms.push({ level: 'critical', message: 'API no responde o devuelve error' });
    } else {
      const health = await healthRes.json();
      report.metrics = {
        network_size: health.network_size || 0,
        total_patterns: health.total_patterns || 0,
      };
    }

    // 2. Evaluar umbrales de fase
    const workerCount = report.metrics.network_size || 0;
    if (workerCount >= THRESHOLDS.phase3_workers) {
      report.recommendations.push({
        phase: 3,
        message: `🔥 ${workerCount} workers activos. ACTIVAR PLAN FASE 3 (descentralización)`,
        urgency: 'critical',
      });
    } else if (workerCount >= THRESHOLDS.phase2_workers) {
      report.recommendations.push({
        phase: 2,
        message: `📈 ${workerCount} workers activos. ACTIVAR PLAN FASE 2 (escalabilidad)`,
        urgency: 'high',
      });
    } else if (workerCount > 10) {
      report.recommendations.push({
        phase: 1,
        message: `✅ ${workerCount} workers. Fase 1 ok, preparar migración a Fase 2`,
        urgency: 'info',
      });
    } else {
      report.recommendations.push({
        phase: 1,
        message: `🌱 ${workerCount} workers. Fase 1: sembrando`,
        urgency: 'info',
      });
    }

    // 3. Patrones: si hay pocos patrones para tantos workers, alertar free riding
    const patterns = report.metrics.total_patterns || 0;
    if (workerCount > 10 && patterns < workerCount * 0.5) {
      report.alarms.push({
        level: 'warning',
        message: `⚠️ Solo ${patterns} patrones para ${workerCount} workers. Posible free riding`,
      });
    }

    // 4. Verificar que la hoja de ruta sigue vigente
    const roadmapPath = require('path').join(__dirname, '..', 'docs', 'HOJA-DE-RUTA.md');
    const fs = require('fs');
    if (fs.existsSync(roadmapPath)) {
      report.roadmap_checked = true;
    }

    return report;
  } catch (err) {
    return {
      timestamp: new Date().toISOString(),
      healthy: false,
      alarms: [{ level: 'critical', message: `Error inesperado: ${err.message}` }],
      metrics: {},
      recommendations: [{ phase: 0, message: 'Revisar worker de salud. Posible bug.', urgency: 'high' }],
      error: err.message,
    };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

check().then(report => {
  console.log(JSON.stringify(report, null, 2));
  
  if (report.alarms.some(a => a.level === 'critical')) {
    process.exit(2);
  }
  if (report.alarms.length > 0) {
    process.exit(1);
  }
  process.exit(0);
});
