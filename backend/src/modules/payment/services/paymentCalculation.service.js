// backend/src/modules/payment/services/paymentCalculation.service.js

const mongoose = require('mongoose')

const PaymentFormula = require('../models/PaymentFormula.model')
const OTRequest = require('../../ot/models/OTRequest')
const { parseSalaryExcel } = require('./salaryExcelParser.service')
const {
  formatYmdToDmy,
  formatDateTimeToDmyHm,
} = require('../../../shared/utils/dateFormat')

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function createHttpError(message, status = 400, messageKey = '') {
  const error = new Error(message)
  error.status = status
  error.statusCode = status
  error.messageKey = messageKey
  return error
}

function safeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safeNonNegativeNumber(value, fallback = 0) {
  const num = safeNumber(value, fallback)
  return num < 0 ? fallback : num
}

function roundAmount(value, decimals = 2) {
  const safeDecimals = Math.min(Math.max(Number(decimals || 0), 0), 6)
  const factor = 10 ** safeDecimals
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor
}

function normalizeEmployeeNo(value) {
  return upper(value)
}

function normalizeDayType(value) {
  const dayType = upper(value)
  if (['WORKING_DAY', 'SUNDAY', 'HOLIDAY'].includes(dayType)) return dayType
  return 'WORKING_DAY'
}

function normalizeStatus(value) {
  return upper(value)
}

function getObjectIdString(value) {
  return value ? String(value) : ''
}

function getMultiplier(formula, dayType) {
  const normalizedDayType = normalizeDayType(dayType)
  return safeNonNegativeNumber(formula?.multipliers?.[normalizedDayType], 0)
}

function getHourlyRate(monthlySalary, formula) {
  const salary = safeNonNegativeNumber(monthlySalary, 0)
  const monthlyWorkingDays = safeNonNegativeNumber(formula?.monthlyWorkingDays, 26)
  const hoursPerDay = safeNonNegativeNumber(formula?.hoursPerDay, 8)

  if (salary <= 0 || monthlyWorkingDays <= 0 || hoursPerDay <= 0) return 0

  return salary / monthlyWorkingDays / hoursPerDay
}

function validateSalaryFile(file) {
  if (!file) {
    throw createHttpError(
      'Salary Excel file is required',
      400,
      'payment.salary_file_required',
    )
  }

  if (!file.buffer || !Buffer.isBuffer(file.buffer) || !file.buffer.length) {
    throw createHttpError(
      'Salary Excel file is empty or invalid',
      400,
      'payment.salary_file_invalid',
    )
  }
}

function mapFormula(doc = {}) {
  return {
    id: doc._id ? String(doc._id) : null,
    code: upper(doc.code),
    name: s(doc.name),
    description: s(doc.description),
    salaryBasis: upper(doc.salaryBasis || 'MONTHLY_SALARY'),

    monthlyWorkingDays: safeNonNegativeNumber(doc.monthlyWorkingDays, 26),
    hoursPerDay: safeNonNegativeNumber(doc.hoursPerDay, 8),

    multipliers: {
      WORKING_DAY: safeNonNegativeNumber(doc.multipliers?.WORKING_DAY, 1.5),
      SUNDAY: safeNonNegativeNumber(doc.multipliers?.SUNDAY, 2),
      HOLIDAY: safeNonNegativeNumber(doc.multipliers?.HOLIDAY, 3),
    },

    roundingDecimals: Math.min(Math.max(Number(doc.roundingDecimals || 2), 0), 6),
    currency: upper(doc.currency || 'USD'),
    isActive: doc.isActive === true,
  }
}

async function getFormulaOrThrow(formulaId) {
  if (!mongoose.isValidObjectId(formulaId)) {
    throw createHttpError(
      'Invalid payment formula id',
      400,
      'payment.formula.invalid_id',
    )
  }

  const doc = await PaymentFormula.findById(formulaId).lean()

  if (!doc) {
    throw createHttpError(
      'Payment formula not found',
      404,
      'payment.formula.not_found',
    )
  }

  if (doc.isActive !== true) {
    throw createHttpError(
      'Payment formula is inactive',
      400,
      'payment.formula.inactive',
    )
  }

  return mapFormula(doc)
}

