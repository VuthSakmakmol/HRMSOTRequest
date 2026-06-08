// backend/src/modules/payment/services/paymentExcel.service.js

const ExcelJS = require('exceljs')

const DEFAULT_DENOMINATIONS = [50000, 20000, 10000, 5000, 1000, 500, 100]
const COMPANY_NAME = 'Trax Apparel (Cambodia) Co., Ltd'
const WORKBOOK_FONT = 'Arial'

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
    totalUsd: 0,
    totalKhrRaw: 0,
    totalKhrRounded: 0,
    breakdown: emptyBreakdown(denominations),
  }

  for (const item of items) {
    result.payableHours += n(item.payableHours, 0)
    result.otUsd += n(item.amountUsd, 0)
    result.allowanceUsd += n(item.allowanceAmountUsd, 0)
    result.totalUsd += getItemTotalUsd(item)
    result.totalKhrRaw += getItemTotalKhrRaw(item)
    result.totalKhrRounded += getItemTotalKhrRounded(item)
    addBreakdown(result.breakdown, getItemBreakdown(item, denominations), denominations)
  }

  result.payableHours = roundAmount(result.payableHours, 2)
  result.otUsd = roundAmount(result.otUsd, 2)
  result.allowanceUsd = roundAmount(result.allowanceUsd, 2)
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
    const rateLabel = formatPercentFromMultiplier(item.multiplier)
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
        items: [],
        otUsd: 0,
        allowanceUsd: 0,
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
      employee.otUsd += n(item.amountUsd, 0)
      employee.allowanceUsd += n(item.allowanceAmountUsd, 0)
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

function reportTitle(data = {}, group = {}) {
  const period = getPeriodLabel(data)
  const line = s(group.lineName)
  return `(Name List Worker Working Extra OT On ${period})${line ? ` (${line})` : ''}`
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

function setSheetPrintLayout(worksheet, printTitleRows = '1:4') {
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
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
    horizontal: 'left',
    vertical: 'middle',
  }
}

function styleNumberColumn(worksheet, colNumbers = [], numberFormat = '#,##0') {
  colNumbers.forEach((colNumber) => {
    worksheet.getColumn(colNumber).numFmt = numberFormat
  })
}

function setDetailColumns(worksheet, dateRateCount, denominations = []) {
  const widths = [4.5, 10, 18, 13, 13, 8]
  for (let i = 0; i < dateRateCount; i += 1) widths.push(5.5)
  widths.push(10, 10, 10, 11)
  denominations.forEach(() => widths.push(6))
  widths.push(10, 13)

  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width
  })
}

function setSummaryColumns(worksheet, denominations = []) {
  const widths = [4.5, 18, 18, 10, 9, 11, 11, 11, 12]
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
  const columns = []
  const dateSpans = []
  let offset = 0

  for (const date of group.dates) {
    const rateColumns = group.rateLabels.filter((rate) => rate.otDate === date.otDate)
    const safeRates = rateColumns.length
      ? rateColumns
      : [
          {
            key: `${date.otDate}|OT`,
            otDate: date.otDate,
            rateLabel: 'OT',
          },
        ]

    dateSpans.push({
      date,
      startOffset: offset,
      endOffset: offset + safeRates.length - 1,
    })

    safeRates.forEach((rate) => {
      columns.push(rate)
      offset += 1
    })
  }

  return { columns, dateSpans }
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

  const fixedHeaders = ['No', 'ID', 'Name', 'Position', 'Department', 'Basic']
  fixedHeaders.forEach((header, index) => {
    const col = index + 1
    mergeIfNeeded(worksheet, 3, col, 4, col)
    const cell = worksheet.getCell(3, col)
    cell.value = header
    styleHeaderCell(cell)
    styleHeaderCell(worksheet.getCell(4, col))
  })

  const firstDateCol = 7
  plan.dateSpans.forEach((span) => {
    const startCol = firstDateCol + span.startOffset
    const endCol = firstDateCol + span.endOffset
    mergeIfNeeded(worksheet, 3, startCol, 3, endCol)
    const cell = worksheet.getCell(3, startCol)
    cell.value = span.date.label
    styleHeaderCell(cell)

    for (let col = startCol; col <= endCol; col += 1) {
      styleHeaderCell(worksheet.getCell(3, col))
    }
  })

  plan.columns.forEach((column, index) => {
    const cell = worksheet.getCell(4, firstDateCol + index)
    cell.value = column.rateLabel
    styleHeaderCell(cell)
  })

  const afterDateCol = firstDateCol + plan.columns.length
  const moneyHeaders = ['OT Amount\n$', 'Allowance\n$', 'Total\n$', 'Total KHR']
  moneyHeaders.forEach((header, index) => {
    const col = afterDateCol + index
    mergeIfNeeded(worksheet, 3, col, 4, col)
    const cell = worksheet.getCell(3, col)
    cell.value = header
    styleHeaderCell(cell)
    styleHeaderCell(worksheet.getCell(4, col))
  })

  const denominationStartCol = afterDateCol + moneyHeaders.length
  ;(data.__denominations || []).forEach((denomination, index) => {
    const col = denominationStartCol + index
    mergeIfNeeded(worksheet, 3, col, 4, col)
    const cell = worksheet.getCell(3, col)
    cell.value = denomination
    styleHeaderCell(cell)
    styleHeaderCell(worksheet.getCell(4, col))
  })

  const signatureCol = denominationStartCol + (data.__denominations || []).length
  ;['Signature', 'Bank Account'].forEach((header, index) => {
    const col = signatureCol + index
    mergeIfNeeded(worksheet, 3, col, 4, col)
    const cell = worksheet.getCell(3, col)
    cell.value = header
    styleHeaderCell(cell)
    styleHeaderCell(worksheet.getCell(4, col))
  })

  worksheet.getRow(3).height = 16
  worksheet.getRow(4).height = 16
}

