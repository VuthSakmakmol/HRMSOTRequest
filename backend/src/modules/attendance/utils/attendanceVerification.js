// backend/src/modules/attendance/utils/attendanceVerification.js

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function toMinutes(hhmm) {
  const raw = s(hhmm)
  const match = raw.match(/^(\d{2}):(\d{2})$/)
  if (!match) return null

  const hh = Number(match[1])
  const mm = Number(match[2])

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function buildShiftWindow(shiftStartTime, shiftEndTime) {
  const startMinutes = toMinutes(shiftStartTime)
  const endMinutes = toMinutes(shiftEndTime)

  if (startMinutes == null || endMinutes == null) {
    return {
      startMinutes: null,
      endMinutes: null,
      expectedEndMinutes: null,
      isCrossMidnightShift: null,
      isValid: false,
    }
  }

  const isCrossMidnightShift = endMinutes <= startMinutes
  const expectedEndMinutes = isCrossMidnightShift ? endMinutes + 24 * 60 : endMinutes

  return {
    startMinutes,
    endMinutes,
    expectedEndMinutes,
    isCrossMidnightShift,
    isValid: true,
  }
}

function normalizeActualClockOutMinutes({
  clockInMinutes,
  clockOutMinutes,
  shiftStartMinutes,
  isCrossMidnightShift,
}) {
  if (clockOutMinutes == null) return null

  let normalized = clockOutMinutes

  if (isCrossMidnightShift) {
    if (normalized <= shiftStartMinutes) {
      normalized += 24 * 60
    }
    return normalized
  }

  if (clockInMinutes != null && normalized < clockInMinutes) {
    normalized += 24 * 60
  }

  return normalized
}

function safeWorkedMinutes(clockInMinutes, normalizedClockOutMinutes) {
  if (clockInMinutes == null || normalizedClockOutMinutes == null) return 0
  if (normalizedClockOutMinutes <= clockInMinutes) return 0
  return normalizedClockOutMinutes - clockInMinutes
}

function resolveDerivedStatusReason(status, fallbackReason = '') {
  const reason = s(fallbackReason)
  if (reason) return reason

  switch (status) {
    case 'LEAVE':
      return 'Imported status indicates leave and there are no punches'
    case 'OFF':
      return 'Imported status indicates off day and there are no punches'
    case 'ABSENT':
      return 'No clock in and no clock out'
    case 'FORGET_SCAN_IN':
      return 'Clock out exists but clock in is missing'
    case 'FORGET_SCAN_OUT':
      return 'Clock in exists but clock out is missing'
    case 'SHIFT_MISMATCH':
      return 'Punches do not align with the assigned shift'
    case 'LATE':
      return 'Clock in is later than the assigned shift start'
    case 'PRESENT':
      return 'Clock in/out align with the assigned shift'
    case 'UNKNOWN':
    default:
      return 'Unable to derive attendance result'
  }
}

function deriveAttendanceResult({
  attendanceDate,
  clockIn,
  clockOut,
  importedStatus,
  employeeMatched,
  shiftMatched,
  shiftTimeMatched,
  shiftStartTime,
  shiftEndTime,
  lateGraceMinutes = 0,
}) {
  const normalizedImportedStatus = upper(importedStatus)
  const hasClockIn = Boolean(s(clockIn))
  const hasClockOut = Boolean(s(clockOut))

  const shiftWindow = buildShiftWindow(shiftStartTime, shiftEndTime)
  const clockInMinutes = toMinutes(clockIn)
  const rawClockOutMinutes = toMinutes(clockOut)

  const normalizedClockOutMinutes = normalizeActualClockOutMinutes({
    clockInMinutes,
    clockOutMinutes: rawClockOutMinutes,
    shiftStartMinutes: shiftWindow.startMinutes,
    isCrossMidnightShift: shiftWindow.isCrossMidnightShift,
  })

  const workedMinutes = safeWorkedMinutes(clockInMinutes, normalizedClockOutMinutes)

  const lateMinutes =
    shiftWindow.isValid && clockInMinutes != null
      ? Math.max(0, clockInMinutes - shiftWindow.startMinutes)
      : 0

  const earlyOutMinutes =
    shiftWindow.isValid && normalizedClockOutMinutes != null
      ? Math.max(0, shiftWindow.expectedEndMinutes - normalizedClockOutMinutes)
      : 0

  const base = {
    attendanceDate: s(attendanceDate),
    hasClockIn,
    hasClockOut,
    isCrossMidnightShift: shiftWindow.isCrossMidnightShift,
    workedMinutes,
    lateMinutes,
    earlyOutMinutes,
    derivedStatus: 'UNKNOWN',
    derivedStatusReason: '',
  }

  if (!employeeMatched) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Employee is not matched to Employee master',
    }
  }

  if (!hasClockIn && !hasClockOut) {
    if (normalizedImportedStatus === 'LEAVE') {
      return {
        ...base,
        derivedStatus: 'LEAVE',
        derivedStatusReason: resolveDerivedStatusReason('LEAVE'),
      }
    }

    if (normalizedImportedStatus === 'OFF') {
      return {
        ...base,
        derivedStatus: 'OFF',
        derivedStatusReason: resolveDerivedStatusReason('OFF'),
      }
    }

    return {
      ...base,
      derivedStatus: 'ABSENT',
      derivedStatusReason: resolveDerivedStatusReason('ABSENT'),
    }
  }

  if (hasClockIn && !hasClockOut) {
    return {
      ...base,
      derivedStatus: 'FORGET_SCAN_OUT',
      derivedStatusReason: resolveDerivedStatusReason('FORGET_SCAN_OUT'),
    }
  }

  if (!hasClockIn && hasClockOut) {
    return {
      ...base,
      derivedStatus: 'FORGET_SCAN_IN',
      derivedStatusReason: resolveDerivedStatusReason('FORGET_SCAN_IN'),
    }
  }

  if (clockInMinutes == null || rawClockOutMinutes == null) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Clock in/out format is invalid',
    }
  }

  if (!shiftWindow.isValid) {
    return {
      ...base,
      derivedStatus: 'UNKNOWN',
      derivedStatusReason: 'Assigned shift time is missing or invalid',
    }
  }

  if (shiftMatched === false || shiftTimeMatched === false) {
    return {
      ...base,
      derivedStatus: 'SHIFT_MISMATCH',
      derivedStatusReason: resolveDerivedStatusReason('SHIFT_MISMATCH'),
    }
  }

  if (lateMinutes > Number(lateGraceMinutes || 0)) {
    return {
      ...base,
      derivedStatus: 'LATE',
      derivedStatusReason: resolveDerivedStatusReason('LATE'),
    }
  }

  return {
    ...base,
    derivedStatus: 'PRESENT',
    derivedStatusReason: resolveDerivedStatusReason('PRESENT'),
  }
}

