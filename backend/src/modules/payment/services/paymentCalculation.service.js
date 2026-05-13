// backend/src/modules/payment/services/paymentCalculation.service.js

const mongoose = require('mongoose')

const PaymentFormula = require('../models/PaymentFormula.model')
const PaymentExchangeRate = require('../models/PaymentExchangeRate.model')
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

function safePositiveNumber(value, fallback = 1) {
  const num = safeNumber(value, fallback)
  return num > 0 ? num : fallback
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

function normalizeRoundingMode(value) {
  const mode = upper(value)

  if (['CEIL', 'FLOOR', 'ROUND', 'NONE'].includes(mode)) {
    return mode
  }

  return 'ROUND'
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

function normalizeDenominations(value) {
  const source = Array.isArray(value) && value.length
    ? value
    : [50000, 20000, 10000, 5000, 1000, 500, 100]

  return [...new Set(
    source
      .map((item) => Math.round(safePositiveNumber(item, 0)))
      .filter((item) => item > 0),
  )].sort((a, b) => b - a)
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

function mapExchangeRate(doc = {}) {
  return {
    id: doc._id ? String(doc._id) : null,
    code: upper(doc.code),
    name: s(doc.name),
    description: s(doc.description),

    fromCurrency: upper(doc.fromCurrency || 'USD'),
    toCurrency: upper(doc.toCurrency || 'KHR'),
    rate: safePositiveNumber(doc.rate, 1),

    roundingUnit: Math.round(safePositiveNumber(doc.roundingUnit, 100)),
    roundingMode: normalizeRoundingMode(doc.roundingMode),
    denominations: normalizeDenominations(doc.denominations),

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

async function getExchangeRateOrThrow(exchangeRateId, formula) {
  if (!mongoose.isValidObjectId(exchangeRateId)) {
    throw createHttpError(
      'Invalid payment exchange rate id',
      400,
      'payment.exchange_rate.invalid_id',
    )
  }

  const doc = await PaymentExchangeRate.findById(exchangeRateId).lean()

  if (!doc) {
    throw createHttpError(
      'Payment exchange rate not found',
      404,
      'payment.exchange_rate.not_found',
    )
  }

  if (doc.isActive !== true) {
    throw createHttpError(
      'Payment exchange rate is inactive',
      400,
      'payment.exchange_rate.inactive',
    )
  }

  const exchangeRate = mapExchangeRate(doc)

  if (upper(formula.currency) !== exchangeRate.fromCurrency) {
    throw createHttpError(
      'Payment formula currency does not match exchange rate source currency',
      400,
      'payment.exchange_rate.currency_mismatch',
    )
  }

  if (exchangeRate.toCurrency !== 'KHR') {
    throw createHttpError(
      'Payment exchange rate target currency must be KHR',
      400,
      'payment.exchange_rate.target_must_be_khr',
    )
  }

  return exchangeRate
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

function roundByMode(amount, roundingUnit, roundingMode) {
  const value = Math.round(safeNonNegativeNumber(amount, 0))
  const unit = Math.round(safePositiveNumber(roundingUnit, 1))
  const mode = normalizeRoundingMode(roundingMode)

  if (mode === 'NONE' || unit <= 1) return value

  const divided = value / unit

  if (mode === 'FLOOR') return Math.floor(divided) * unit
  if (mode === 'ROUND') return Math.round(divided) * unit

  return Math.ceil(divided) * unit
}

function buildDenominationBreakdown(amount, denominations = []) {
  const sortedDenominations = normalizeDenominations(denominations)
  let remaining = Math.round(safeNonNegativeNumber(amount, 0))

  const breakdown = {}

  for (const denomination of sortedDenominations) {
    const quantity = Math.floor(remaining / denomination)
    breakdown[String(denomination)] = quantity
    remaining -= quantity * denomination
  }

  return breakdown
}

function calculateExchangeAmount(amount, exchangeRate) {
  const amountUsd = roundAmount(amount, 2)
  const amountKhrRaw = Math.round(amountUsd * safePositiveNumber(exchangeRate.rate, 1))
  const amountKhrRounded = roundByMode(
    amountKhrRaw,
    exchangeRate.roundingUnit,
    exchangeRate.roundingMode,
  )

  return {
    amountUsd,
    exchangeRate: exchangeRate.rate,
    amountKhrRaw,
    amountKhrRounded,
    khrRoundDifference: amountKhrRounded - amountKhrRaw,
    khrBreakdown: buildDenominationBreakdown(
      amountKhrRounded,
      exchangeRate.denominations,
    ),
  }
}

function buildPaymentItem({ otRequest, employee, formula, salaryInfo, exchangeRate }) {
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

  const exchange = calculateExchangeAmount(amount, exchangeRate)

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

    amountUsd: exchange.amountUsd,
    exchangeRateId: exchangeRate.id,
    exchangeRateCode: exchangeRate.code,
    exchangeRateName: exchangeRate.name,
    exchangeRate: exchange.exchangeRate,
    amountKhrRaw: exchange.amountKhrRaw,
    amountKhrRounded: exchange.amountKhrRounded,
    khrRoundDifference: exchange.khrRoundDifference,
    khrBreakdown: exchange.khrBreakdown,

    paymentCurrency: exchangeRate.toCurrency,
    roundingUnit: exchangeRate.roundingUnit,
    roundingMode: exchangeRate.roundingMode,

    hasSalary: salaryInfo.hasSalary,
    salaryEmployeeName: salaryInfo.salaryEmployeeName,
    salaryRowNo: salaryInfo.salaryRowNo,

    formulaId: formula.id,
    formulaCode: formula.code,
    formulaName: formula.name,
  }
}

function buildPaymentItems({ otRequests, salaryMap, formula, exchangeRate }) {
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
        exchangeRate,
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

function emptyBreakdown(denominations = []) {
  return normalizeDenominations(denominations).reduce((acc, denomination) => {
    acc[String(denomination)] = 0
    return acc
  }, {})
}

function addBreakdown(target = {}, source = {}) {
  const result = { ...target }

  Object.entries(source || {}).forEach(([denomination, quantity]) => {
    result[String(denomination)] =
      safeNonNegativeNumber(result[String(denomination)], 0) +
      safeNonNegativeNumber(quantity, 0)
  })

  return result
}

function summarizePaymentItems(items = [], exchangeRate = {}) {
  const summaryByEmployeeMap = new Map()
  const summaryByDayTypeMap = new Map()

  let totalPayableMinutes = 0
  let totalAmount = 0
  let totalAmountUsd = 0
  let totalAmountKhrRaw = 0
  let totalAmountKhrRounded = 0
  let totalKhrRoundDifference = 0
  let totalKhrBreakdown = emptyBreakdown(exchangeRate.denominations)

  let payableItemCount = 0
  let missingSalaryItemCount = 0

  for (const item of items) {
    totalPayableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
    totalAmount += safeNonNegativeNumber(item.amount, 0)
    totalAmountUsd += safeNonNegativeNumber(item.amountUsd, 0)
    totalAmountKhrRaw += safeNonNegativeNumber(item.amountKhrRaw, 0)
    totalAmountKhrRounded += safeNonNegativeNumber(item.amountKhrRounded, 0)
    totalKhrRoundDifference += safeNonNegativeNumber(item.khrRoundDifference, 0)
    totalKhrBreakdown = addBreakdown(totalKhrBreakdown, item.khrBreakdown)

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
        amountUsd: 0,
        amountKhrRaw: 0,
        amountKhrRounded: 0,
        khrRoundDifference: 0,
        khrBreakdown: emptyBreakdown(exchangeRate.denominations),
        requestCount: 0,
      }

      existing.payableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
      existing.payableHours = roundAmount(existing.payableMinutes / 60, 4)
      existing.amount = roundAmount(existing.amount + safeNonNegativeNumber(item.amount, 0), 2)
      existing.amountUsd = roundAmount(
        existing.amountUsd + safeNonNegativeNumber(item.amountUsd, 0),
        2,
      )
      existing.amountKhrRaw += safeNonNegativeNumber(item.amountKhrRaw, 0)
      existing.amountKhrRounded += safeNonNegativeNumber(item.amountKhrRounded, 0)
      existing.khrRoundDifference += safeNonNegativeNumber(item.khrRoundDifference, 0)
      existing.khrBreakdown = addBreakdown(existing.khrBreakdown, item.khrBreakdown)
      existing.requestCount += 1

      summaryByEmployeeMap.set(employeeKey, existing)
    }

    const dayType = normalizeDayType(item.dayType)

    const existingDayType = summaryByDayTypeMap.get(dayType) || {
      dayType,
      payableMinutes: 0,
      payableHours: 0,
      amount: 0,
      amountUsd: 0,
      amountKhrRaw: 0,
      amountKhrRounded: 0,
      khrRoundDifference: 0,
      khrBreakdown: emptyBreakdown(exchangeRate.denominations),
      requestCount: 0,
    }

    existingDayType.payableMinutes += safeNonNegativeNumber(item.payableMinutes, 0)
    existingDayType.payableHours = roundAmount(existingDayType.payableMinutes / 60, 4)
    existingDayType.amount = roundAmount(
      existingDayType.amount + safeNonNegativeNumber(item.amount, 0),
      2,
    )
    existingDayType.amountUsd = roundAmount(
      existingDayType.amountUsd + safeNonNegativeNumber(item.amountUsd, 0),
      2,
    )
    existingDayType.amountKhrRaw += safeNonNegativeNumber(item.amountKhrRaw, 0)
    existingDayType.amountKhrRounded += safeNonNegativeNumber(item.amountKhrRounded, 0)
    existingDayType.khrRoundDifference += safeNonNegativeNumber(item.khrRoundDifference, 0)
    existingDayType.khrBreakdown = addBreakdown(
      existingDayType.khrBreakdown,
      item.khrBreakdown,
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
    totalAmountUsd: roundAmount(totalAmountUsd, 2),
    totalAmountKhrRaw,
    totalAmountKhrRounded,
    totalKhrRoundDifference,
    totalKhrBreakdown,

    summaryByEmployee: Array.from(summaryByEmployeeMap.values()).sort((a, b) =>
      String(a.employeeNo).localeCompare(String(b.employeeNo)),
    ),

    summaryByDayType: Array.from(summaryByDayTypeMap.values()).sort((a, b) =>
      String(a.dayType).localeCompare(String(b.dayType)),
    ),
  }
}

async function buildPaymentPreview({
  salaryFile,
  fromDate,
  toDate,
  formulaId,
  exchangeRateId,
}) {
  validateSalaryFile(salaryFile)

  const formula = await getFormulaOrThrow(formulaId)
  const exchangeRate = await getExchangeRateOrThrow(exchangeRateId, formula)

  const parsedSalary = parseSalaryExcel(salaryFile.buffer)
  const otRequests = await fetchApprovedOTRequests(fromDate, toDate)

  const { items, missingSalaryEmployees } = buildPaymentItems({
    otRequests,
    salaryMap: parsedSalary.salaryMap,
    formula,
    exchangeRate,
  })

  const summary = summarizePaymentItems(items, exchangeRate)
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
    exchangeRate,

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