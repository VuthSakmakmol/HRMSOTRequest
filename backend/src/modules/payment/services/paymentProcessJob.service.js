// backend/src/modules/payment/services/paymentProcessJob.service.js

const crypto = require('crypto')

const { buildPaymentPreview } = require('./paymentCalculation.service')
const { buildPaymentWorkbook } = require('./paymentExcel.service')

const JOB_TTL_MS = 30 * 60 * 1000
const MAX_COMPLETED_JOBS = 50

const jobs = new Map()

function s(value) {
  return String(value ?? '').trim()
}

function nowIso() {
  return new Date().toISOString()
}

function createHttpError(message, status = 400, messageKey = '') {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.messageKey = messageKey
  return error
}

function createJobId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return crypto.randomBytes(16).toString('hex')
}

function getActorLabel(actor = {}) {
  return (
    actor?.loginId ||
    actor?.username ||
    actor?.employeeNo ||
    actor?.email ||
    actor?.accountId ||
    actor?._id ||
    ''
  )
}

function normalizeProgress(value) {
  const number = Math.round(Number(value || 1))
  return Math.min(100, Math.max(1, Number.isFinite(number) ? number : 1))
}

function getJobOrThrow(jobId) {
  const id = s(jobId)
  const job = jobs.get(id)

  if (!job) {
    throw createHttpError('Payment process job not found or expired', 404, 'payment.job.not_found')
  }

  return job
}

function makePublicJob(job, options = {}) {
  const includeResult = options.includeResult === true

  const payload = {
    jobId: job.id,
    type: job.type,
    status: job.status,
    progress: normalizeProgress(job.progress),
    phase: s(job.phase),
    message: s(job.message),
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    error: job.error || null,
    meta: job.meta || {},
    downloadReady: Boolean(job.result?.buffer && job.result?.filename),
    filename: s(job.result?.filename),
  }

  if (includeResult && job.type === 'PREVIEW' && job.status === 'COMPLETED') {
    payload.result = job.result?.data || null
  }

  return payload
}

function updateJob(jobId, patch = {}) {
  const job = getJobOrThrow(jobId)

  const nextMeta = {
    ...(job.meta || {}),
    ...(patch.meta || {}),
  }

  Object.assign(job, {
    ...patch,
    meta: nextMeta,
    updatedAt: nowIso(),
  })

  if (patch.progress !== undefined) {
    job.progress = normalizeProgress(patch.progress)
  }

  jobs.set(job.id, job)
  return job
}

function cleanupJobs() {
  const now = Date.now()
  const completed = []

  for (const [id, job] of jobs.entries()) {
    const ageMs = now - Number(job.createdAtMs || 0)

    if (ageMs > JOB_TTL_MS) {
      jobs.delete(id)
      continue
    }

    if (['COMPLETED', 'FAILED'].includes(job.status)) {
      completed.push(job)
    }
  }

  if (completed.length <= MAX_COMPLETED_JOBS) return

  completed
    .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0))
    .slice(0, completed.length - MAX_COMPLETED_JOBS)
    .forEach((job) => jobs.delete(job.id))
}

function createBaseJob(type, input = {}, actor = {}) {
  cleanupJobs()

  const id = createJobId()
  const createdAt = nowIso()

  const job = {
    id,
    type,
    status: 'QUEUED',
    progress: 1,
    phase: 'QUEUED',
    message: 'Queued payment process',
    createdAt,
    createdAtMs: Date.now(),
    startedAt: '',
    updatedAt: createdAt,
    completedAt: '',
    failedAt: '',
    error: null,
    input,
    actor: {
      label: s(getActorLabel(actor)),
      accountId: s(actor?.accountId || actor?._id),
      loginId: s(actor?.loginId),
    },
    result: null,
    meta: {},
  }

  jobs.set(id, job)
  return job
}

function buildProgressUpdater(jobId) {
  return async (event = {}) => {
    updateJob(jobId, {
      status: 'RUNNING',
      progress: event.progress,
      phase: s(event.phase) || 'RUNNING',
      message: s(event.message) || 'Processing payment',
      meta: {
        processedRequests: event.processedRequests,
        totalRequests: event.totalRequests,
        currentRequestNo: event.currentRequestNo,
        paymentRows: event.paymentRows,
        salaryRows: event.salaryRows,
        salaryValidRows: event.salaryValidRows,
      },
    })
  }
}

