// backend/src/modules/payment/services/paymentExcel.service.js

const ExcelJS = require('exceljs')

const DEFAULT_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]
const COMPANY_NAME = 'Trax Apparel (Cambodia) Co., Ltd'
const WORKBOOK_FONT = 'Arial'
const SIGNATURE_LINE_OFFSET = 5
const MAX_DETAIL_EMPLOYEE_ROWS_PER_SHEET = 20

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function n(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function roundAmount(value, decimals = 2) {
  const safeDecimals = Math.min(Math.max(Number(decimals || 0), 0), 6)
  const factor = 10 ** safeDecimals
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor
}

function formatHourValue(value) {
  const rounded = roundAmount(value, 2)
  if (!rounded) return null

  return Number.isInteger(rounded) ? Math.trunc(rounded) : rounded
}

function getDenominations(data) {
  const denominations = data?.exchangeRate?.denominations

  if (Array.isArray(denominations) && denominations.length) {
    return [
      ...new Set(
        denominations
          .map((item) => Math.round(n(item, 0)))
          .filter((item) => item > 0),
      ),
    ].sort((a, b) => b - a)
  }

  return DEFAULT_DENOMINATIONS
}

async function buildSalaryTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook()
  applyWorkbookProperties(workbook)

  const worksheet = workbook.addWorksheet('Salary Template')
  worksheet.addRow(['Employee ID', 'Monthly Salary'])
  worksheet.addRow(['52520351', 250])
  worksheet.addRow(['52520352', 300])
  worksheet.addRow(['52520353', 280])

  worksheet.getColumn(1).width = 18
  worksheet.getColumn(2).width = 18

  worksheet.getRow(1).eachCell((cell) => {
    styleHeaderCell(cell)
  })

  worksheet.getColumn(2).numFmt = '#,##0.00'
  styleRangeBorder(worksheet, 1, 4, 1, 2)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
}

