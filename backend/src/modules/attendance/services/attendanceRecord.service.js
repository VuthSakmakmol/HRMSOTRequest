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

  addBooleanFilter(filter, 'employeeMatched', query.employeeMatched)
  addBooleanFilter(filter, 'nameMatched', query.nameMatched)
  addBooleanFilter(filter, 'departmentMatched', query.departmentMatched)
  addBooleanFilter(filter, 'positionMatched', query.positionMatched)
  addBooleanFilter(filter, 'shiftMatched', query.shiftMatched)
  addBooleanFilter(filter, 'shiftTimeMatched', query.shiftTimeMatched)

  if (s(query.attendanceDateFrom) || s(query.attendanceDateTo)) {
    filter.attendanceDate = {}

    if (s(query.attendanceDateFrom)) {
      filter.attendanceDate.$gte = s(query.attendanceDateFrom)
    }

    if (s(query.attendanceDateTo)) {
      filter.attendanceDate.$lte = s(query.attendanceDateTo)
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

async function listRecords(query = {}) {
  const page = normalizePage(query.page)
  const limit = normalizeLimit(query.limit)
  const skip = (page - 1) * limit

  const filter = buildRecordFilter(query)
  const sort = buildRecordSort(query)

  const [items, total] = await Promise.all([
    AttendanceRecord.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    AttendanceRecord.countDocuments(filter),
  ])

  const totalPages = Math.ceil(total / limit) || 1

  return {
    items: items.map(mapRecordItem),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
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