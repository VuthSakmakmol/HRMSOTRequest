// backend/src/modules/payment/services/paymentCalculation.service.js

const mongoose = require('mongoose')

const PaymentFormula = require('../models/PaymentFormula.model')
const OTRequest = require('../../ot/models/OTRequest')
const Employee = require('../../org/models/Employee')
const attendanceService = require('../../attendance/services/attendance.service')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function isYMD(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s(value))
}

function createError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  return error
}

function round(value, decimals = 2) {
  const precision = Number(decimals ?? 2)
  const safeDecimals = Number.isInteger(precision) && precision >= 0 ? precision : 2
  const factor = 10 ** safeDecimals

  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeNameForWarning(value) {
  return upper(value).replace(/\s+/g, ' ')
}

function sameNameLoose(a, b) {
  const left = normalizeNameForWarning(a)
  const right = normalizeNameForWarning(b)

  if (!left || !right) return true
  return left === right
}

function employeeKeyFromApprovedRow(row = {}) {
  return s(row.employeeId)
}

function employeeCodeFromApprovedRow(row = {}) {
  return upper(row.employeeCode)
}

function employeeNameFromMasterOrApproved(master = {}, approved = {}) {
  return s(master.displayName || approved.employeeName)
}

function buildEmployeeMasterMap(employees = []) {
  const map = new Map()

  for (const employee of employees) {
    map.set(String(employee._id), employee)
  }

  return map
}

function buildApprovedEmployeeMap(approvedEmployees = []) {
  const map = new Map()

  for (const item of Array.isArray(approvedEmployees) ? approvedEmployees : []) {
    const employeeId = employeeKeyFromApprovedRow(item)
    if (!employeeId) continue

    map.set(employeeId, item)
  }

  return map
}

function makeVerificationKey(row = {}) {
  return s(row.employeeId) || upper(row.employeeCode || row.employeeNo)
}

function buildVerificationRowsMap(verification = {}) {
  const map = new Map()

  const groups = [
    ...(Array.isArray(verification.attendedEmployees)
      ? verification.attendedEmployees
      : []),
    ...(Array.isArray(verification.pendingReviewEmployees)
      ? verification.pendingReviewEmployees
      : []),
    ...(Array.isArray(verification.shiftMismatchEmployees)
      ? verification.shiftMismatchEmployees
      : []),
    ...(Array.isArray(verification.notEligibleEmployees)
      ? verification.notEligibleEmployees
      : []),
  ]

  for (const row of groups) {
    const key = makeVerificationKey(row)
    if (!key) continue

    if (!map.has(key)) {
      map.set(key, row)
    }
  }

  return map
}

function addWarning(warningRows, data = {}) {
  warningRows.push({
    requestNo: s(data.requestNo),
    otDate: s(data.otDate),
    employeeNo: upper(data.employeeNo),
    employeeName: s(data.employeeName),
    reason: s(data.reason),
  })
}

function addMissingSalary(missingSalaryRows, data = {}) {
  missingSalaryRows.push({
    requestNo: s(data.requestNo),
    otDate: s(data.otDate),
    employeeNo: upper(data.employeeNo),
    employeeName: s(data.employeeName),
    positionName: s(data.positionName),
    lineName: s(data.lineName),
    payableHours: toNumber(data.payableHours, 0),
    reason: s(data.reason),
  })
}

function getRequestTime(request = {}) {
  const start = s(request.requestStartTime || request.startTime)
  const end = s(request.requestEndTime || request.endTime)

  if (!start && !end) return ''
  return `${start || '-'} - ${end || '-'}`
}

function getLineName(approved = {}) {
  const lineCode = s(approved.lineCode)
  const lineName = s(approved.lineName)
  const lineLabel = s(approved.lineLabel)

  if (lineLabel) return lineLabel
  if (lineCode && lineName) return `${lineCode} · ${lineName}`
  return lineName || lineCode
}

function getApprovedEmployees(request = {}) {
  return Array.isArray(request.approvedEmployees) ? request.approvedEmployees : []
}

function getFormulaMultiplier(formula = {}, dayType = '') {
  const normalizedDayType = upper(dayType)

  if (!['WORKING_DAY', 'SUNDAY', 'HOLIDAY'].includes(normalizedDayType)) {
    return null
  }

  const value = formula.multipliers?.[normalizedDayType]
  const number = Number(value)

  return Number.isFinite(number) && number >= 0 ? number : null
}

function buildApprovedOTFilter(fromDate, toDate) {
  return {
    status: 'APPROVED',
    otDate: {
      $gte: fromDate,
      $lte: toDate,
    },
  }
}

function buildSalaryWarningRows(salaryMeta = {}) {
  const rows = []

  for (const row of Array.isArray(salaryMeta.invalidRows) ? salaryMeta.invalidRows : []) {
    rows.push({
      requestNo: '',
      otDate: '',
      employeeNo: upper(row.employeeNo),
      employeeName: s(row.name || row.rawName),
      reason: `Salary Excel row ${row.rowNo}: ${row.reason}`,
    })
  }

  for (const row of Array.isArray(salaryMeta.duplicateRows) ? salaryMeta.duplicateRows : []) {
    rows.push({
      requestNo: '',
      otDate: '',
      employeeNo: upper(row.employeeNo),
      employeeName: s(row.name),
      reason: `Salary Excel row ${row.rowNo}: ${row.reason}`,
    })
  }

  return rows
}

function isPayableVerificationRow(row = {}) {
  return upper(row.otResult) === 'MATCH' && toNumber(row.roundedOtMinutes, 0) > 0
}

function buildNonPayableReason(row = {}) {
  const otResult = upper(row.otResult)
  const rawDecision = upper(row.rawOtDecision)
  const attendanceStatus = upper(row.attendanceStatus || row.status)
  const reason = s(row.otResultReason || row.derivedStatusReason)

  if (reason) return reason

  if (otResult && otResult !== 'MATCH') {
    return `Attendance verification result is ${otResult}`
  }

  if (rawDecision) {
    return `Attendance verification decision is ${rawDecision}`
  }

  if (attendanceStatus) {
    return `Attendance status is ${attendanceStatus}`
  }

  return 'Attendance verification is not payable'
}

function pushVerificationGroupWarnings({
  request,
  verification,
  warningRows,
  approvedEmployeeMap,
}) {
  const requestNo = s(request.requestNo)
  const otDate = s(request.otDate)

  const groups = [
    {
      items: verification.absentFromApproved,
      reason: 'Approved OT employee is absent or no attendance record was found',
    },
    {
      items: verification.pendingReviewEmployees,
      reason: 'Attendance is pending review because of forget scan',
    },
    {
      items: verification.shiftMismatchEmployees,
      reason: 'Attendance shift mismatch',
    },
    {
      items: verification.notEligibleEmployees,
      reason: 'Attendance is not eligible for OT payment',
    },
    {
      items: verification.attendedButNotApproved,
      reason: 'Employee attended but is not in final approved OT employee list',
    },
  ]

  const seen = new Set()

  for (const group of groups) {
    for (const row of Array.isArray(group.items) ? group.items : []) {
      const employeeId = s(row.employeeId)
      const employeeNo = upper(row.employeeCode || row.employeeNo)
      const key = employeeId || employeeNo

      if (!key || seen.has(`${group.reason}|${key}`)) continue
      seen.add(`${group.reason}|${key}`)

      if (
        group.reason === 'Employee attended but is not in final approved OT employee list' &&
        employeeId &&
        approvedEmployeeMap.has(employeeId)
      ) {
        continue
      }

      addWarning(warningRows, {
        requestNo,
        otDate,
        employeeNo,
        employeeName: row.employeeName,
        reason: s(row.otResultReason) || group.reason,
      })
    }
  }
}

async function loadEmployeeMasterMapForRequests(requests = []) {
  const employeeIds = []

  for (const request of requests) {
    for (const employee of getApprovedEmployees(request)) {
      const id = s(employee.employeeId)

      if (id && mongoose.isValidObjectId(id)) {
        employeeIds.push(id)
      }
    }
  }

  const uniqueIds = [...new Set(employeeIds)]

  if (!uniqueIds.length) return new Map()

  const employees = await Employee.find({
    _id: {
      $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
    },
  })
    .select({
      _id: 1,
      employeeNo: 1,
      displayName: 1,
      departmentId: 1,
      positionId: 1,
      lineId: 1,
      shiftId: 1,
      isActive: 1,
    })
    .populate({ path: 'departmentId', select: { _id: 1, code: 1, name: 1 } })
    .populate({ path: 'positionId', select: { _id: 1, code: 1, name: 1 } })
    .populate({ path: 'lineId', select: { _id: 1, code: 1, name: 1 } })
    .lean()

  return buildEmployeeMasterMap(employees)
}

async function calculatePaymentExport({
  fromDate,
  toDate,
  formulaId,
  salaryMap,
  salaryMeta,
}) {
  const startDate = s(fromDate)
  const endDate = s(toDate)

  if (!isYMD(startDate)) {
    throw createError('From date must be YYYY-MM-DD', 400)
  }

  if (!isYMD(endDate)) {
    throw createError('To date must be YYYY-MM-DD', 400)
  }

  if (startDate > endDate) {
    throw createError('From date cannot be after To date', 400)
  }

  if (!mongoose.Types.ObjectId.isValid(formulaId)) {
    throw createError('Invalid formula ID', 400)
  }

  if (!(salaryMap instanceof Map)) {
    throw createError('Salary data is invalid', 400)
  }

  const formula = await PaymentFormula.findById(formulaId).lean()

  if (!formula) {
    throw createError('Payment formula not found', 404)
  }

  if (!formula.isActive) {
    throw createError('Selected payment formula is inactive', 400)
  }

  const monthlyWorkingDays = toNumber(formula.monthlyWorkingDays, 0)
  const hoursPerDay = toNumber(formula.hoursPerDay, 0)

  if (monthlyWorkingDays <= 0 || hoursPerDay <= 0) {
    throw createError(
      'Payment formula working days and hours per day must be greater than zero',
      400,
    )
  }

  const requests = await OTRequest.find(buildApprovedOTFilter(startDate, endDate))
    .sort({ otDate: 1, requestNo: 1 })
    .lean()

  const employeeMasterMap = await loadEmployeeMasterMapForRequests(requests)

  const detailRows = []
  const missingSalaryRows = []
  const warningRows = buildSalaryWarningRows(salaryMeta)
  const summaryMap = new Map()

  for (const request of requests) {
    const requestNo = s(request.requestNo)
    const otDate = s(request.otDate)
    const storedDayType = upper(request.dayType)
    const requestTime = getRequestTime(request)
    const approvedEmployees = getApprovedEmployees(request)
    const approvedEmployeeMap = buildApprovedEmployeeMap(approvedEmployees)

    if (!approvedEmployees.length) {
      addWarning(warningRows, {
        requestNo,
        otDate,
        reason: 'Approved OT request has no approvedEmployees',
      })
      continue
    }

    let verificationPayload = null

    try {
      verificationPayload = await attendanceService.verifyOTRequest(request._id)
    } catch (error) {
      addWarning(warningRows, {
        requestNo,
        otDate,
        reason: `Attendance verification failed: ${error.message}`,
      })
      continue
    }

    const verificationOtRequest = verificationPayload?.otRequest || {}

    const internalCalendarDayType = upper(
      verificationOtRequest.internalCalendarDayType ||
        verificationOtRequest.dayType ||
        storedDayType,
    )

    const dayType = internalCalendarDayType

    if (storedDayType && internalCalendarDayType && storedDayType !== internalCalendarDayType) {
      addWarning(warningRows, {
        requestNo,
        otDate,
        reason: `Stored OT day type is ${storedDayType}, but internal calendar says ${internalCalendarDayType}. Payment used ${internalCalendarDayType}.`,
      })
    }

    const multiplier = getFormulaMultiplier(formula, dayType)

    if (multiplier === null) {
      addWarning(warningRows, {
        requestNo,
        otDate,
        reason: `Payment formula has no valid multiplier for internal calendar day type ${dayType}`,
      })
      continue
    }

    const verification = verificationPayload?.verification || {}
    const verificationRowsMap = buildVerificationRowsMap(verification)

    pushVerificationGroupWarnings({
      request,
      verification,
      warningRows,
      approvedEmployeeMap,
    })

    for (const approved of approvedEmployees) {
      const employeeId = employeeKeyFromApprovedRow(approved)
      const snapshotEmployeeCode = employeeCodeFromApprovedRow(approved)

      if (!employeeId || !mongoose.isValidObjectId(employeeId)) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeNo: snapshotEmployeeCode,
          employeeName: approved.employeeName,
          reason: 'Approved employee row has invalid employeeId',
        })
        continue
      }

      const employeeMaster = employeeMasterMap.get(employeeId)

      if (!employeeMaster) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeNo: snapshotEmployeeCode,
          employeeName: approved.employeeName,
          reason: 'Employee master record not found',
        })
        continue
      }

      const masterEmployeeNo = upper(employeeMaster.employeeNo)
      const employeeName = employeeNameFromMasterOrApproved(employeeMaster, approved)

      if (!masterEmployeeNo) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeName,
          reason: 'Employee master has no employeeNo',
        })
        continue
      }

      if (snapshotEmployeeCode && snapshotEmployeeCode !== masterEmployeeNo) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeNo: masterEmployeeNo,
          employeeName,
          reason: `OT employeeCode ${snapshotEmployeeCode} does not match Employee master employeeNo ${masterEmployeeNo}`,
        })
      }

      const verificationRow =
        verificationRowsMap.get(employeeId) || verificationRowsMap.get(masterEmployeeNo)

      if (!verificationRow) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeNo: masterEmployeeNo,
          employeeName,
          reason: 'No attendance verification row found for approved employee',
        })
        continue
      }

      if (!isPayableVerificationRow(verificationRow)) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeNo: masterEmployeeNo,
          employeeName,
          reason: buildNonPayableReason(verificationRow),
        })
        continue
      }

      const payableMinutes = toNumber(verificationRow.roundedOtMinutes, 0)
      const payableHours = payableMinutes / 60

      const salaryInfo = salaryMap.get(masterEmployeeNo)

      if (!salaryInfo) {
        addMissingSalary(missingSalaryRows, {
          requestNo,
          otDate,
          employeeNo: masterEmployeeNo,
          employeeName,
          positionName: approved.positionName || employeeMaster.positionId?.name,
          lineName: getLineName(approved) || employeeMaster.lineId?.name,
          payableHours: round(payableHours, 4),
          reason: 'Salary not found in uploaded Excel by Employee ID',
        })
        continue
      }

      if (!sameNameLoose(salaryInfo.name, employeeName)) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeNo: masterEmployeeNo,
          employeeName,
          reason: `Salary Excel name "${salaryInfo.name}" does not match Employee master name "${employeeName}"`,
        })
      }

      const monthlySalary = toNumber(salaryInfo.salary, 0)

      if (monthlySalary < 0) {
        addWarning(warningRows, {
          requestNo,
          otDate,
          employeeNo: masterEmployeeNo,
          employeeName,
          reason: 'Salary is invalid',
        })
        continue
      }

      const hourlyRate = monthlySalary / monthlyWorkingDays / hoursPerDay
      const amount = payableHours * hourlyRate * multiplier

      const positionName = s(approved.positionName || employeeMaster.positionId?.name)
      const lineName = s(getLineName(approved) || employeeMaster.lineId?.name)

      const detail = {
        otDate,
        requestNo,
        requestTime,

        // ✅ Payment multiplier day type source
        dayType,
        storedDayType,
        internalCalendarDayType,

        employeeId,
        employeeNo: masterEmployeeNo,
        employeeName,
        salaryExcelName: s(salaryInfo.name),

        positionName,
        lineName,

        monthlySalary: round(monthlySalary, formula.roundingDecimals),
        monthlyWorkingDays,
        hoursPerDay,
        hourlyRate: round(hourlyRate, 6),

        requestedMinutes: toNumber(verificationRow.requestedMinutes, 0),
        actualOtMinutes: toNumber(verificationRow.actualOtMinutes, 0),
        eligibleOtMinutes: toNumber(verificationRow.eligibleOtMinutes, 0),
        roundedOtMinutes: payableMinutes,

        payableHours: round(payableHours, 4),
        multiplier,
        amount: round(amount, formula.roundingDecimals),

        currency: formula.currency || 'USD',

        attendanceStatus: upper(verificationRow.attendanceStatus),
        clockIn: s(verificationRow.clockIn),
        clockOut: s(verificationRow.clockOut),
        rawOtDecision: upper(verificationRow.rawOtDecision),
        otResult: upper(verificationRow.otResult),
        otResultReason: s(verificationRow.otResultReason),
      }

      detailRows.push(detail)

      if (!summaryMap.has(masterEmployeeNo)) {
        summaryMap.set(masterEmployeeNo, {
          employeeNo: masterEmployeeNo,
          employeeName,
          salaryExcelName: s(salaryInfo.name),
          positionName,
          lineName,
          monthlySalary: round(monthlySalary, formula.roundingDecimals),
          totalPayableHours: 0,
          totalAmount: 0,
          currency: formula.currency || 'USD',
        })
      }

      const summary = summaryMap.get(masterEmployeeNo)
      summary.totalPayableHours += payableHours
      summary.totalAmount += amount
    }
  }

  const summaryRows = [...summaryMap.values()]
    .map((row) => ({
      ...row,
      totalPayableHours: round(row.totalPayableHours, 4),
      totalAmount: round(row.totalAmount, formula.roundingDecimals),
    }))
    .sort((a, b) => a.employeeNo.localeCompare(b.employeeNo))

  return {
    formula,
    fromDate: startDate,
    toDate: endDate,
    salaryMeta,
    requestCount: requests.length,
    summaryRows,
    detailRows,
    missingSalaryRows,
    warningRows,
  }
}

module.exports = {
  calculatePaymentExport,
}