function addDetailRows(worksheet, group = {}, plan = {}, denominations = []) {
  const firstDataRow = 5
  const firstDateCol = 7
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
    row.getCell(5).value = employee.departmentName
    row.getCell(6).value = employee.monthlySalary || null

    plan.columns.forEach((column, columnIndex) => {
      const hours = n(employee.hoursByDateRate.get(column.key), 0)
      row.getCell(firstDateCol + columnIndex).value = hours > 0 ? hours : null
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

  totalRow.getCell(6).value = ''

  plan.columns.forEach((_, columnIndex) => {
    const col = firstDateCol + columnIndex
    const letter = columnLetter(col)
    totalRow.getCell(col).value = {
      formula: `SUM(${letter}${firstDataRow}:${letter}${Math.max(firstDataRow, totalRowNumber - 1)})`,
      result: roundAmount(
        group.employees.reduce((sum, employee) => sum + n(employee.hoursByDateRate.get(plan.columns[columnIndex].key), 0), 0),
        2,
      ),
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

  const signatureRowNumber = totalRowNumber + 3
  worksheet.getCell(signatureRowNumber, 1).value = 'Prepared By Payroll Leader'
  worksheet.getCell(signatureRowNumber, Math.max(1, Math.floor(signatureCol / 2) - 2)).value = 'Checked By Sup HR'
  worksheet.getCell(signatureRowNumber, Math.max(1, signatureCol - 3)).value = 'Verified By HRM'

  ;[1, Math.max(1, Math.floor(signatureCol / 2) - 2), Math.max(1, signatureCol - 3)].forEach((col) => {
    const cell = worksheet.getCell(signatureRowNumber, col)
    cell.font = { name: WORKBOOK_FONT, size: 9, bold: true }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
  })

  const lineRowNumber = signatureRowNumber + 2
  worksheet.getCell(lineRowNumber, 1).value = '________________________'
  worksheet.getCell(lineRowNumber, Math.max(1, Math.floor(signatureCol / 2) - 2)).value = '________________________'
  worksheet.getCell(lineRowNumber, Math.max(1, signatureCol - 3)).value = '________________________'

  return {
    firstDataRow,
    totalRowNumber,
    lastTableRow: totalRowNumber,
    lastUsedRow: lineRowNumber,
    moneyStartCol,
    denominationStartCol,
    signatureCol,
  }
}

function finishDetailSheet(worksheet, metrics, plan, denominations = []) {
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

  styleNumberColumn(worksheet, [6], '#,##0.00')

  const hourColumns = []
  for (let index = 0; index < plan.columns.length; index += 1) hourColumns.push(7 + index)
  styleNumberColumn(worksheet, hourColumns, '0.##')
  styleNumberColumn(worksheet, [metrics.moneyStartCol, metrics.moneyStartCol + 1, metrics.moneyStartCol + 2], '$#,##0.00')
  styleNumberColumn(worksheet, [metrics.moneyStartCol + 3], '#,##0')

  const denominationColumns = denominations.map((_, index) => metrics.denominationStartCol + index)
  styleNumberColumn(worksheet, denominationColumns, '#,##0')

  worksheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }]
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: lastCol },
  }

  setSheetPrintLayout(worksheet, '1:4')
}

function addLineDetailSheet(workbook, data = {}, group = {}, denominations = []) {
  const sheetName = ensureUniqueSheetName(workbook, group.lineName || 'Line')
  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultRowHeight: 15 },
  })

  const plan = buildDateColumnPlan(group)
  const lastCol = 6 + plan.columns.length + 4 + denominations.length + 2

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