function normalizeSheetName(value, fallback = 'Sheet') {
  const cleaned = s(value)
    .replace(/[\\/?*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const name = cleaned || fallback
  return name.slice(0, 31)
}

function ensureUniqueSheetName(workbook, requestedName) {
  const base = normalizeSheetName(requestedName, `Sheet ${workbook.worksheets.length + 1}`)
  const used = new Set(workbook.worksheets.map((sheet) => sheet.name.toLowerCase()))

  let name = base
  let index = 2

  while (used.has(name.toLowerCase())) {
    const suffix = ` (${index})`
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`
    index += 1
  }

  return name
}

function parseYmd(value) {
  const raw = s(value)
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

function formatLongDate(value, fallback = '') {
  const date = parseYmd(value)
  if (!date) return fallback || s(value)

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatShortDate(value, fallback = '') {
  const date = parseYmd(value)
  if (!date) return s(fallback || value)

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatSheetDate(value, fallback = '') {
  const date = parseYmd(value)
  if (!date) return s(fallback || value)

  const day = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date)

  const month = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date)

  return `${day}${month}`
}

function formatDateHeader(value, fallback = '') {
  const date = parseYmd(value)
  if (!date) return s(fallback || value)

  const day = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date)

  const month = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(date)

  return `${day}-${month}`
}

function formatDayOnly(value, fallback = '') {
  const date = parseYmd(value)
  if (!date) return s(fallback || value)

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function displayDayType(value) {
  const dayType = upper(value)

  if (dayType === 'HOLIDAY') return 'Holiday'
  if (dayType === 'SUNDAY') return 'Sunday'
  if (dayType === 'WORKING_DAY') return 'Working Day'

  return s(value) || 'OT'
}

function formatPercentFromMultiplier(value) {
  const multiplier = n(value, 0)
  if (multiplier > 0) return `${Math.round(multiplier * 100)}%`

  return 'OT'
}

function formatItemRateLabel(item = {}) {
  const progressiveText = s(item.progressiveHourFormulaText)
  if (progressiveText) return progressiveText

  return formatPercentFromMultiplier(item.multiplier)
}

function getItemTotalUsd(item = {}) {
  return roundAmount(n(item.amountUsd, 0) + n(item.allowanceAmountUsd, 0), 2)
}

function getItemTotalKhrRaw(item = {}) {
  return n(item.totalPayableKhrRaw, 0) || n(item.amountKhrRaw, 0) + n(item.allowanceAmountKhrRaw, 0)
}

function getItemTotalKhrRounded(item = {}) {
  return (
    n(item.totalPayableKhrRounded, 0) ||
    n(item.amountKhrRounded, 0) + n(item.allowanceAmountKhrRounded, 0)
  )
}

function getItemBreakdown(item = {}, denominations = []) {
  const source = item.totalPayableKhrBreakdown || {}

  return denominations.reduce((acc, denomination) => {
    acc[String(denomination)] = n(source[String(denomination)], 0)
    return acc
  }, {})
}

function emptyBreakdown(denominations = []) {
  return denominations.reduce((acc, denomination) => {
    acc[String(denomination)] = 0
    return acc
  }, {})
}

function addBreakdown(target = {}, source = {}, denominations = []) {
  for (const denomination of denominations) {
    const key = String(denomination)
    target[key] = n(target[key], 0) + n(source[key], 0)
  }

  return target
}

function summarizeItems(items = [], denominations = []) {
  const result = {
    headCount: items.length,
    payableHours: 0,
    otUsd: 0,
    allowanceUsd: 0,
    allowanceKhrRounded: 0,
    totalUsd: 0,
    totalKhrRaw: 0,
    totalKhrRounded: 0,
    breakdown: emptyBreakdown(denominations),
  }

  for (const item of items) {
    result.payableHours += n(item.payableHours, 0)
    result.otUsd += n(item.amountUsd, 0)
    result.allowanceUsd += n(item.allowanceAmountUsd, 0)
    result.allowanceKhrRounded += n(item.allowanceAmountKhrRounded, 0)
    result.totalUsd += getItemTotalUsd(item)
    result.totalKhrRaw += getItemTotalKhrRaw(item)
    result.totalKhrRounded += getItemTotalKhrRounded(item)
    addBreakdown(result.breakdown, getItemBreakdown(item, denominations), denominations)
  }

  result.payableHours = roundAmount(result.payableHours, 2)
  result.otUsd = roundAmount(result.otUsd, 2)
  result.allowanceUsd = roundAmount(result.allowanceUsd, 2)
  result.allowanceKhrRounded = Math.round(result.allowanceKhrRounded)
  result.totalUsd = roundAmount(result.totalUsd, 2)
  result.totalKhrRaw = Math.round(result.totalKhrRaw)
  result.totalKhrRounded = Math.round(result.totalKhrRounded)
  result.variance = Math.round(result.totalKhrRaw - result.totalKhrRounded)

  return result
}

function employeeKey(item = {}) {
  const employeeId = s(item.employeeId)
  if (employeeId) return `ID:${employeeId}`

  const employeeNo = upper(item.employeeNo || item.employeeCode)
  if (employeeNo) return `CODE:${employeeNo}`

  return ''
}

function lineGroupKey(item = {}) {
  const lineId = s(item.lineId)
  if (lineId) return `LINE:${lineId}`

  const lineName = s(item.lineName || item.lineCode)
  if (lineName) return `LINE_NAME:${upper(lineName)}`

  return 'NO_LINE'
}

function lineGroupLabel(item = {}) {
  return s(item.lineName || item.lineCode || 'No Line')
}

function lineDisplayValue(group = {}) {
  return s(group.lineCode || group.lineName || 'No Line')
}

function buildLineGroups(data = {}, denominations = []) {
  const items = Array.isArray(data.items) ? data.items : []
  const groups = new Map()

  for (const item of items) {
    const key = lineGroupKey(item)
    const existing = groups.get(key) || {
      key,
      lineId: s(item.lineId),
      lineCode: upper(item.lineCode),
      lineName: lineGroupLabel(item),
      departmentName: s(item.departmentName),
      dates: new Map(),
      rateLabels: new Map(),
      items: [],
      employeeMap: new Map(),
    }

    if (!existing.lineName || existing.lineName === 'No Line') existing.lineName = lineGroupLabel(item)
    if (!existing.departmentName) existing.departmentName = s(item.departmentName)

    existing.items.push(item)

    const otDate = s(item.otDate)
    const dateLabel = formatDayOnly(otDate, item.otDateDisplay)
    const rateLabel = formatItemRateLabel(item)
    const dateRateKey = `${otDate}|${rateLabel}`

    if (otDate && !existing.dates.has(otDate)) {
      existing.dates.set(otDate, {
        otDate,
        label: dateLabel,
        display: s(item.otDateDisplay) || formatShortDate(otDate),
      })
    }

    if (!existing.rateLabels.has(dateRateKey)) {
      existing.rateLabels.set(dateRateKey, {
        key: dateRateKey,
        otDate,
        rateLabel,
      })
    }

    const empKey = employeeKey(item)
    if (empKey) {
      const employee = existing.employeeMap.get(empKey) || {
        key: empKey,
        employeeId: s(item.employeeId),
        employeeNo: upper(item.employeeNo || item.employeeCode),
        employeeName: s(item.employeeName),
        positionName: s(item.positionName),
        departmentName: s(item.departmentName),
        monthlySalary: n(item.monthlySalary, 0),
        bankAccount: s(item.bankAccount || item.bankAccountNo || item.bankAccountNumber),
        hoursByDateRate: new Map(),
        hoursByDate: new Map(),
        items: [],
        otUsd: 0,
        allowanceUsd: 0,
        allowanceKhrRounded: 0,
        totalUsd: 0,
        totalKhrRaw: 0,
        totalKhrRounded: 0,
        breakdown: emptyBreakdown(denominations),
      }

      if (!employee.employeeName) employee.employeeName = s(item.employeeName)
      if (!employee.positionName) employee.positionName = s(item.positionName)
      if (!employee.departmentName) employee.departmentName = s(item.departmentName)
      if (!employee.monthlySalary) employee.monthlySalary = n(item.monthlySalary, 0)
      if (!employee.bankAccount) employee.bankAccount = s(item.bankAccount || item.bankAccountNo || item.bankAccountNumber)

      employee.items.push(item)
      employee.hoursByDateRate.set(
        dateRateKey,
        roundAmount(n(employee.hoursByDateRate.get(dateRateKey), 0) + n(item.payableHours, 0), 2),
      )
      employee.hoursByDate.set(
        otDate,
        roundAmount(n(employee.hoursByDate.get(otDate), 0) + n(item.payableHours, 0), 2),
      )
      employee.otUsd += n(item.amountUsd, 0)
      employee.allowanceUsd += n(item.allowanceAmountUsd, 0)
      employee.allowanceKhrRounded += n(item.allowanceAmountKhrRounded, 0)
      employee.totalUsd += getItemTotalUsd(item)
      employee.totalKhrRaw += getItemTotalKhrRaw(item)
      employee.totalKhrRounded += getItemTotalKhrRounded(item)
      addBreakdown(employee.breakdown, getItemBreakdown(item, denominations), denominations)

      existing.employeeMap.set(empKey, employee)
    }

    groups.set(key, existing)
  }

  return Array.from(groups.values())
    .map((group) => {
      const dates = Array.from(group.dates.values()).sort((a, b) => s(a.otDate).localeCompare(s(b.otDate)))
      const rateLabels = Array.from(group.rateLabels.values()).sort((a, b) => {
        const byDate = s(a.otDate).localeCompare(s(b.otDate))
        if (byDate) return byDate
        return n(a.rateLabel.replace('%', ''), 0) - n(b.rateLabel.replace('%', ''), 0)
      })
      const employees = Array.from(group.employeeMap.values()).sort((a, b) =>
        s(a.employeeNo).localeCompare(s(b.employeeNo), undefined, { numeric: true }),
      )
      const summary = summarizeItems(group.items, denominations)

      return {
        ...group,
        dates,
        rateLabels,
        employees,
        summary,
      }
    })
    .sort((a, b) => s(a.lineName).localeCompare(s(b.lineName), undefined, { numeric: true }))
}

function getPeriodLabel(data = {}) {
  const from = s(data?.period?.fromDate)
  const to = s(data?.period?.toDate)

  if (from && to && from !== to) {
    const fromDate = parseYmd(from)
    const toDate = parseYmd(to)

    if (fromDate && toDate) {
      const sameMonth = fromDate.getUTCFullYear() === toDate.getUTCFullYear() && fromDate.getUTCMonth() === toDate.getUTCMonth()
      const startDay = new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone: 'UTC' }).format(fromDate)
      const endLabel = formatShortDate(to)

      return sameMonth ? `${startDay} - ${endLabel}` : `${formatShortDate(from)} - ${endLabel}`
    }
  }

  if (from) return formatShortDate(from)
  if (to) return formatShortDate(to)

  const items = Array.isArray(data.items) ? data.items : []
  const dates = items.map((item) => s(item.otDate)).filter(Boolean).sort()
  if (!dates.length) return ''

  if (dates[0] === dates[dates.length - 1]) return formatShortDate(dates[0])

  return `${formatShortDate(dates[0])} - ${formatShortDate(dates[dates.length - 1])}`
}

function getSelectedDateNote(data = {}) {
  const selectedDateCount = n(data?.period?.selectedDateCount, 0)
  const excludedDateCount = n(data?.period?.excludedDateCount, 0)

  if (!selectedDateCount || !excludedDateCount) return ''

  return ` · ${selectedDateCount} selected day${selectedDateCount === 1 ? '' : 's'}, ${excludedDateCount} excluded`
}

function reportTitle(data = {}) {
  const period = getPeriodLabel(data)
  return `(Name List Worker Working Extra OT On ${period}${getSelectedDateNote(data)})`
}

function colLetter(colNumber) {
  return ExcelJS.utils ? '' : columnLetter(colNumber)
}

function columnLetter(colNumber) {
  let dividend = Number(colNumber)
  let columnName = ''

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26
    columnName = String.fromCharCode(65 + modulo) + columnName
    dividend = Math.floor((dividend - modulo) / 26)
  }

  return columnName
}

function quoteSheetName(name) {
  return `'${String(name).replace(/'/g, "''")}'`
}

function applyWorkbookProperties(workbook) {
  workbook.creator = 'HRMS OT Request'
  workbook.lastModifiedBy = 'HRMS OT Request'
  workbook.created = new Date()
  workbook.modified = new Date()
}

function setSheetPrintLayout(worksheet, printTitleRows = '1:4', options = {}) {
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: options.fitToHeight ?? 0,
    horizontalCentered: true,
    verticalCentered: false,
    printTitlesRow: printTitleRows,
    margins: {
      left: 0.18,
      right: 0.18,
      top: 0.35,
      bottom: 0.35,
      header: 0.15,
      footer: 0.15,
    },
  }

  worksheet.headerFooter = { oddFooter: '&CPage &P of &N' }
}

