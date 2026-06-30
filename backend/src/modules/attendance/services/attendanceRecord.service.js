// backend/src/modules/attendance/services/attendanceRecord.service.js

const mongoose = require('mongoose')

const AttendanceRecord = require('../models/AttendanceRecord')
const {
  formatYmdToDmy,
  formatDateTimeToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function normalizeDateOnly(value) {
  const raw = s(value)
  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${year}-${pad2(month)}-${pad2(day)}`
    }
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`
  }

  return raw
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createHttpError(message, status = 400) {
  const err = new Error(message)
  err.status = status
  err.statusCode = status
  return err
}

function isValidObjectId(value) {
  return Boolean(s(value)) && mongoose.isValidObjectId(s(value))
}

function toObjectIdOrNull(value) {
  return isValidObjectId(value) ? s(value) : null
}

function toBooleanOrNull(value) {
  if (typeof value === 'boolean') return value

  const raw = upper(value)
  if (raw === 'TRUE') return true
  if (raw === 'FALSE') return false

  return null
}

function normalizePage(value) {
  const page = Number(value || 1)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function normalizeLimit(value) {
  const limit = Number(value || 10)
  if (!Number.isFinite(limit)) return 10
  return Math.min(Math.max(Math.floor(limit), 1), 200)
}

function buildRecordSearchFilter(search) {
  const keyword = s(search)
  if (!keyword) return null

  const regex = new RegExp(escapeRegex(keyword), 'i')

  return {
    $or: [
      { employeeNo: regex },
      { employeeName: regex },

      { importedEmployeeId: regex },
      { importedEmployeeName: regex },
      { importedDepartmentName: regex },
      { importedPositionName: regex },
      { importedShiftName: regex },
      { importedStatus: regex },

      { departmentCode: regex },
      { departmentName: regex },
      { positionCode: regex },
      { positionName: regex },
      { shiftCode: regex },
      { shiftName: regex },
      { shiftType: regex },

      { status: regex },
      { derivedStatusReason: regex },
      { derivedStatusReasonKey: regex },
      { messageKey: regex },
      { dayType: regex },
      { matchedBy: regex },
      { matchRemark: regex },
      { shiftMatchStatus: regex },
      { attendanceSource: regex },
      { validationIssues: regex },

      { 'rawData.Employee ID': regex },
      { 'rawData.Employee No': regex },
      { 'rawData.EmployeeNo': regex },
      { 'rawData.Employee Name': regex },
      { 'rawData.Clock In': regex },
      { 'rawData.Clock Out': regex },
    ],
  }
}

function addObjectIdFilter(filter, field, value) {
  const objectId = toObjectIdOrNull(value)
  if (objectId) {
    filter[field] = objectId
  }
}

function addUpperTextFilter(filter, field, value) {
  const text = upper(value)
  if (text) {
    filter[field] = text
  }
}

function addBooleanFilter(filter, field, value) {
  const bool = toBooleanOrNull(value)
  if (typeof bool === 'boolean') {
    filter[field] = bool
  }
}

function buildRecordFilter(query = {}) {
  const filter = {}

  addObjectIdFilter(filter, 'importId', query.importId)
  addObjectIdFilter(filter, 'employeeId', query.employeeId)
  addObjectIdFilter(filter, 'departmentId', query.departmentId)
  addObjectIdFilter(filter, 'positionId', query.positionId)
  addObjectIdFilter(filter, 'shiftId', query.shiftId)
  addObjectIdFilter(filter, 'lineId', query.lineId)

  // Display/search snapshot only. Real identity remains employeeId ObjectId.
  addUpperTextFilter(filter, 'employeeNo', query.employeeNo)
  addUpperTextFilter(filter, 'status', query.status)
  addUpperTextFilter(filter, 'importedStatus', query.importedStatus)
  addUpperTextFilter(filter, 'dayType', query.dayType)
  addUpperTextFilter(filter, 'matchedBy', query.matchedBy)
  addUpperTextFilter(filter, 'shiftMatchStatus', query.shiftMatchStatus)

  const attendanceSource = upper(query.attendanceSource)
  if (attendanceSource === 'IMPORT') {
    // Historical records created before Scan Station do not have the field.
    filter.$and = filter.$and || []
    filter.$and.push({
      $or: [
        { attendanceSource: 'IMPORT' },
        { attendanceSource: { $exists: false } },
        { attendanceSource: null },
      ],
    })
  } else if (attendanceSource) {
    filter.attendanceSource = attendanceSource
  }

  addBooleanFilter(filter, 'employeeMatched', query.employeeMatched)
  addBooleanFilter(filter, 'nameMatched', query.nameMatched)
  addBooleanFilter(filter, 'departmentMatched', query.departmentMatched)
  addBooleanFilter(filter, 'positionMatched', query.positionMatched)
  addBooleanFilter(filter, 'shiftMatched', query.shiftMatched)
  addBooleanFilter(filter, 'shiftTimeMatched', query.shiftTimeMatched)

  const attendanceDateFrom = normalizeDateOnly(query.attendanceDateFrom)
  const attendanceDateTo = normalizeDateOnly(query.attendanceDateTo)

  if (attendanceDateFrom || attendanceDateTo) {
    filter.attendanceDate = {}

    if (attendanceDateFrom) {
      filter.attendanceDate.$gte = attendanceDateFrom
    }

    if (attendanceDateTo) {
      filter.attendanceDate.$lte = attendanceDateTo
    }
  }

  const searchFilter = buildRecordSearchFilter(query.search)
  if (searchFilter) {
    filter.$and = filter.$and || []
    filter.$and.push(searchFilter)
  }

  return filter
}

function buildRecordSort(query = {}) {
  const direction = query.sortOrder === 'asc' ? 1 : -1

  const sortField =
    {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      attendanceDate: 'attendanceDate',
      employeeNo: 'employeeNo',
      employeeName: 'employeeName',
      departmentName: 'departmentName',
      positionName: 'positionName',
      shiftName: 'shiftName',
      status: 'status',
      importedStatus: 'importedStatus',
      dayType: 'dayType',
      shiftMatchStatus: 'shiftMatchStatus',
      workedMinutes: 'workedMinutes',
      lateMinutes: 'lateMinutes',
      earlyOutMinutes: 'earlyOutMinutes',
      rawRowNo: 'rawRowNo',
    }[query.sortBy] || 'attendanceDate'

  if (sortField === 'attendanceDate') {
    return {
      attendanceDate: direction,
      employeeNo: 1,
      rawRowNo: 1,
      createdAt: -1,
      _id: -1,
    }
  }

  return {
    [sortField]: direction,
    attendanceDate: -1,
    employeeNo: 1,
    createdAt: -1,
    _id: -1,
  }
}

function mapRecordItem(doc = {}) {
  const status = upper(doc.status)
  const messageKey = s(doc.messageKey || doc.derivedStatusReasonKey)

  return {
    id: doc._id ? String(doc._id) : null,
    importId: doc.importId ? String(doc.importId) : null,

    employeeId: doc.employeeId ? String(doc.employeeId) : null,
    employeeNo: upper(doc.employeeNo),
    employeeName: s(doc.employeeName),

    importedEmployeeId: upper(doc.importedEmployeeId),
    importedEmployeeName: s(doc.importedEmployeeName),
    importedDepartmentName: s(doc.importedDepartmentName),
    importedPositionName: s(doc.importedPositionName),
    importedShiftName: s(doc.importedShiftName),
    importedStatus: upper(doc.importedStatus),

    departmentId: doc.departmentId ? String(doc.departmentId) : null,
    departmentCode: upper(doc.departmentCode),
    departmentName: s(doc.departmentName),

    positionId: doc.positionId ? String(doc.positionId) : null,
    positionCode: upper(doc.positionCode),
    positionName: s(doc.positionName),

    shiftId: doc.shiftId ? String(doc.shiftId) : null,
    shiftCode: upper(doc.shiftCode),
    shiftName: s(doc.shiftName),
    shiftType: upper(doc.shiftType),
    shiftStartTime: s(doc.shiftStartTime),
    shiftEndTime: s(doc.shiftEndTime),

    lineId: doc.lineId ? String(doc.lineId) : null,
    lineCode: upper(doc.lineCode),
    lineName: s(doc.lineName),

    attendanceDate: s(doc.attendanceDate),
    attendanceDateDisplay: formatYmdToDmy(doc.attendanceDate),

    attendanceDateValue: doc.attendanceDateValue || null,

    clockIn: s(doc.clockIn),
    clockOut: s(doc.clockOut),
    attendanceSource: upper(doc.attendanceSource || 'IMPORT'),
    lastScanAt: doc.lastScanAt || null,
    lastScanValue: upper(doc.lastScanValue),

    status,
    statusKey: messageKey,
    derivedStatusReason: s(doc.derivedStatusReason),
    derivedStatusReasonKey: s(doc.derivedStatusReasonKey),
    messageKey,

    dayType: upper(doc.dayType),
    matchedBy: upper(doc.matchedBy),
    matchRemark: s(doc.matchRemark),

    employeeMatched: doc.employeeMatched === true,
    nameMatched: typeof doc.nameMatched === 'boolean' ? doc.nameMatched : null,
    departmentMatched: typeof doc.departmentMatched === 'boolean' ? doc.departmentMatched : null,
    positionMatched: typeof doc.positionMatched === 'boolean' ? doc.positionMatched : null,
    shiftMatched: typeof doc.shiftMatched === 'boolean' ? doc.shiftMatched : null,
    shiftTimeMatched: typeof doc.shiftTimeMatched === 'boolean' ? doc.shiftTimeMatched : null,
    shiftMatchStatus: upper(doc.shiftMatchStatus),

    hasClockIn: typeof doc.hasClockIn === 'boolean' ? doc.hasClockIn : Boolean(s(doc.clockIn)),
    hasClockOut: typeof doc.hasClockOut === 'boolean' ? doc.hasClockOut : Boolean(s(doc.clockOut)),
    isCrossMidnightShift:
      typeof doc.isCrossMidnightShift === 'boolean' ? doc.isCrossMidnightShift : null,

    workedMinutes: Number(doc.workedMinutes || 0),
    workedHours: Number(doc.workedMinutes || 0) / 60,

    lateMinutes: Number(doc.lateMinutes || 0),
    earlyOutMinutes: Number(doc.earlyOutMinutes || 0),

    validationIssues: Array.isArray(doc.validationIssues)
      ? doc.validationIssues.map((item) => s(item)).filter(Boolean)
      : [],

    rawRowNo: Number(doc.rawRowNo || 0),
    rawData: doc.rawData || {},

    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,

    createdAt: doc.createdAt || null,
    createdAtDisplay: formatDateTimeToDmy(doc.createdAt),
    createdAtDisplayHm: formatDateTimeToDmyHm(doc.createdAt),

    updatedAt: doc.updatedAt || null,
    updatedAtDisplay: formatDateTimeToDmy(doc.updatedAt),
    updatedAtDisplayHm: formatDateTimeToDmyHm(doc.updatedAt),
  }
}

function hasHeavyFilter(filter = {}) {
  return Boolean(
    Object.keys(filter || {}).length &&
      !(Object.keys(filter || {}).length === 1 && filter.attendanceDate)
  )
}

async function safeCountRecords(filter = {}, fallbackTotal = 0) {
  try {
    const hasFilter = Object.keys(filter || {}).length > 0

    // No filter is common on first load. Estimated count is much faster and avoids
    // crashing the records page when the collection becomes large after import.
    if (!hasFilter) {
      return await AttendanceRecord.estimatedDocumentCount().maxTimeMS(8000)
    }

    // Filtered count is useful, but it must never block the page. The table can
    // still load rows with an approximate total if MongoDB count is slow.
    return await AttendanceRecord.countDocuments(filter).maxTimeMS(8000)
  } catch (error) {
    console.warn('[attendance.records] count fallback:', error?.message || error)
    return fallbackTotal
  }
}

function approximateTotalFromPage(page, limit, itemCount, hasMore) {
  const currentMinimum = (page - 1) * limit + itemCount
  return hasMore ? currentMinimum + limit : currentMinimum
}

async function listRecords(query = {}) {
  const page = normalizePage(query.page)
  const limit = normalizeLimit(query.limit)
  const skip = (page - 1) * limit

  const filter = buildRecordFilter(query)
  const sort = buildRecordSort(query)

  let docs = []

  try {
    docs = await AttendanceRecord.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit + 1)
      .maxTimeMS(120000)
      .lean()
  } catch (error) {
    // Some MongoDB deployments can fail when sorting many imported rows before
    // the compound index is ready. Fall back to a simpler indexed sort instead
    // of returning 500 to the frontend.
    console.warn('[attendance.records] primary query fallback:', error?.message || error)

    docs = await AttendanceRecord.find(filter)
      .sort({ attendanceDate: -1, employeeNo: 1, _id: -1 })
      .skip(skip)
      .limit(limit + 1)
      .maxTimeMS(120000)
      .lean()
  }

  const hasMore = docs.length > limit
  const items = hasMore ? docs.slice(0, limit) : docs
  const fallbackTotal = approximateTotalFromPage(page, limit, items.length, hasMore)
  const total = await safeCountRecords(filter, fallbackTotal)
  const safeTotal = Math.max(Number(total || 0), fallbackTotal)
  const totalPages = Math.ceil(safeTotal / limit) || 1

  return {
    items: items.map(mapRecordItem),
    pagination: {
      page,
      limit,
      total: safeTotal,
      totalPages,
      hasMore: hasMore || page < totalPages,
    },
  }
}

async function getRecordById(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw createHttpError('Invalid attendance record id', 400)
  }

  const doc = await AttendanceRecord.findById(id).lean()

  if (!doc) {
    throw createHttpError('Attendance record not found', 404)
  }

  return mapRecordItem(doc)
}

module.exports = {
  listRecords,
  getRecordById,
  mapRecordItem,
}