function addSummaryHeader(worksheet, data = {}, lastCol) {
  worksheet.getCell(1, 1).value = COMPANY_NAME
  worksheet.getCell(2, 1).value = `Payment Summary by Line (${getPeriodLabel(data)})`
  worksheet.mergeCells(1, 1, 1, lastCol)
  worksheet.mergeCells(2, 1, 2, lastCol)
  styleTitleRow(worksheet.getRow(1), 12)
  styleTitleRow(worksheet.getRow(2), 11)

  const headers = [
    'No',
    'Line',
    'Sheet',
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
  const lastCol = 9 + denominations.length + 1
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
    row.getCell(2).value = detail.group.lineName
    row.getCell(3).value = detail.sheetName
    row.getCell(4).value = detail.employeeCount

    const firstHourCol = 7
    const lastHourCol = moneyStartCol - 1
    row.getCell(5).value = {
      formula: `SUM(${quotedSheet}!${columnLetter(firstHourCol)}${totalRow}:${columnLetter(lastHourCol)}${totalRow})`,
      result: detail.group.summary.payableHours,
    }
    row.getCell(6).value = {
      formula: `${quotedSheet}!${columnLetter(moneyStartCol)}${totalRow}`,
      result: detail.group.summary.otUsd,
    }
    row.getCell(7).value = {
      formula: `${quotedSheet}!${columnLetter(moneyStartCol + 1)}${totalRow}`,
      result: detail.group.summary.allowanceUsd,
    }
    row.getCell(8).value = {
      formula: `${quotedSheet}!${columnLetter(moneyStartCol + 2)}${totalRow}`,
      result: detail.group.summary.totalUsd,
    }
    row.getCell(9).value = {
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
  worksheet.mergeCells(totalRowNumber, 1, totalRowNumber, 3)
  totalRow.getCell(1).value = 'Grand Total'
  totalRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

  const grandResults = {
    4: detailSheets.reduce((sum, detail) => sum + n(detail.employeeCount, 0), 0),
    5: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.payableHours, 0), 0), 2),
    6: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.otUsd, 0), 0), 2),
    7: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.allowanceUsd, 0), 0), 2),
    8: roundAmount(detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.totalUsd, 0), 0), 2),
    9: detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.totalKhrRounded, 0), 0),
    [headerInfo.varianceCol]: detailSheets.reduce((sum, detail) => sum + n(detail.group.summary.variance, 0), 0),
  }

  denominations.forEach((denomination, denominationIndex) => {
    const col = headerInfo.denominationStartCol + denominationIndex
    grandResults[col] = detailSheets.reduce(
      (sum, detail) => sum + n(detail.group.summary.breakdown[String(denomination)], 0),
      0,
    )
  })

  for (let col = 4; col <= lastCol; col += 1) {
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

  const signatureRowNumber = totalRowNumber + 3
  worksheet.getCell(signatureRowNumber, 1).value = 'Prepared By Payroll Leader'
  worksheet.getCell(signatureRowNumber, 5).value = 'Checked By Sup HR'
  worksheet.getCell(signatureRowNumber, Math.max(8, lastCol - 2)).value = 'Verified By HRM'

  ;[1, 5, Math.max(8, lastCol - 2)].forEach((col) => {
    const cell = worksheet.getCell(signatureRowNumber, col)
    cell.font = { name: WORKBOOK_FONT, size: 9, bold: true }
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
  })

  const lineRowNumber = signatureRowNumber + 2
  worksheet.getCell(lineRowNumber, 1).value = '________________________'
  worksheet.getCell(lineRowNumber, 5).value = '________________________'
  worksheet.getCell(lineRowNumber, Math.max(8, lastCol - 2)).value = '________________________'

  applyBaseSheetStyle(worksheet)
  styleRangeBorder(worksheet, 4, totalRowNumber, 1, lastCol)

  for (let rowNumber = firstDataRow; rowNumber <= totalRowNumber; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: [2, 3].includes(colNumber) ? 'left' : 'center',
        wrapText: true,
      }
    })
  }

  styleNumberColumn(worksheet, [5], '0.##')
  styleNumberColumn(worksheet, [6, 7, 8], '$#,##0.00')
  styleNumberColumn(worksheet, [9], '#,##0')
  styleNumberColumn(
    worksheet,
    denominations.map((_, index) => headerInfo.denominationStartCol + index),
    '#,##0',
  )
  styleNumberColumn(worksheet, [headerInfo.varianceCol], '#,##0')

  worksheet.views = [{ state: 'frozen', ySplit: 4 }]
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: lastCol },
  }

  setSummaryColumns(worksheet, denominations)
  setSheetPrintLayout(worksheet, '1:4')
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

  const detailSheets = []

  // One detail sheet per production line. Each line sheet combines all OT dates
  // in the selected period, so payroll does not need to align/design manually.
  for (const group of groups) {
    detailSheets.push(addLineDetailSheet(workbook, data, group, denominations))
  }

  // The summary is built after detail sheets exist so it can pull each line
  // total from the finished line sheet instead of listing employees again.
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