function applyBaseSheetStyle(worksheet) {
  worksheet.properties.defaultRowHeight = 15
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = {
        name: WORKBOOK_FONT,
        size: 8,
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      }
    })
  })
}

function applyBorder(cell, style = 'thin') {
  cell.border = {
    top: { style, color: { argb: 'FF000000' } },
    left: { style, color: { argb: 'FF000000' } },
    bottom: { style, color: { argb: 'FF000000' } },
    right: { style, color: { argb: 'FF000000' } },
  }
}

function styleRangeBorder(worksheet, startRow, endRow, startCol, endCol, style = 'thin') {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    for (let colNumber = startCol; colNumber <= endCol; colNumber += 1) {
      applyBorder(row.getCell(colNumber), style)
    }
  }
}

function styleHeaderCell(cell, options = {}) {
  cell.font = {
    name: WORKBOOK_FONT,
    size: options.size || 8,
    bold: true,
  }
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  }
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: options.fill || 'FFF3F4F6' },
  }
  applyBorder(cell)
}

function styleTitleRow(row, size = 12) {
  row.font = {
    name: WORKBOOK_FONT,
    bold: true,
    size,
  }
  row.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  }
}

function styleNumberColumn(worksheet, colNumbers = [], numberFormat = '#,##0') {
  colNumbers.forEach((colNumber) => {
    worksheet.getColumn(colNumber).numFmt = numberFormat
  })
}

function setDetailColumns(worksheet, dateRateCount, denominations = []) {
  const widths = [4.5, 10, 18, 13, 22]
  for (let i = 0; i < dateRateCount; i += 1) widths.push(5.5)
  widths.push(10, 10, 10, 11)
  denominations.forEach(() => widths.push(6))
  widths.push(10, 13)

  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
}

function setSummaryColumns(worksheet, denominations = []) {
  const widths = [4.5, 30, 10, 9, 11, 11, 11, 12]
  denominations.forEach(() => widths.push(7))
  widths.push(10)

  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
}

function mergeIfNeeded(worksheet, startRow, startCol, endRow, endCol) {
  if (startRow === endRow && startCol === endCol) return
  worksheet.mergeCells(startRow, startCol, endRow, endCol)
}

function buildDateColumnPlan(group = {}) {
  const columns = group.dates.map((date) => ({
    key: date.otDate,
    otDate: date.otDate,
    label: formatDateHeader(date.otDate, date.display || date.label),
  }))

  return { columns, dateSpans: [] }
}

function getEmployeeHoursForDate(employee = {}, otDate) {
  if (employee.hoursByDate && typeof employee.hoursByDate.get === 'function') {
    return n(employee.hoursByDate.get(otDate), 0)
  }

  let total = 0
  if (employee.hoursByDateRate && typeof employee.hoursByDateRate.forEach === 'function') {
    employee.hoursByDateRate.forEach((hours, key) => {
      if (String(key).startsWith(`${otDate}|`)) total += n(hours, 0)
    })
  }

  return roundAmount(total, 2)
}

function getSignatureRegions(lastCol) {
  const totalCols = Math.max(3, n(lastCol, 3))
  const regionWidth = Math.max(4, Math.floor(totalCols / 3))

  return [
    { start: 1, end: Math.min(totalCols, regionWidth), label: 'Prepared By Payroll Leader' },
    { start: Math.min(totalCols, regionWidth + 1), end: Math.min(totalCols, regionWidth * 2), label: 'Checked By Sup HR' },
    { start: Math.min(totalCols, regionWidth * 2 + 1), end: totalCols, label: 'Verified By HRM' },
  ].filter((region) => region.start <= region.end)
}

function styleSignatureBlockText(worksheet, signatureRowNumber, lastCol) {
  worksheet.getRow(signatureRowNumber).height = 22
  worksheet.getRow(signatureRowNumber + SIGNATURE_LINE_OFFSET).height = 22

  getSignatureRegions(lastCol).forEach((region) => {
    const labelCell = worksheet.getCell(signatureRowNumber, region.start)
    labelCell.value = region.label
    labelCell.font = { name: WORKBOOK_FONT, size: 9, bold: true }
    labelCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

    const lineCell = worksheet.getCell(signatureRowNumber + SIGNATURE_LINE_OFFSET, region.start)
    lineCell.value = '______________________________'
    lineCell.font = { name: WORKBOOK_FONT, size: 9, bold: false }
    lineCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false }
  })
}

function addSignatureBlock(worksheet, signatureRowNumber, lastCol) {
  getSignatureRegions(lastCol).forEach((region) => {
    mergeIfNeeded(worksheet, signatureRowNumber, region.start, signatureRowNumber, region.end)
    mergeIfNeeded(worksheet, signatureRowNumber + SIGNATURE_LINE_OFFSET, region.start, signatureRowNumber + SIGNATURE_LINE_OFFSET, region.end)
  })

  styleSignatureBlockText(worksheet, signatureRowNumber, lastCol)
}

function addDetailHeader(worksheet, data = {}, group = {}, plan = {}, lastCol) {
  worksheet.getCell(1, 1).value = COMPANY_NAME
  worksheet.getCell(2, 1).value = reportTitle(data, group)
  worksheet.mergeCells(1, 1, 1, lastCol)
  worksheet.mergeCells(2, 1, 2, lastCol)
  styleTitleRow(worksheet.getRow(1), 12)
  styleTitleRow(worksheet.getRow(2), 11)
  worksheet.getRow(1).height = 18
  worksheet.getRow(2).height = 18

  const fixedHeaders = ['No', 'ID', 'Name', 'Position', 'Line']
  fixedHeaders.forEach((header, index) => {
    const col = index + 1
    const cell = worksheet.getCell(3, col)
    cell.value = header
    styleHeaderCell(cell)
  })

  const firstDateCol = 6
  plan.columns.forEach((column, index) => {
    const cell = worksheet.getCell(3, firstDateCol + index)
    cell.value = column.label
    styleHeaderCell(cell)
  })

  const afterDateCol = firstDateCol + plan.columns.length
  const moneyHeaders = ['OT Amount\n$', 'Allowance\n$', 'Total\n$', 'Total KHR']
  moneyHeaders.forEach((header, index) => {
    const col = afterDateCol + index
    const cell = worksheet.getCell(3, col)
    cell.value = header
    styleHeaderCell(cell)
  })

  const denominationStartCol = afterDateCol + moneyHeaders.length
  ;(data.__denominations || []).forEach((denomination, index) => {
    const col = denominationStartCol + index
    const cell = worksheet.getCell(3, col)
    cell.value = denomination
    styleHeaderCell(cell)
  })

  const signatureCol = denominationStartCol + (data.__denominations || []).length
  ;['Signature', 'Bank Account'].forEach((header, index) => {
    const col = signatureCol + index
    const cell = worksheet.getCell(3, col)
    cell.value = header
    styleHeaderCell(cell)
  })

  worksheet.getRow(3).height = 22
}

