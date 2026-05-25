// backend/src/modules/ot/tests/otRequestSourceOfTruth.test.js

const assert = require('assert')

const {
  calculateRawWindowMinutes,
  calculateOverlapMinutes,
  buildTrustedOTTiming,
  buildTrustedEmployeeTiming,
} = require('../services/otRequestSourceOfTruth.service')

function runTest(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
  } catch (error) {
    console.error(`❌ ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

function baseShift(overrides = {}) {
  return {
    _id: 'shift-1',
    code: 'DAY',
    name: 'Day Shift',
    type: 'DAY',
    startTime: '07:00',
    endTime: '16:00',
    breakStartTime: '12:00',
    breakEndTime: '13:00',
    crossMidnight: false,
    ...overrides,
  }
}

function fixedOption(overrides = {}) {
  return {
    _id: 'option-fixed-1',
    label: '07:00 - 16:00',
    timingMode: 'FIXED_TIME',
    fixedStartTime: '07:00',
    fixedEndTime: '16:00',
    startAfterShiftEndMinutes: 0,
    requestedMinutes: 540,
    breakMinutes: 60,
    ...overrides,
  }
}

function afterShiftOption(overrides = {}) {
  return {
    _id: 'option-after-1',
    label: '2h after shift',
    timingMode: 'AFTER_SHIFT_END',
    fixedStartTime: '',
    fixedEndTime: '',
    startAfterShiftEndMinutes: 0,
    requestedMinutes: 120,
    breakMinutes: 0,
    ...overrides,
  }
}

runTest('raw same-day window: 07:00 → 16:00 = 540 minutes', () => {
  assert.strictEqual(calculateRawWindowMinutes('07:00', '16:00'), 540)
})

runTest('raw cross-midnight window: 22:00 → 02:00 = 240 minutes', () => {
  assert.strictEqual(calculateRawWindowMinutes('22:00', '02:00'), 240)
})

runTest('break overlap: OT 07:00 → 16:00 overlaps break 12:00 → 13:00 = 60 minutes', () => {
  assert.strictEqual(calculateOverlapMinutes('07:00', '16:00', '12:00', '13:00'), 60)
})

runTest('break overlap: OT 16:00 → 18:00 does not overlap break 12:00 → 13:00', () => {
  assert.strictEqual(calculateOverlapMinutes('16:00', '18:00', '12:00', '13:00'), 0)
})

runTest('fixed shift option: 07:00 → 16:00 minus 1h break = 480 paid minutes', () => {
  const result = buildTrustedOTTiming({
    payload: {
      otTimingSource: 'SHIFT_OPTION',
    },
    shift: baseShift(),
    shiftOtOption: fixedOption(),
  })

  assert.strictEqual(result.isValidTiming, true)
  assert.strictEqual(result.startTime, '07:00')
  assert.strictEqual(result.endTime, '16:00')
  assert.strictEqual(result.requestedMinutes, 540)
  assert.strictEqual(result.breakMinutes, 60)
  assert.strictEqual(result.totalRequestPaidMinutes, 480)
  assert.strictEqual(result.totalMinutes, 480)
  assert.strictEqual(result.totalHours, 8)
})

runTest('after-shift option: 16:00 → 18:00 with no break overlap = 120 paid minutes', () => {
  const result = buildTrustedOTTiming({
    payload: {
      otTimingSource: 'SHIFT_OPTION',
    },
    shift: baseShift(),
    shiftOtOption: afterShiftOption(),
  })

  assert.strictEqual(result.isValidTiming, true)
  assert.strictEqual(result.startTime, '16:00')
  assert.strictEqual(result.endTime, '18:00')
  assert.strictEqual(result.requestedMinutes, 120)
  assert.strictEqual(result.breakMinutes, 0)
  assert.strictEqual(result.totalRequestPaidMinutes, 120)
  assert.strictEqual(result.totalHours, 2)
})

runTest('after-shift option crossing break: 21:00 → 00:00 minus 22:00 → 23:00 break = 120 paid minutes', () => {
  const result = buildTrustedOTTiming({
    payload: {
      otTimingSource: 'SHIFT_OPTION',
    },
    shift: baseShift({
      startTime: '12:00',
      endTime: '21:00',
      breakStartTime: '22:00',
      breakEndTime: '23:00',
      crossMidnight: true,
    }),
    shiftOtOption: afterShiftOption({
      requestedMinutes: 180,
      breakMinutes: 0,
    }),
  })

  assert.strictEqual(result.isValidTiming, true)
  assert.strictEqual(result.startTime, '21:00')
  assert.strictEqual(result.endTime, '00:00')
  assert.strictEqual(result.requestedMinutes, 180)
  assert.strictEqual(result.breakMinutes, 60)
  assert.strictEqual(result.totalRequestPaidMinutes, 120)
  assert.strictEqual(result.totalHours, 2)
})

runTest('custom fixed time: 07:00 → 16:00 with 60-minute break = 480 paid minutes', () => {
  const result = buildTrustedOTTiming({
    payload: {
      otTimingSource: 'CUSTOM_FIXED',
      customStartTime: '07:00',
      customEndTime: '16:00',
      customBreakMinutes: 60,
    },
    shift: baseShift(),
    shiftOtOption: fixedOption(),
  })

  assert.strictEqual(result.isValidTiming, true)
  assert.strictEqual(result.otTimingSource, 'CUSTOM_FIXED')
  assert.strictEqual(result.startTime, '07:00')
  assert.strictEqual(result.endTime, '16:00')
  assert.strictEqual(result.requestedMinutes, 540)
  assert.strictEqual(result.breakMinutes, 60)
  assert.strictEqual(result.totalRequestPaidMinutes, 480)
  assert.strictEqual(result.totalHours, 8)
})

runTest('employee default timing inherits backend trusted request timing', () => {
  const requestTiming = buildTrustedOTTiming({
    payload: {
      otTimingSource: 'SHIFT_OPTION',
    },
    shift: baseShift(),
    shiftOtOption: fixedOption(),
  })

  const employeeTiming = buildTrustedEmployeeTiming({
    employeePayload: {
      employeeId: 'employee-1',
      otTimeMode: 'DEFAULT',
    },
    defaultTiming: requestTiming,
  })

  assert.strictEqual(employeeTiming.otTimeMode, 'DEFAULT')
  assert.strictEqual(employeeTiming.startTime, '07:00')
  assert.strictEqual(employeeTiming.endTime, '16:00')
  assert.strictEqual(employeeTiming.breakMinutes, 60)
  assert.strictEqual(employeeTiming.totalRequestPaidMinutes, 480)
  assert.strictEqual(employeeTiming.totalHours, 8)
})

runTest('employee custom timing recalculates its own paid minutes', () => {
  const requestTiming = buildTrustedOTTiming({
    payload: {
      otTimingSource: 'SHIFT_OPTION',
    },
    shift: baseShift(),
    shiftOtOption: fixedOption(),
  })

  const employeeTiming = buildTrustedEmployeeTiming({
    employeePayload: {
      employeeId: 'employee-1',
      otTimeMode: 'CUSTOM',
      requestStartTime: '17:00',
      requestEndTime: '19:00',
      breakMinutes: 0,
    },
    defaultTiming: requestTiming,
  })

  assert.strictEqual(employeeTiming.otTimeMode, 'CUSTOM')
  assert.strictEqual(employeeTiming.startTime, '17:00')
  assert.strictEqual(employeeTiming.endTime, '19:00')
  assert.strictEqual(employeeTiming.breakMinutes, 0)
  assert.strictEqual(employeeTiming.requestedMinutes, 120)
  assert.strictEqual(employeeTiming.totalRequestPaidMinutes, 120)
  assert.strictEqual(employeeTiming.totalHours, 2)
})

if (process.exitCode) {
  console.error('\nOT source-of-truth timing tests failed.')
  process.exit(process.exitCode)
}

console.log('\nAll OT source-of-truth timing tests passed.')