function mapEmployeeSnapshot(item) {
  return {
    employeeId: item?.employeeId ? String(item.employeeId) : null,
    employeeCode: upper(item?.employeeCode),
    employeeName: s(item?.employeeName),
    departmentId: item?.departmentId ? String(item.departmentId) : null,
    departmentCode: s(item?.departmentCode),
    departmentName: s(item?.departmentName),
    positionId: item?.positionId ? String(item.positionId) : null,
    positionCode: s(item?.positionCode),
    positionName: s(item?.positionName),
  }
}

function mapAttendanceRecord(item) {
  return {
    id: item?._id ? String(item._id) : null,
    importId: item?.importId ? String(item.importId) : null,

    employeeId: item?.employeeId ? String(item.employeeId) : null,
    employeeNo: upper(item?.employeeNo),
    employeeName: s(item?.employeeName),

    importedEmployeeId: upper(item?.importedEmployeeId),
    importedEmployeeName: s(item?.importedEmployeeName),
    importedDepartmentName: s(item?.importedDepartmentName),
    importedPositionName: s(item?.importedPositionName),
    importedShiftName: s(item?.importedShiftName),
    importedStatus: upper(item?.importedStatus),

    departmentId: item?.departmentId ? String(item?.departmentId) : null,
    departmentCode: upper(item?.departmentCode),
    departmentName: s(item?.departmentName),

    positionId: item?.positionId ? String(item?.positionId) : null,
    positionCode: upper(item?.positionCode),
    positionName: s(item?.positionName),

    shiftId: item?.shiftId ? String(item?.shiftId) : null,
    shiftCode: upper(item?.shiftCode),
    shiftName: s(item?.shiftName),
    shiftType: upper(item?.shiftType),
    shiftStartTime: s(item?.shiftStartTime),
    shiftEndTime: s(item?.shiftEndTime),

    attendanceDate: s(item?.attendanceDate),
    clockIn: s(item?.clockIn),
    clockOut: s(item?.clockOut),
    status: upper(item?.status),
    derivedStatusReason: s(item?.derivedStatusReason),
    dayType: upper(item?.dayType),
    matchedBy: upper(item?.matchedBy),
    matchRemark: s(item?.matchRemark),

    employeeMatched: item?.employeeMatched === true,
    nameMatched: typeof item?.nameMatched === 'boolean' ? item.nameMatched : null,
    departmentMatched: typeof item?.departmentMatched === 'boolean' ? item.departmentMatched : null,
    positionMatched: typeof item?.positionMatched === 'boolean' ? item.positionMatched : null,
    shiftMatched: typeof item?.shiftMatched === 'boolean' ? item.shiftMatched : null,
    shiftTimeMatched: typeof item?.shiftTimeMatched === 'boolean' ? item.shiftTimeMatched : null,
    shiftMatchStatus: upper(item?.shiftMatchStatus),

    hasClockIn: typeof item?.hasClockIn === 'boolean' ? item.hasClockIn : Boolean(s(item?.clockIn)),
    hasClockOut: typeof item?.hasClockOut === 'boolean' ? item.hasClockOut : Boolean(s(item?.clockOut)),
    isCrossMidnightShift:
      typeof item?.isCrossMidnightShift === 'boolean' ? item.isCrossMidnightShift : null,
    workedMinutes: Number(item?.workedMinutes || 0),
    lateMinutes: Number(item?.lateMinutes || 0),
    earlyOutMinutes: Number(item?.earlyOutMinutes || 0),

    validationIssues: Array.isArray(item?.validationIssues) ? item.validationIssues : [],

    rawRowNo: Number(item?.rawRowNo || 0),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  }
}