function addDetailRows(worksheet, group = {}, plan = {}, denominations = []) {
  const firstDataRow = 4
  const firstDateCol = 6
  const moneyStartCol = firstDateCol + plan.columns.length
  const denominationStartCol = moneyStartCol + 4
  const signatureCol = denominationStartCol + denominations.length

  group.employees.forEach((employee, index) => {
    const rowNumber = firstDataRow + index
    const row = worksheet.getRow(rowNumber)

    row.getCell(1).value = index + 1
    row.getCell(2).value = employee.employeeNo
    row.getCell(3).value = employee.employeeName
    row.getCell(4).value = employee.positionName
    row.getCell(5).value = lineDisplayValue(group)

    plan.columns.forEach((column, columnIndex) => {
      const hours = getEmployeeHoursForDate(employee, column.otDate)
      row.getCell(firstDateCol + columnIndex).value = formatHourValue(hours)
    })

    row.getCell(moneyStartCol).value = roundAmount(employee.otUsd, 2)
    row.getCell(moneyStartCol + 1).value = roundAmount(employee.allowanceUsd, 2)
    row.getCell(moneyStartCol + 2).value = roundAmount(employee.totalUsd, 2)
    row.getCell(moneyStartCol + 3).value = Math.round(employee.totalKhrRounded)

    denominations.forEach((denomination, columnIndex) => {
      row.getCell(denominationStartCol + columnIndex).value = n(employee.breakdown[String(denomination)], 0) || null
    })

    row.getCell(signatureCol).value = ''
    row.getCell(signatureCol + 1).value = employee.bankAccount || ''
    row.height = 18
  })

  const totalRowNumber = firstDataRow + group.employees.length
  const totalRow = worksheet.getRow(totalRowNumber)
  worksheet.mergeCells(totalRowNumber, 1, totalRowNumber, 5)
  totalRow.getCell(1).value = 'Total'
  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  totalRow.getCell(1).font = { name: WORKBOOK_FONT, bold: true, size: 9 }


  plan.columns.forEach((_, columnIndex) => {
    const col = firstDateCol + columnIndex
    const letter = columnLetter(col)
    totalRow.getCell(col).value = {
      formula: `SUM(${letter}${firstDataRow}:${letter}${Math.max(firstDataRow, totalRowNumber - 1)})`,
      result: formatHourValue(
        group.employees.reduce((sum, employee) => sum + getEmployeeHoursForDate(employee, plan.columns[columnIndex].otDate), 0),
      ) || 0,
    }
  })

  const totalFormulaColumns = [
    { col: moneyStartCol, result: group.summary.otUsd },
    { col: moneyStartCol + 1, result: group.summary.allowanceUsd },
    { col: moneyStartCol + 2, result: group.summary.totalUsd },
    { col: moneyStartCol + 3, result: group.summary.totalKhrRounded },
  ]

  totalFormulaColumns.forEach(({ col, result }) => {
    const letter = columnLetter(col)
    totalRow.getCell(col).value = {
      formula: `SUM(${letter}${firstDataRow}:${letter}${Math.max(firstDataRow, totalRowNumber - 1)})`,
      result,
    }
  })

  denominations.forEach((denomination, columnIndex) => {
    const col = denominationStartCol + columnIndex
    const letter = columnLetter(col)
    totalRow.getCell(col).value = {
      formula: `SUM(${letter}${firstDataRow}:${letter}${Math.max(firstDataRow, totalRowNumber - 1)})`,
      result: group.summary.breakdown[String(denomination)] || 0,
    }
  })

  totalRow.height = 20
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: WORKBOOK_FONT, bold: true, size: 8 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    }
  })

  const signatureRowNumber = totalRowNumber + 5
  const lineRowNumber = signatureRowNumber + SIGNATURE_LINE_OFFSET
  addSignatureBlock(worksheet, signatureRowNumber, signatureCol + 1)

  return {
    firstDataRow,
    totalRowNumber,
    lastTableRow: totalRowNumber,
    lastUsedRow: lineRowNumber,
    signatureRowNumber,
    moneyStartCol,
    denominationStartCol,
    signatureCol,
  }
}

function styleSubtotalRows(worksheet, rowNumbers = [], lastCol) {
  rowNumbers.forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber)
    row.height = 20
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: WORKBOOK_FONT, bold: true, size: 8 }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      }
    })
  })
}

function finishDetailSheet(worksheet, metrics, plan, denominations = [], options = {}) {
  const lastCol = metrics.signatureCol + 1
  applyBaseSheetStyle(worksheet)
  styleRangeBorder(worksheet, 3, metrics.lastTableRow, 1, lastCol)

  for (let rowNumber = metrics.firstDataRow; rowNumber <= metrics.lastTableRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: [3, 4, 5].includes(colNumber) ? 'left' : 'center',
        wrapText: true,
      }
    })
  }

  styleSubtotalRows(worksheet, metrics.subtotalRows || [metrics.totalRowNumber], lastCol)
  styleNumberColumn(worksheet, [5], '@')

  const hourColumns = []
  for (let index = 0; index < plan.columns.length; index += 1) hourColumns.push(6 + index)
  styleNumberColumn(worksheet, hourColumns, 'General')
  styleNumberColumn(worksheet, [metrics.moneyStartCol, metrics.moneyStartCol + 1, metrics.moneyStartCol + 2], '$#,##0.00')
  styleNumberColumn(worksheet, [metrics.moneyStartCol + 3], '#,##0')

  const denominationColumns = denominations.map((_, index) => metrics.denominationStartCol + index)
  styleNumberColumn(worksheet, denominationColumns, '#,##0')
  styleSignatureBlockText(worksheet, metrics.signatureRowNumber, lastCol)

  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: lastCol },
  }

  setSheetPrintLayout(worksheet, '1:3', {
    fitToHeight: options.fitOnePage ? 1 : 0,
  })
}

function addLineDetailSheet(workbook, data = {}, group = {}, denominations = []) {
  const sheetName = ensureUniqueSheetName(workbook, group.lineName || 'Line')
  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 15 },
  })

  const plan = buildDateColumnPlan(group)
  const lastCol = 5 + plan.columns.length + 4 + denominations.length + 2

  data.__denominations = denominations
  setDetailColumns(worksheet, plan.columns.length, denominations)
  addDetailHeader(worksheet, data, group, plan, lastCol)
  const metrics = addDetailRows(worksheet, group, plan, denominations)
  finishDetailSheet(worksheet, metrics, plan, denominations)

  return {
    group,
    worksheet,
    sheetName,
    totalRowNumber: metrics.totalRowNumber,
    firstDataRow: metrics.firstDataRow,
    moneyStartCol: metrics.moneyStartCol,
    denominationStartCol: metrics.denominationStartCol,
    denominationColumns: denominations.map((_, index) => metrics.denominationStartCol + index),
    employeeCount: group.employees.length,
  }
}