function buildApprovedOTFilter(fromDate, toDate) {
  return {
    status: 'APPROVED',
    otDate: {
      $gte: s(fromDate),
      $lte: s(toDate),
    },
  }
}

async function fetchApprovedOTRequests(fromDate, toDate) {
  return OTRequest.find(buildApprovedOTFilter(fromDate, toDate))
    .sort({
      otDate: 1,
      requestNo: 1,
      createdAt: 1,
      _id: 1,
    })
    .lean()
}

function resolveRequestPaidMinutes(otRequest = {}) {
  const totalRequestPaidMinutes = safeNonNegativeNumber(
    otRequest.totalRequestPaidMinutes ??
      otRequest.totalPaidMinutes ??
      otRequest.requestPaidMinutes,
    0,
  )

  if (totalRequestPaidMinutes > 0) return totalRequestPaidMinutes

  const totalMinutes = safeNonNegativeNumber(otRequest.totalMinutes, 0)
  if (totalMinutes > 0) return totalMinutes

  const requestedMinutes = safeNonNegativeNumber(
    otRequest.requestedMinutes ?? otRequest.requestedOtMinutes,
    0,
  )

  const breakMinutes = safeNonNegativeNumber(otRequest.breakMinutes, 0)

  if (requestedMinutes > 0 && breakMinutes > 0 && breakMinutes < requestedMinutes) {
    return requestedMinutes - breakMinutes
  }

  return requestedMinutes
}

function resolveEmployeePaidMinutes(employee = {}, otRequest = {}) {
  const employeePaidMinutes = safeNonNegativeNumber(
    employee.approvedPaidMinutes ??
      employee.payableMinutes ??
      employee.paidMinutes ??
      employee.totalRequestPaidMinutes ??
      employee.requestPaidMinutes,
    0,
  )

  if (employeePaidMinutes > 0) return employeePaidMinutes

  return resolveRequestPaidMinutes(otRequest)
}

function resolveEmployeeSourceList(otRequest = {}) {
  if (Array.isArray(otRequest.approvedEmployees) && otRequest.approvedEmployees.length) {
    return otRequest.approvedEmployees
  }

  if (Array.isArray(otRequest.requestedEmployees) && otRequest.requestedEmployees.length) {
    return otRequest.requestedEmployees
  }

  return []
}

function buildSalaryInfo(salaryMap, employeeNo) {
  const key = normalizeEmployeeNo(employeeNo)
  const info = salaryMap.get(key)

  if (!info) {
    return {
      hasSalary: false,
      monthlySalary: 0,
      salaryEmployeeName: '',
      salaryRowNo: null,
    }
  }

  return {
    hasSalary: true,
    monthlySalary: safeNonNegativeNumber(info.salary, 0),
    salaryEmployeeName: s(info.name),
    salaryRowNo: Number(info.rowNo || 0) || null,
  }
}