function isAttendedRecord(item) {
  const status = upper(item?.status)
  return ['PRESENT', 'LATE'].includes(status)
}

function isPendingReviewRecord(item) {
  const status = upper(item?.status)
  return ['FORGET_SCAN_IN', 'FORGET_SCAN_OUT'].includes(status)
}

function isShiftValidRecord(item) {
  const status = upper(item?.status)
  if (status === 'SHIFT_MISMATCH') return false
  return upper(item?.shiftMatchStatus) !== 'MISMATCH'
}

function buildRequestedIndex(requestedEmployees = []) {
  const byEmployeeId = new Map()
  const byEmployeeCode = new Map()

  for (const item of requestedEmployees.map(mapEmployeeSnapshot)) {
    const keyById = s(item.employeeId)
    const keyByCode = upper(item.employeeCode)

    if (keyById) byEmployeeId.set(keyById, item)
    if (keyByCode) byEmployeeCode.set(keyByCode, item)
  }

  return { byEmployeeId, byEmployeeCode }
}

function getRequestedEmployeeKey(record, requestedIndex) {
  const employeeId = s(record?.employeeId)
  if (employeeId && requestedIndex.byEmployeeId.has(employeeId)) {
    return employeeId
  }

  const employeeCode = upper(record?.employeeNo)
  if (employeeCode && requestedIndex.byEmployeeCode.has(employeeCode)) {
    const requested = requestedIndex.byEmployeeCode.get(employeeCode)
    return s(requested.employeeId) || employeeCode
  }

  return ''
}