function groupEmployeeCount(group = {}) {
  return Array.isArray(group.employees) ? group.employees.length : 0
}

function sortGroupsByLineName(groups = []) {
  return [...groups].sort((a, b) => s(a.lineName).localeCompare(s(b.lineName), undefined, { numeric: true }))
}

function extractLineNumberFromText(value) {
  const text = s(value)
  if (!text) return null

  const matches = text.matchAll(/(?:^|\D)(\d{1,2})(?=$|\D)/g)
  for (const match of matches) {
    const lineNumber = Number(match[1])
    if (Number.isInteger(lineNumber) && lineNumber >= 1 && lineNumber <= 62) return lineNumber
  }

  return null
}

function getLineNumber(group = {}) {
  const candidates = [group.lineCode, group.lineName, group.key]

  for (const candidate of candidates) {
    const lineNumber = extractLineNumberFromText(candidate)
    if (lineNumber) return lineNumber
  }

  return null
}

function getLinePackBucket(group = {}) {
  const lineNumber = getLineNumber(group)

  if (lineNumber >= 1 && lineNumber <= 30) {
    return { key: 'LINE_01_30', label: 'Lines 01-30', order: 1 }
  }

  if (lineNumber >= 31 && lineNumber <= 62) {
    return { key: 'LINE_31_62', label: 'Lines 31-62', order: 2 }
  }

  return { key: 'OTHER_LINES', label: 'Other Lines', order: 3 }
}

function packGroupsWithinBucket(groups = [], maxRows = MAX_DETAIL_EMPLOYEE_ROWS_PER_SHEET) {
  const largeGroups = []
  const smallGroups = []

  sortGroupsByLineName(groups).forEach((group) => {
    const employeeRows = groupEmployeeCount(group)
    if (employeeRows > maxRows) {
      largeGroups.push({ groups: [group], employeeRows, isSingleLargeLine: true })
    } else {
      smallGroups.push(group)
    }
  })

  // Best-fit decreasing keeps small lines together and prevents many half-empty sheets.
  // A line with more than maxRows employees stays alone and can continue to page 2+.
  smallGroups.sort((a, b) => {
    const byRows = groupEmployeeCount(b) - groupEmployeeCount(a)
    if (byRows) return byRows
    return s(a.lineName).localeCompare(s(b.lineName), undefined, { numeric: true })
  })

  const packs = []
  for (const group of smallGroups) {
    const employeeRows = groupEmployeeCount(group)
    let bestPack = null
    let bestRemaining = Number.POSITIVE_INFINITY

    for (const pack of packs) {
      const remaining = maxRows - pack.employeeRows
      if (employeeRows <= remaining && remaining < bestRemaining) {
        bestPack = pack
        bestRemaining = remaining
      }
    }

    if (bestPack) {
      bestPack.groups.push(group)
      bestPack.employeeRows += employeeRows
    } else {
      packs.push({ groups: [group], employeeRows, isSingleLargeLine: false })
    }
  }

  return [...largeGroups, ...packs]
}

function packLineGroups(groups = [], maxRows = MAX_DETAIL_EMPLOYEE_ROWS_PER_SHEET) {
  const buckets = new Map()

  sortGroupsByLineName(groups).forEach((group) => {
    const bucket = getLinePackBucket(group)
    const existing = buckets.get(bucket.key) || { ...bucket, groups: [] }
    existing.groups.push(group)
    buckets.set(bucket.key, existing)
  })

  const bucketList = Array.from(buckets.values()).sort((a, b) => a.order - b.order)
  const result = []

  bucketList.forEach((bucket) => {
    const bucketPacks = packGroupsWithinBucket(bucket.groups, maxRows)

    bucketPacks.forEach((pack, index) => {
      result.push({
        ...pack,
        index: result.length + 1,
        bucketIndex: index + 1,
        bucketKey: bucket.key,
        bucketLabel: bucket.label,
        groups: sortGroupsByLineName(pack.groups),
      })
    })
  })

  return result
}

function buildPackedDateColumnPlan(groups = []) {
  const dateMap = new Map()

  groups.forEach((group) => {
    ;(group.dates || []).forEach((date) => {
      if (!dateMap.has(date.otDate)) {
        dateMap.set(date.otDate, {
          key: date.otDate,
          otDate: date.otDate,
          label: formatDateHeader(date.otDate, date.display || date.label),
        })
      }
    })
  })

  return {
    columns: Array.from(dateMap.values()).sort((a, b) => s(a.otDate).localeCompare(s(b.otDate))),
    dateSpans: [],
  }
}

function packSheetName(pack = {}) {
  const groups = pack.groups || []
  if (groups.length === 1) return groups[0].lineName || `Line ${pack.index}`

  const names = groups.map((group) => s(group.lineName || group.lineCode)).filter(Boolean)
  if (names.length <= 3) return `Lines ${names.join(', ')}`

  const bucketLabel = s(pack.bucketLabel)
  if (bucketLabel) return `${bucketLabel} P${String(pack.bucketIndex || pack.index || 1).padStart(2, '0')}`

  return `Lines Pack ${String(pack.index).padStart(2, '0')}`
}

