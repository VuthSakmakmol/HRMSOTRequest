// backend/src/modules/org/services/employeeImportProgress.store.js

function s(value) {
  return String(value ?? '').trim()
}

function clampPercent(value) {
  const number = Number(value || 0)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(100, Math.round(number)))
}

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => s(value))
        .filter(Boolean),
    ),
  ]
}

const jobs = new Map()
const JOB_TTL_MS = 60 * 60 * 1000

function cleanupOldJobs() {
  const now = Date.now()

  for (const [jobId, job] of jobs.entries()) {
    const updatedAtMs = new Date(job.updatedAt || job.createdAt || 0).getTime()

    if (!updatedAtMs || now - updatedAtMs > JOB_TTL_MS) {
      jobs.delete(jobId)
    }
  }
}

function defaultJob(jobId) {
  const now = new Date().toISOString()

  return {
    jobId: s(jobId),
    status: 'WAITING_UPLOAD',
    phase: 'UPLOAD',
    percent: 0,
    messageKey: 'org.employee.importProgress.waitingUpload',
    message: 'Waiting for file upload...',
    totalRows: 0,
    processedRows: 0,
    createdAt: now,
    updatedAt: now,
    completedPhases: [],
  }
}

function startJob(jobId, payload = {}) {
  cleanupOldJobs()

  const cleanJobId = s(jobId)

  if (!cleanJobId) return defaultJob('')

  const now = new Date().toISOString()

  const job = {
    ...defaultJob(cleanJobId),
    ...payload,
    jobId: cleanJobId,
    status: payload.status || 'RUNNING',
    percent: clampPercent(payload.percent ?? 1),
    createdAt: now,
    updatedAt: now,
    completedPhases: uniqueStrings(payload.completedPhases || []),
  }

  jobs.set(cleanJobId, job)

  return job
}

function updateJob(jobId, payload = {}) {
  cleanupOldJobs()

  const cleanJobId = s(jobId)

  if (!cleanJobId) return defaultJob('')

  const previous = jobs.get(cleanJobId) || defaultJob(cleanJobId)

  const nextCompletedPhases = uniqueStrings([
    ...(previous.completedPhases || []),
    ...(payload.completedPhases || []),
  ])

  const next = {
    ...previous,
    ...payload,
    jobId: cleanJobId,
    status: payload.status || previous.status || 'RUNNING',
    percent: clampPercent(payload.percent ?? previous.percent),
    completedPhases: nextCompletedPhases,
    updatedAt: new Date().toISOString(),
  }

  jobs.set(cleanJobId, next)

  return next
}

function completeJob(jobId, payload = {}) {
  return updateJob(jobId, {
    ...payload,
    status: 'SUCCESS',
    phase: 'COMPLETE',
    percent: 100,
    messageKey: payload.messageKey || 'org.employee.importProgress.completed',
    message: payload.message || 'Employee import completed.',
    completedPhases: [
      'UPLOAD',
      'READ_FILE',
      'PARSE_ROWS',
      'VALIDATE_BASIC',
      'MATCH_DEPARTMENT',
      'MATCH_POSITION',
      'MATCH_LINE',
      'MATCH_SHIFT',
      'MATCH_EMPLOYEE',
      'MATCH_ACCOUNT',
      'VALIDATE_RELATION',
      'IMPORT_EMPLOYEE',
      'RESOLVE_MANAGER',
      'CREATE_ACCOUNT',
      'SYNC_MANAGER',
      'COMPLETE',
    ],
  })
}

function failJob(jobId, payload = {}) {
  return updateJob(jobId, {
    ...payload,
    status: 'FAILED',
    messageKey: payload.messageKey || 'org.employee.importProgress.failed',
    message: payload.message || 'Employee import failed.',
  })
}

function getJob(jobId) {
  cleanupOldJobs()

  const cleanJobId = s(jobId)

  if (!cleanJobId) return defaultJob('')

  return jobs.get(cleanJobId) || defaultJob(cleanJobId)
}

module.exports = {
  startJob,
  updateJob,
  completeJob,
  failJob,
  getJob,
}