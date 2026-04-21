// backend/src/modules/attendance/utils/attendanceVerification.js
function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
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
    attendanceDate: s(item?.attendanceDate),
    clockIn: s(item?.clockIn),
    clockOut: s(item?.clockOut),
    workMinutes:
      item?.workMinutes == null ? null : Number(item.workMinutes || 0),
    otMinutes:
      item?.otMinutes == null ? null : Number(item.otMinutes || 0),
    status: upper(item?.status),
    dayType: upper(item?.dayType),
    matchedBy: upper(item?.matchedBy),
    matchRemark: s(item?.matchRemark),
    rawRowNo: Number(item?.rawRowNo || 0),
    createdAt: item?.createdAt || null,
    updatedAt: item?.updatedAt || null,
  }
}

function isAttendedRecord(item) {
  const status = upper(item?.status)

  if (status === 'PRESENT') return true
  if (['ABSENT', 'LEAVE', 'OFF'].includes(status)) return false

  return Boolean(
    s(item?.clockIn) ||
      s(item?.clockOut) ||
      Number(item?.workMinutes || 0) > 0 ||
      Number(item?.otMinutes || 0) > 0
  )
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

function verifyAttendanceAgainstOT({
  requestedEmployees = [],
  approvedEmployees = [],
  attendanceRecords = [],
}) {
  const requestedList = requestedEmployees.map(mapEmployeeSnapshot)
  const approvedList = approvedEmployees.map(mapEmployeeSnapshot)
  const requestedIndex = buildRequestedIndex(requestedList)

  const approvedKeySet = new Set(
    approvedList.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean)
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

  for (const requested of requestedList) {
    const requestedKey = s(requested.employeeId) || upper(requested.employeeCode)
    const attendanceRecord = requestedAttendanceMap.get(requestedKey)

    if (!attendanceRecord || !isAttendedRecord(attendanceRecord)) {
      continue
    }

    const item = {
      ...requested,
      attendanceRecordId: attendanceRecord.id,
      importId: attendanceRecord.importId,
      clockIn: attendanceRecord.clockIn,
      clockOut: attendanceRecord.clockOut,
      workMinutes: attendanceRecord.workMinutes,
      otMinutes: attendanceRecord.otMinutes,
      attendanceStatus: attendanceRecord.status,
      attendanceDayType: attendanceRecord.dayType,
    }

    attendedEmployees.push(item)

    if (!approvedKeySet.has(requestedKey)) {
      attendedButNotApproved.push(item)
    }
  }

  const attendedKeySet = new Set(
    attendedEmployees.map((item) => s(item.employeeId) || upper(item.employeeCode)).filter(Boolean)
  )

  for (const approved of approvedList) {
    const approvedKey = s(approved.employeeId) || upper(approved.employeeCode)

    if (!attendedKeySet.has(approvedKey)) {
      absentFromApproved.push(approved)
    }
  }

  return {
    requestedEmployeeCount: requestedList.length,
    approvedEmployeeCount: approvedList.length,
    actualAttendedCount: attendedEmployees.length,
    absentFromApprovedCount: absentFromApproved.length,
    attendedButNotApprovedCount: attendedButNotApproved.length,
    attendedEmployees,
    absentFromApproved,
    attendedButNotApproved,
  }
}

module.exports = {
  verifyAttendanceAgainstOT,
}