function addPackedDetailRows(worksheet, pack = {}, plan = {}, denominations = []) {
  const groups = pack.groups || []
  const firstDataRow = 4
  const firstDateCol = 6
  const moneyStartCol = firstDateCol + plan.columns.length
  const denominationStartCol = moneyStartCol + 4
  const signatureCol = denominationStartCol + denominations.length
  const lineDetails = []
  const subtotalRows = []

  let rowNumber = firstDataRow
  let runningNo = 1

  groups.forEach((group) => {
    const groupFirstRow = rowNumber

    group.employees.forEach((employee) => {
      const row = worksheet.getRow(rowNumber)

      row.getCell(1).value = runningNo
      row.getCell(2).value = employee.employeeNo
      row.getCell(3).value = employee.employeeName
      row.getCell(4).value = employee.positionName
      row.getCell(5).value = lineDisplayValue(group)

      plan.columns.forEach((column, columnIndex) => {
        const hours = getEmployeeHoursForDate(employee, column.otDate)
        row.getCell(firstDateCol + columnIndex).value = formatHourValue(hours)
      })

      row.getCell(moneyStartCol).value = roundAmount(employee.otUsd, 2)
      row.getCell(moneyStartCol + 1).value = roundAmount(employee.allowanceUsd, 2)
      row.getCell(moneyStartCol + 2).value = roundAmount(employee.totalUsd, 2)
      row.getCell(moneyStartCol + 3).value = Math.round(employee.totalKhrRounded)

      denominations.forEach((denomination, columnIndex) => {
        row.getCell(denominationStartCol + columnIndex).value = n(employee.breakdown[String(denomination)], 0) || null
      })

      row.getCell(signatureCol).value = ''
      row.getCell(signatureCol + 1).value = employee.bankAccount || ''
      row.height = 18

      rowNumber += 1
      runningNo += 1
    })

    const subtotalRowNumber = rowNumber
    const subtotalRow = worksheet.getRow(subtotalRowNumber)
    const lastEmployeeRow = Math.max(groupFirstRow, subtotalRowNumber - 1)

    worksheet.mergeCells(subtotalRowNumber, 1, subtotalRowNumber, 5)
    subtotalRow.getCell(1).value = `${lineDisplayValue(group)} Total`

    plan.columns.forEach((_, columnIndex) => {
      const col = firstDateCol + columnIndex
      const letter = columnLetter(col)
      subtotalRow.getCell(col).value = {
        formula: `SUM(${letter}${groupFirstRow}:${letter}${lastEmployeeRow})`,
        result: formatHourValue(
          group.employees.reduce((sum, employee) => sum + getEmployeeHoursForDate(employee, plan.columns[columnIndex].otDate), 0),
        ) || 0,
      }
    })

    ;[
      { col: moneyStartCol, result: group.summary.otUsd },
      { col: moneyStartCol + 1, result: group.summary.allowanceUsd },
      { col: moneyStartCol + 2, result: group.summary.totalUsd },
      { col: moneyStartCol + 3, result: group.summary.totalKhrRounded },
    ].forEach(({ col, result }) => {
      const letter = columnLetter(col)
      subtotalRow.getCell(col).value = {
        formula: `SUM(${letter}${groupFirstRow}:${letter}${lastEmployeeRow})`,
        result,
      }
    })

    denominations.forEach((denomination, columnIndex) => {
      const col = denominationStartCol + columnIndex
      const letter = columnLetter(col)
      subtotalRow.getCell(col).value = {
        formula: `SUM(${letter}${groupFirstRow}:${letter}${lastEmployeeRow})`,
        result: group.summary.breakdown[String(denomination)] || 0,
      }
    })

    subtotalRow.height = 20
    subtotalRows.push(subtotalRowNumber)

    lineDetails.push({
      group,
      totalRowNumber: subtotalRowNumber,
      firstDataRow: groupFirstRow,
      moneyStartCol,
      denominationStartCol,
      denominationColumns: denominations.map((_, index) => denominationStartCol + index),
      employeeCount: group.employees.length,
    })

    rowNumber += 1
  })

  let sheetTotalRowNumber = null
  const lineSubtotalRows = [...subtotalRows]

  if (groups.length > 1 && lineSubtotalRows.length > 1) {
    sheetTotalRowNumber = rowNumber
    const sheetTotalRow = worksheet.getRow(sheetTotalRowNumber)
    const packSummary = summarizeItems(
      groups.flatMap((group) => (Array.isArray(group.items) ? group.items : [])),
      denominations,
    )

    const subtotalSumFormula = (col) => {
      const letter = columnLetter(col)
      return `SUM(${lineSubtotalRows.map((subtotalRow) => `${letter}${subtotalRow}`).join(',')})`
    }

    worksheet.mergeCells(sheetTotalRowNumber, 1, sheetTotalRowNumber, 5)
    sheetTotalRow.getCell(1).value = 'Sheet Total'

    plan.columns.forEach((_, columnIndex) => {
      const col = firstDateCol + columnIndex
      sheetTotalRow.getCell(col).value = {
        formula: subtotalSumFormula(col),
        result:
          formatHourValue(
            groups.reduce(
              (sum, group) =>
                sum +
                (group.employees || []).reduce(
                  (employeeSum, employee) =>
                    employeeSum + getEmployeeHoursForDate(employee, plan.columns[columnIndex].otDate),
                  0,
                ),
              0,
            ),
          ) || 0,
      }
    })

    ;[
      { col: moneyStartCol, result: packSummary.otUsd },
      { col: moneyStartCol + 1, result: packSummary.allowanceUsd },
      { col: moneyStartCol + 2, result: packSummary.totalUsd },
      { col: moneyStartCol + 3, result: packSummary.totalKhrRounded },
    ].forEach(({ col, result }) => {
      sheetTotalRow.getCell(col).value = {
        formula: subtotalSumFormula(col),
        result,
      }
    })

    denominations.forEach((denomination, columnIndex) => {
      const col = denominationStartCol + columnIndex
      sheetTotalRow.getCell(col).value = {
        formula: subtotalSumFormula(col),
        result: packSummary.breakdown[String(denomination)] || 0,
      }
    })

    sheetTotalRow.height = 20
    subtotalRows.push(sheetTotalRowNumber)
    rowNumber += 1
  }

  const signatureRowNumber = rowNumber + 4
  const lineRowNumber = signatureRowNumber + SIGNATURE_LINE_OFFSET
  addSignatureBlock(worksheet, signatureRowNumber, signatureCol + 1)

  return {
    firstDataRow,
    totalRowNumber: sheetTotalRowNumber || subtotalRows[subtotalRows.length - 1] || firstDataRow,
    subtotalRows,
    sheetTotalRowNumber,
    lastTableRow: Math.max(firstDataRow, rowNumber - 1),
    lastUsedRow: lineRowNumber,
    signatureRowNumber,
    moneyStartCol,
    denominationStartCol,
    signatureCol,
    lineDetails,
  }
}

function addPackedDetailSheet(workbook, data = {}, pack = {}, denominations = []) {
  const requestedName = packSheetName(pack)
  const sheetName = ensureUniqueSheetName(workbook, requestedName)
  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 15 },
  })

  const plan = buildPackedDateColumnPlan(pack.groups || [])
  const lastCol = 5 + plan.columns.length + 4 + denominations.length + 2

  data.__denominations = denominations
  setDetailColumns(worksheet, plan.columns.length, denominations)
  addDetailHeader(worksheet, data, { lineName: requestedName }, plan, lastCol)
  const metrics = addPackedDetailRows(worksheet, pack, plan, denominations)
  finishDetailSheet(worksheet, metrics, plan, denominations, {
    fitOnePage: n(pack.employeeRows, 0) <= MAX_DETAIL_EMPLOYEE_ROWS_PER_SHEET,
  })

  return metrics.lineDetails.map((detail) => ({
    ...detail,
    worksheet,
    sheetName,
    packedLineCount: (pack.groups || []).length,
  }))
}

function addSummaryHeader(worksheet, data = {}, lastCol) {
  worksheet.getCell(1, 1).value = COMPANY_NAME
  worksheet.getCell(2, 1).value = `Payment Summary by Line (${getPeriodLabel(data)}${getSelectedDateNote(data)})`
  worksheet.mergeCells(1, 1, 1, lastCol)
  worksheet.mergeCells(2, 1, 2, lastCol)
  styleTitleRow(worksheet.getRow(1), 12)
  styleTitleRow(worksheet.getRow(2), 11)

  const headers = [
    'No',
    'Line',
    'Employees',
    'OT Hours',
    'OT Amount\n$',
    'Allowance\n$',
    'Total\n$',
    'Latest Amount\nKHR',
  ]

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(4, index + 1)
    cell.value = header
    styleHeaderCell(cell)
  })

  const denominations = data.__denominations || []
  const denominationStartCol = headers.length + 1
  denominations.forEach((denomination, index) => {
    const cell = worksheet.getCell(4, denominationStartCol + index)
    cell.value = denomination
    styleHeaderCell(cell)
  })

  const varianceCol = denominationStartCol + denominations.length
  const varianceCell = worksheet.getCell(4, varianceCol)
  varianceCell.value = 'Variance'
  styleHeaderCell(varianceCell)

  worksheet.getRow(4).height = 20

  return {
    denominationStartCol,
    varianceCol,
  }
}