function buildVerificationItem(requested, attendanceRecord) {
  return {
    ...requested,
    attendanceRecordId: attendanceRecord.id,
    importId: attendanceRecord.importId,
    clockIn: attendanceRecord.clockIn,
    clockOut: attendanceRecord.clockOut,
    attendanceStatus: attendanceRecord.status,
    importedStatus: attendanceRecord.importedStatus,
    derivedStatusReason: attendanceRecord.derivedStatusReason,
    attendanceDayType: attendanceRecord.dayType,
    shiftCode: attendanceRecord.shiftCode,
    shiftName: attendanceRecord.shiftName,
    shiftType: attendanceRecord.shiftType,
    shiftStartTime: attendanceRecord.shiftStartTime,
    shiftEndTime: attendanceRecord.shiftEndTime,
    shiftMatched: attendanceRecord.shiftMatched,
    shiftTimeMatched: attendanceRecord.shiftTimeMatched,
    shiftMatchStatus: attendanceRecord.shiftMatchStatus,
    hasClockIn: attendanceRecord.hasClockIn,
    hasClockOut: attendanceRecord.hasClockOut,
    isCrossMidnightShift: attendanceRecord.isCrossMidnightShift,
    workedMinutes: attendanceRecord.workedMinutes,
    lateMinutes: attendanceRecord.lateMinutes,
    earlyOutMinutes: attendanceRecord.earlyOutMinutes,
    validationIssues: attendanceRecord.validationIssues,
  }
}

function verifyAttendanceAgainstOT({
  requestedEmployees = [],
  approvedEmployees = [],
  attendanceRecords = [],
}) {
  const requestedList = requestedEmployees.map(mapEmployeeSnapshot)
  const approvedList = approvedEmployees.map(mapEmployeeSnapshot)
  const requestedIndex = buildRequestedIndex(requestedList)

  const approvedKeySet = new Set(
    approvedList.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const requestedAttendanceMap = new Map()

  for (const rawRecord of attendanceRecords) {
    const record = mapAttendanceRecord(rawRecord)
    const requestedKey = getRequestedEmployeeKey(record, requestedIndex)

    if (!requestedKey) continue
    if (requestedAttendanceMap.has(requestedKey)) continue

    requestedAttendanceMap.set(requestedKey, record)
  }

  const attendedEmployees = []
  const absentFromApproved = []
  const attendedButNotApproved = []
  const shiftMismatchEmployees = []
  const pendingReviewEmployees = []
  const notEligibleEmployees = []

  for (const requested of requestedList) {
    const requestedKey = s(requested.employeeId) || upper(requested.employeeCode)
    const attendanceRecord = requestedAttendanceMap.get(requestedKey)

    if (!attendanceRecord) {
      continue
    }

    const item = buildVerificationItem(requested, attendanceRecord)

    if (!isShiftValidRecord(attendanceRecord)) {
      shiftMismatchEmployees.push(item)
      continue
    }

    if (isPendingReviewRecord(attendanceRecord)) {
      pendingReviewEmployees.push(item)
      continue
    }

    if (isAttendedRecord(attendanceRecord)) {
      attendedEmployees.push(item)

      if (!approvedKeySet.has(requestedKey)) {
        attendedButNotApproved.push(item)
      }

      continue
    }

    notEligibleEmployees.push(item)
  }

  const attendedKeySet = new Set(
    attendedEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const pendingReviewKeySet = new Set(
    pendingReviewEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const shiftMismatchKeySet = new Set(
    shiftMismatchEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  const notEligibleKeySet = new Set(
    notEligibleEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean),
  )

  for (const approved of approvedList) {
    const approvedKey = s(approved.employeeId) || upper(approved.employeeCode)

    if (
      attendedKeySet.has(approvedKey) ||
      pendingReviewKeySet.has(approvedKey) ||
      shiftMismatchKeySet.has(approvedKey) ||
      notEligibleKeySet.has(approvedKey)
    ) {
      continue
    }

    absentFromApproved.push(approved)
  }

  return {
    requestedEmployeeCount: requestedList.length,
    approvedEmployeeCount: approvedList.length,
    actualAttendedCount: attendedEmployees.length,
    absentFromApprovedCount: absentFromApproved.length,
    attendedButNotApprovedCount: attendedButNotApproved.length,
    shiftMismatchCount: shiftMismatchEmployees.length,
    pendingReviewCount: pendingReviewEmployees.length,
    notEligibleCount: notEligibleEmployees.length,
    attendedEmployees,
    absentFromApproved,
    attendedButNotApproved,
    shiftMismatchEmployees,
    pendingReviewEmployees,
    notEligibleEmployees,
  }
}

module.exports = {
  deriveAttendanceResult,
  verifyAttendanceAgainstOT,
}