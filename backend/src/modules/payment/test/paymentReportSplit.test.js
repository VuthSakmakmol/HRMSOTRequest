const assert = require('assert')

const { splitPaymentPreviewData } = require('../services/paymentReportSplit.service')

function run() {
  const source = {
    items: [
      { employeeNo: '1001', positionId: 'truck-position', positionCode: 'TRUCK_LOADING', positionName: 'Truck Loading' },
      { employeeNo: '1002', positionId: 'sewer-position', positionCode: 'SEWER', positionName: 'Sewer' },
    ],
    auditRows: [
      { employeeNo: '1001', positionId: 'truck-position', positionCode: 'TRUCK_LOADING', positionName: 'Truck Loading' },
      { employeeNo: '1002', positionId: 'sewer-position', positionCode: 'SEWER', positionName: 'Sewer' },
    ],
  }

  const result = splitPaymentPreviewData(source, {
    separatePositions: [{ id: 'truck-position', code: 'TRUCK_LOADING', name: 'Truck Loading' }],
  })

  assert.strictEqual(result.enabled, true)
  assert.deepStrictEqual(result.main.items.map((item) => item.employeeNo), ['1002'])
  assert.deepStrictEqual(result.separate.items.map((item) => item.employeeNo), ['1001'])
  assert.deepStrictEqual(result.main.auditRows.map((item) => item.employeeNo), ['1002'])
  assert.deepStrictEqual(result.separate.auditRows.map((item) => item.employeeNo), ['1001'])
  assert.strictEqual(result.main.items.length + result.separate.items.length, source.items.length)

  const disabled = splitPaymentPreviewData(source, { separatePositions: [] })
  assert.strictEqual(disabled.enabled, false)
  assert.strictEqual(disabled.main, source)

  console.log('paymentReportSplit.test.js passed')
}

run()