function addSummaryRows(worksheet, data = {}, detailSheets = [], denominations = []) {
  const lastCol = 8 + denominations.length + 1
  const headerInfo = addSummaryHeader(worksheet, data, lastCol)
  const firstDataRow = 5

  detailSheets.forEach((detail, index) => {
    const rowNumber = firstDataRow + index
    const row = worksheet.getRow(rowNumber)
    const quotedSheet = quoteSheetName(detail.sheetName)
    const totalRow = detail.totalRowNumber
    const moneyStartCol = detail.moneyStartCol
    const denominationStartCol = detail.denominationStartCol

    row.getCell(1).value = index + 1
    row.getCell(2).value = lineDisplayValue(detail.group)
    row.getCell(3).value = detail.employeeCount

    const firstHourCol = 6
    const lastHourCol = moneyStartCol - 1
    row.getCell(4).value = {
      formula: `SUM(${quotedSheet}!${columnLetter(firstHourCol)}${totalRow}:${columnLetter(lastHourCol)}${totalRow})`,
      result: detail.group.summary.payableHours,
    }
    row.getCell(5).value = {
      formula: `${quotedSheet}!${columnLetter(moneyStartCol)}${totalRow}`,
      result: detail.group.summary.otUsd,
    }
    row.getCell(6).value = {
      formula: `${quotedSheet}!${columnLetter(moneyStartCol + 1)}${totalRow}`,
      result: detail.group.summary.allowanceUsd,
    }
    row.getCell(7).value = {
      formula: `${quotedSheet}!${columnLetter(moneyStartCol + 2)}${totalRow}`,
      result: detail.group.summary.totalUsd,
    }
    row.getCell(8).value = {
      formula: `${quotedSheet}!${columnLetter(moneyStartCol + 3)}${totalRow}`,
      result: detail.group.summary.totalKhrRounded,
    }

    denominations.forEach((_, denominationIndex) => {
      const summaryCol = headerInfo.denominationStartCol + denominationIndex
      const detailCol = denominationStartCol + denominationIndex
      row.getCell(summaryCol).value = {
        formula: `${quotedSheet}!${columnLetter(detailCol)}${totalRow}`,
        result: detail.group.summary.breakdown[String(denominations[denominationIndex])] || 0,
      }
    })

    row.getCell(headerInfo.varianceCol).value = detail.group.summary.variance
    row.height = 18
  })

  const totalRowNumber = firstDataRow + detailSheets.length
  const totalRow = worksheet.getRow(totalRowNumber)
  worksheet.mergeCells(totalRowNumber, 1, totalRowNumber, 2)
  totalRow.getCell(1).value = 'Grand Total'
  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  const grandResults = {
    3: detailSheets.reduce((sum, detail) => sum + n(detail.employeeCount, 0), 0),
    4: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.payableHours, 0), 0), 2),
    5: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.otUsd, 0), 0), 2),
    6: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.allowanceUsd, 0), 0), 2),
    7: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.totalUsd, 0), 0), 2),
    8: detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.totalKhrRounded, 0), 0),
    [headerInfo.varianceCol]: detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.variance, 0), 0),
  }

  denominations.forEach((denomination, denominationIndex) => {
    const col = headerInfo.denominationStartCol + denominationIndex
    grandResults[col] = detailSheets.reduce(
      (sum, detail) => sum + n(detail.group.summary.breakdown[String(denomination)], 0),
      0,
    )
  })

  for (let col = 3; col <= lastCol; col += 1) {
    const letter = columnLetter(col)
    totalRow.getCell(col).value = {
      formula: `SUM(${letter}${firstDataRow}:${letter}${Math.max(firstDataRow, totalRowNumber - 1)})`,
      result: grandResults[col] || 0,
    }
  }

  totalRow.height = 20
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: WORKBOOK_FONT, bold: true, size: 8 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    }
  })

  const signatureRowNumber = totalRowNumber + 5
  const lineRowNumber = signatureRowNumber + SIGNATURE_LINE_OFFSET
  addSignatureBlock(worksheet, signatureRowNumber, lastCol)

  applyBaseSheetStyle(worksheet)
  styleRangeBorder(worksheet, 4, totalRowNumber, 1, lastCol)

  for (let rowNumber = firstDataRow; rowNumber <= totalRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 2 ? 'left' : 'center',
        wrapText: true,
      }
    })
  }

  styleNumberColumn(worksheet, [4], 'General')
  styleNumberColumn(worksheet, [5, 6, 7], '$#,##0.00')
  styleNumberColumn(worksheet, [8], '#,##0')
  styleNumberColumn(
    worksheet,
    denominations.map((_, index) => headerInfo.denominationStartCol + index),
    '#,##0',
  )
  styleNumberColumn(worksheet, [headerInfo.varianceCol], '#,##0')
  styleSignatureBlockText(worksheet, signatureRowNumber, lastCol)

  worksheet.views = [{ state: 'frozen', ySplit: 4 }]
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: lastCol },
  }

  setSummaryColumns(worksheet, denominations)
  setSheetPrintLayout(worksheet, '1:4')
}


function setAuditColumns(worksheet) {
  const widths = [4.5, 12, 13, 12, 20, 10, 16, 13, 10, 13, 10, 10, 11, 10, 18, 11, 11, 11, 12, 12, 35]

  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
}

function auditLineValue(row = {}) {
  return s(row.lineCode || row.lineName || 'No Line')
}

function auditAttendanceStatus(row = {}) {
  const status = upper(row.attendanceStatus)
  if (status) return status.replace(/_/g, ' ')

  const otResult = upper(row.otResult)
  if (otResult === 'MATCH') return 'PRESENT'
  if (otResult === 'MISMATCH') return 'ABSENT / MISMATCH'
  if (otResult === 'PENDING_REVIEW') return 'PENDING REVIEW'

  return ''
}

function auditIssueText(row = {}) {
  return s(row.issueReason || row.otResultReason || row.paymentBlockedReason)
}

function sortedAuditRows(data = {}) {
  return (Array.isArray(data.auditRows) ? data.auditRows : [])
    .slice()
    .sort((a, b) => {
      const byLine = auditLineValue(a).localeCompare(auditLineValue(b), undefined, { numeric: true })
      if (byLine) return byLine

      const byEmployee = s(a.employeeNo).localeCompare(s(b.employeeNo), undefined, { numeric: true })
      if (byEmployee) return byEmployee

      const byDate = s(a.otDate).localeCompare(s(b.otDate))
      if (byDate) return byDate

      return s(a.requestNo).localeCompare(s(b.requestNo), undefined, { numeric: true })
    })
}