function buildPaymentItem({ otRequest, employee, formula, salaryInfo }) {
  const employeeNo = normalizeEmployeeNo(employee.employeeNo || employee.employeeCode)
  const employeeName = s(employee.employeeName || employee.name)

  const dayType = normalizeDayType(otRequest.dayType)
  const multiplier = getMultiplier(formula, dayType)

  const monthlySalary = safeNonNegativeNumber(salaryInfo.monthlySalary, 0)
  const hourlyRate = getHourlyRate(monthlySalary, formula)

  const requestedMinutes = safeNonNegativeNumber(
    otRequest.requestedMinutes ?? otRequest.requestedOtMinutes ?? otRequest.totalMinutes,
    0,
  )

  const breakMinutes = safeNonNegativeNumber(otRequest.breakMinutes, 0)
  const requestPaidMinutes = resolveRequestPaidMinutes(otRequest)
  const payableMinutes = resolveEmployeePaidMinutes(employee, otRequest)

  const payableHours = payableMinutes / 60
  const rawAmount = hourlyRate * multiplier * payableHours
  const amount = salaryInfo.hasSalary
    ? roundAmount(rawAmount, formula.roundingDecimals)
    : 0

  return {
    otRequestId: getObjectIdString(otRequest._id),
    requestNo: s(otRequest.requestNo),

    otDate: s(otRequest.otDate),
    otDateDisplay: formatYmdToDmy(otRequest.otDate),

    dayType,
    status: normalizeStatus(otRequest.status),

    requesterEmployeeId: getObjectIdString(otRequest.requesterEmployeeId),
    requesterEmployeeNo: normalizeEmployeeNo(otRequest.requesterEmployeeNo),
    requesterName: s(otRequest.requesterName),

    employeeId: getObjectIdString(employee.employeeId),
    employeeNo,
    employeeName,

    departmentId: getObjectIdString(employee.departmentId),
    departmentCode: upper(employee.departmentCode),
    departmentName: s(employee.departmentName),

    positionId: getObjectIdString(employee.positionId),
    positionCode: upper(employee.positionCode),
    positionName: s(employee.positionName),

    lineId: getObjectIdString(employee.lineId),
    lineCode: upper(employee.lineCode),
    lineName: s(employee.lineName),

    shiftId: getObjectIdString(otRequest.shiftId || employee.shiftId),
    shiftCode: upper(otRequest.shiftCode || employee.shiftCode),
    shiftName: s(otRequest.shiftName || employee.shiftName),
    shiftType: upper(otRequest.shiftType || employee.shiftType),

    shiftOtOptionId: getObjectIdString(otRequest.shiftOtOptionId),
    shiftOtOptionLabel: s(otRequest.shiftOtOptionLabel),
    shiftOtOptionTimingMode: upper(otRequest.shiftOtOptionTimingMode),

    requestStartTime: s(otRequest.requestStartTime || otRequest.startTime),
    requestEndTime: s(otRequest.requestEndTime || otRequest.endTime),

    requestedMinutes,
    breakMinutes,
    requestPaidMinutes,
    payableMinutes,
    payableHours: roundAmount(payableHours, 4),

    monthlySalary,
    hourlyRate: roundAmount(hourlyRate, formula.roundingDecimals + 4),
    multiplier,

    currency: formula.currency,
    amount,

    hasSalary: salaryInfo.hasSalary,
    salaryEmployeeName: salaryInfo.salaryEmployeeName,
    salaryRowNo: salaryInfo.salaryRowNo,

    formulaId: formula.id,
    formulaCode: formula.code,
    formulaName: formula.name,
  }
}

function buildPaymentItems({ otRequests, salaryMap, formula }) {
  const items = []
  const missingSalaryEmployeesMap = new Map()

  for (const otRequest of otRequests) {
    const employees = resolveEmployeeSourceList(otRequest)

    for (const employee of employees) {
      const employeeNo = normalizeEmployeeNo(employee.employeeNo || employee.employeeCode)
      if (!employeeNo) continue

      const salaryInfo = buildSalaryInfo(salaryMap, employeeNo)

      const item = buildPaymentItem({
        otRequest,
        employee,
        formula,
        salaryInfo,
      })

      items.push(item)

      if (!salaryInfo.hasSalary && !missingSalaryEmployeesMap.has(employeeNo)) {
        missingSalaryEmployeesMap.set(employeeNo, {
          employeeNo,
          employeeName: item.employeeName,
          departmentName: item.departmentName,
          positionName: item.positionName,
          lineName: item.lineName,
          reason: 'Salary not found in uploaded salary Excel',
        })
      }
    }
  }

  return {
    items,
    missingSalaryEmployees: Array.from(missingSalaryEmployeesMap.values()),
  }
}