async function runPreviewJob(jobId) {
  const job = getJobOrThrow(jobId)

  updateJob(jobId, {
    status: 'RUNNING',
    progress: 2,
    phase: 'STARTED',
    message: 'Starting payment preview',
    startedAt: nowIso(),
  })

  try {
    const data = await buildPaymentPreview({
      ...job.input,
      onProgress: buildProgressUpdater(jobId),
    })

    updateJob(jobId, {
      status: 'COMPLETED',
      progress: 100,
      phase: 'COMPLETED',
      message: 'Payment preview is ready',
      completedAt: nowIso(),
      result: {
        data,
      },
      meta: {
        paymentRows: Array.isArray(data?.items) ? data.items.length : 0,
        totalRequests: Number(data?.otRequestCount || 0),
      },
    })
  } catch (error) {
    updateJob(jobId, {
      status: 'FAILED',
      progress: 100,
      phase: 'FAILED',
      message: error?.message || 'Payment preview failed',
      failedAt: nowIso(),
      error: {
        message: error?.message || 'Payment preview failed',
        messageKey: error?.messageKey || '',
        status: error?.status || error?.statusCode || 500,
      },
    })
  } finally {
    const latestJob = jobs.get(jobId)

    if (latestJob?.input?.salaryFile?.buffer) {
      latestJob.input.salaryFile.buffer = null
    }
  }
}

async function runExportJob(jobId) {
  const job = getJobOrThrow(jobId)

  updateJob(jobId, {
    status: 'RUNNING',
    progress: 2,
    phase: 'STARTED',
    message: 'Starting payment Excel generation',
    startedAt: nowIso(),
  })

  try {
    const data = await buildPaymentPreview({
      ...job.input,
      onProgress: buildProgressUpdater(jobId),
    })

    updateJob(jobId, {
      status: 'RUNNING',
      progress: 96,
      phase: 'BUILDING_EXCEL',
      message: 'Building Excel workbook',
      meta: {
        paymentRows: Array.isArray(data?.items) ? data.items.length : 0,
        totalRequests: Number(data?.otRequestCount || 0),
      },
    })

    const safeFrom = s(job.input.fromDate).replace(/[^\d-]/g, '')
    const safeTo = s(job.input.toDate).replace(/[^\d-]/g, '')

    const buffer = await buildPaymentWorkbook({
      ...data,
      exportedBy: s(job.actor?.label),
    })

    updateJob(jobId, {
      status: 'COMPLETED',
      progress: 100,
      phase: 'COMPLETED',
      message: 'Payment Excel is ready to download',
      completedAt: nowIso(),
      result: {
        filename: `payment-calculation-${safeFrom}-to-${safeTo}.xlsx`,
        buffer,
      },
      meta: {
        paymentRows: Array.isArray(data?.items) ? data.items.length : 0,
        totalRequests: Number(data?.otRequestCount || 0),
      },
    })
  } catch (error) {
    updateJob(jobId, {
      status: 'FAILED',
      progress: 100,
      phase: 'FAILED',
      message: error?.message || 'Payment Excel generation failed',
      failedAt: nowIso(),
      error: {
        message: error?.message || 'Payment Excel generation failed',
        messageKey: error?.messageKey || '',
        status: error?.status || error?.statusCode || 500,
      },
    })
  } finally {
    const latestJob = jobs.get(jobId)

    if (latestJob?.input?.salaryFile?.buffer) {
      latestJob.input.salaryFile.buffer = null
    }
  }
}

function startPaymentPreviewJob(input = {}, actor = {}) {
  const job = createBaseJob('PREVIEW', input, actor)

  setImmediate(() => {
    runPreviewJob(job.id)
  })

  return makePublicJob(job)
}

function startPaymentExportJob(input = {}, actor = {}) {
  const job = createBaseJob('EXPORT', input, actor)

  setImmediate(() => {
    runExportJob(job.id)
  })

  return makePublicJob(job)
}

function getPaymentJobStatus(jobId) {
  const job = getJobOrThrow(jobId)

  return makePublicJob(job, {
    includeResult: job.type === 'PREVIEW',
  })
}

function getPaymentExportDownload(jobId) {
  const job = getJobOrThrow(jobId)

  if (job.type !== 'EXPORT') {
    throw createHttpError('This payment job is not an export job', 400, 'payment.job.not_export')
  }

  if (job.status !== 'COMPLETED' || !job.result?.buffer) {
    throw createHttpError('Payment Excel is not ready yet', 409, 'payment.job.not_ready')
  }

  return {
    filename: s(job.result.filename) || 'payment-calculation.xlsx',
    buffer: job.result.buffer,
  }
}

module.exports = {
  startPaymentPreviewJob,
  startPaymentExportJob,
  getPaymentJobStatus,
  getPaymentExportDownload,
}