function addAllRequestAuditSheet(workbook, data = {}) {
  const rows = sortedAuditRows(data)
  const worksheet = workbook.addWorksheet('All Request Check', {
    properties: { defaultRowHeight: 15 },
  })

  const headers = [
    'No',
    'Request No',
    'OT Request Date',
    'Employee ID',
    'Employee Name',
    'Line Code',
    'Position',
    'Request Status',
    'Requested H',
    'Attendance',
    'Scan In',
    'Scan Out',
    'Actual OT H',
    'Paid H',
    'Formula',
    'OT Amount\n$',
    'Allowance\n$',
    'Total\n$',
    'Total KHR',
    'Payment Status',
    'Issue / Reason',
  ]

  const lastCol = headers.length

  worksheet.getCell(1, 1).value = COMPANY_NAME
  worksheet.getCell(2, 1).value = `All OT Request Check (${getPeriodLabel(data)}${getSelectedDateNote(data)})`
  worksheet.mergeCells(1, 1, 1, lastCol)
  worksheet.mergeCells(2, 1, 2, lastCol)
  styleTitleRow(worksheet.getRow(1), 12)
  styleTitleRow(worksheet.getRow(2), 11)

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(4, index + 1)
    cell.value = header
    styleHeaderCell(cell)
  })
  worksheet.getRow(4).height = 24

  const firstDataRow = 5

  if (!rows.length) {
    worksheet.mergeCells(firstDataRow, 1, firstDataRow, lastCol)
    worksheet.getCell(firstDataRow, 1).value = 'No OT request rows found for this payment period.'
    worksheet.getCell(firstDataRow, 1).alignment = { horizontal: 'center', vertical: 'middle' }
  }

  rows.forEach((item, index) => {
    const rowNumber = firstDataRow + index
    const row = worksheet.getRow(rowNumber)

    row.getCell(1).value = index + 1
    row.getCell(2).value = s(item.requestNo)
    row.getCell(3).value = formatShortDate(item.otDate, item.otDateDisplay)
    row.getCell(4).value = upper(item.employeeNo)
    row.getCell(5).value = s(item.employeeName)
    row.getCell(6).value = auditLineValue(item)
    row.getCell(7).value = s(item.positionName)
    row.getCell(8).value = upper(item.requestStatus)
    row.getCell(9).value = formatHourValue(item.requestedHours)
    row.getCell(10).value = auditAttendanceStatus(item)
    row.getCell(11).value = s(item.clockIn)
    row.getCell(12).value = s(item.clockOut)
    row.getCell(13).value = formatHourValue(item.actualOtHours)
    row.getCell(14).value = formatHourValue(item.payableHours)
    row.getCell(15).value = s(item.rateFormula)
    row.getCell(16).value = roundAmount(item.amountUsd, 2)
    row.getCell(17).value = roundAmount(item.allowanceAmountUsd, 2)
    row.getCell(18).value = roundAmount(item.totalUsd, 2)
    row.getCell(19).value = Math.round(n(item.totalKhr, 0))
    row.getCell(20).value = s(item.paymentStatus)
    row.getCell(21).value = auditIssueText(item)
    row.height = 18
  })

  const lastDataRow = rows.length ? firstDataRow + rows.length - 1 : firstDataRow
  const totalRowNumber = lastDataRow + 1

  if (rows.length) {
    const totalRow = worksheet.getRow(totalRowNumber)
    worksheet.mergeCells(totalRowNumber, 1, totalRowNumber, 8)
    totalRow.getCell(1).value = 'Total'
    totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

    ;[9, 13, 14, 16, 17, 18, 19].forEach((col) => {
      const letter = columnLetter(col)
      totalRow.getCell(col).value = {
        formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,
        result: rows.reduce((sum, item) => {
          if (col === 9) return sum + n(item.requestedHours, 0)
          if (col === 13) return sum + n(item.actualOtHours, 0)
          if (col === 14) return sum + n(item.payableHours, 0)
          if (col === 16) return sum + n(item.amountUsd, 0)
          if (col === 17) return sum + n(item.allowanceAmountUsd, 0)
          if (col === 18) return sum + n(item.totalUsd, 0)
          if (col === 19) return sum + n(item.totalKhr, 0)
          return sum
        }, 0),
      }
    })

    totalRow.height = 20
    totalRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: WORKBOOK_FONT, bold: true, size: 8 }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      }
    })
  }

  applyBaseSheetStyle(worksheet)
  styleRangeBorder(worksheet, 4, rows.length ? totalRowNumber : firstDataRow, 1, lastCol)

  for (let rowNumber = firstDataRow; rowNumber <= (rows.length ? totalRowNumber : firstDataRow); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: [5, 7, 15, 21].includes(colNumber) ? 'left' : 'center',
        wrapText: true,
      }
    })
  }

  styleNumberColumn(worksheet, [9, 13, 14], 'General')
  styleNumberColumn(worksheet, [16, 17, 18], '$#,##0.00')
  styleNumberColumn(worksheet, [19], '#,##0')
  setAuditColumns(worksheet)

  worksheet.views = [{ state: 'frozen', ySplit: 4 }]
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: lastCol },
  }

  setSheetPrintLayout(worksheet, '1:4')

  return worksheet
}

async function buildPaymentWorkbook(data) {
  const workbook = new ExcelJS.Workbook()
  applyWorkbookProperties(workbook)

  const denominations = getDenominations(data)
  const groups = buildLineGroups(data, denominations)
  data.__denominations = denominations

  const summarySheet = workbook.addWorksheet('Summary All Lines', {
    properties: { defaultRowHeight: 15 },
  })

  // Sheet 2 is a request-level audit/check sheet. It lists every employee/date
  // from an OT request, including absent or partial-pay rows that do not appear
  // in the bank/payment detail sheets.
  addAllRequestAuditSheet(workbook, data)

  const detailSheets = []
  const packedLineGroups = packLineGroups(groups)

  // Detail sheets are packed by line to save paper. Small lines share one sheet
  // up to MAX_DETAIL_EMPLOYEE_ROWS_PER_SHEET employee records. Large lines stay
  // alone and can continue to page 2+ with the header repeated.
  for (const pack of packedLineGroups) {
    detailSheets.push(...addPackedDetailSheet(workbook, data, pack, denominations))
  }

  // The summary is built after detail sheets exist so it can pull each line
  // total from the finished packed sheet instead of listing employees again.
  addSummaryRows(summarySheet, data, detailSheets, denominations)

  if (!groups.length) {
    const emptySheet = workbook.addWorksheet('No Payment Rows')
    emptySheet.getCell('A1').value = COMPANY_NAME
    emptySheet.getCell('A2').value = 'No payable OT rows found for this payment period.'
    styleTitleRow(emptySheet.getRow(1), 12)
    styleTitleRow(emptySheet.getRow(2), 11)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
}

module.exports = {
  buildSalaryTemplateWorkbook,
  buildPaymentWorkbook,
}