function summarizePaymentItems(items = []) {
  const summaryByEmployeeMap = new Map()
  const summaryByDayTypeMap = new Map()

  let totalPayableMinutes = 0
  let totalAmount = 0
  let payableItemCount = 0
  let missingSalaryItemCount = 0

  for (const item of items) {
    totalPayableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
    totalAmount += safeNonNegativeNumber(item.amount, 0)

    if (item.hasSalary) payableItemCount += 1
    if (!item.hasSalary) missingSalaryItemCount += 1

    const employeeKey = item.employeeId || item.employeeNo

    if (employeeKey) {
      const existing = summaryByEmployeeMap.get(employeeKey) || {
        employeeId: item.employeeId,
        employeeNo: item.employeeNo,
        employeeName: item.employeeName,
        departmentName: item.departmentName,
        positionName: item.positionName,
        lineName: item.lineName,
        monthlySalary: item.monthlySalary,
        currency: item.currency,
        payableMinutes: 0,
        payableHours: 0,
        amount: 0,
        requestCount: 0,
      }

      existing.payableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
      existing.payableHours = roundAmount(existing.payableMinutes / 60, 4)
      existing.amount = roundAmount(existing.amount + safeNonNegativeNumber(item.amount, 0), 2)
      existing.requestCount += 1

      summaryByEmployeeMap.set(employeeKey, existing)
    }

    const dayType = normalizeDayType(item.dayType)

    const existingDayType = summaryByDayTypeMap.get(dayType) || {
      dayType,
      payableMinutes: 0,
      payableHours: 0,
      amount: 0,
      requestCount: 0,
    }

    existingDayType.payableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
    existingDayType.payableHours = roundAmount(existingDayType.payableMinutes / 60, 4)
    existingDayType.amount = roundAmount(
      existingDayType.amount + safeNonNegativeNumber(item.amount, 0),
      2,
    )
    existingDayType.requestCount += 1

    summaryByDayTypeMap.set(dayType, existingDayType)
  }

  return {
    totalItemCount: items.length,
    payableItemCount,
    missingSalaryItemCount,

    totalPayableMinutes,
    totalPayableHours: roundAmount(totalPayableMinutes / 60, 4),
    totalAmount: roundAmount(totalAmount, 2),

    summaryByEmployee: Array.from(summaryByEmployeeMap.values()).sort((a, b) =>
      String(a.employeeNo).localeCompare(String(b.employeeNo)),
    ),

    summaryByDayType: Array.from(summaryByDayTypeMap.values()).sort((a, b) =>
      String(a.dayType).localeCompare(String(b.dayType)),
    ),
  }
}

async function buildPaymentPreview({ salaryFile, fromDate, toDate, formulaId }) {
  validateSalaryFile(salaryFile)

  const formula = await getFormulaOrThrow(formulaId)
  const parsedSalary = parseSalaryExcel(salaryFile.buffer)
  const otRequests = await fetchApprovedOTRequests(fromDate, toDate)

  const { items, missingSalaryEmployees } = buildPaymentItems({
    otRequests,
    salaryMap: parsedSalary.salaryMap,
    formula,
  })

  const summary = summarizePaymentItems(items)
  const generatedAt = new Date()

  return {
    period: {
      fromDate: s(fromDate),
      fromDateDisplay: formatYmdToDmy(fromDate),
      toDate: s(toDate),
      toDateDisplay: formatYmdToDmy(toDate),
    },

    generatedAt,
    generatedAtDisplayHm: formatDateTimeToDmyHm(generatedAt),

    formula,

    salaryFile: {
      originalName: s(salaryFile.originalname),
      mimeType: s(salaryFile.mimetype),
      size: Number(salaryFile.size || salaryFile.buffer?.length || 0),
      sheetName: s(parsedSalary.sheetName),
      rowsCount: parsedSalary.rowsCount,
      validCount: parsedSalary.validCount,
      invalidRows: parsedSalary.invalidRows,
      duplicateRows: parsedSalary.duplicateRows,
    },

    otRequestCount: otRequests.length,

    summary,
    items,

    issues: {
      invalidSalaryRows: parsedSalary.invalidRows,
      duplicateSalaryRows: parsedSalary.duplicateRows,
      missingSalaryEmployees,
    },
  }
}

module.exports = {
  buildPaymentPreview,
}