const Permission = require('../access/models/Permission')

const PAYMENT_REPORT_SETTING_PERMISSIONS = Object.freeze([
  {
    code: 'PAYMENT_REPORT_SETTING_VIEW',
    name: 'View Payment Report Separation',
    module: 'SETTINGS',
    description: 'Allow viewing positions configured for separate payment Excel reports',
  },
  {
    code: 'PAYMENT_REPORT_SETTING_CREATE',
    name: 'Create Payment Report Separation',
    module: 'SETTINGS',
    description: 'Allow adding positions to separate payment Excel reports',
  },
  {
    code: 'PAYMENT_REPORT_SETTING_UPDATE',
    name: 'Update Payment Report Separation',
    module: 'SETTINGS',
    description: 'Allow changing positions configured for separate payment Excel reports',
  },
  {
    code: 'PAYMENT_REPORT_SETTING_DELETE',
    name: 'Delete Payment Report Separation',
    module: 'SETTINGS',
    description: 'Allow removing positions from separate payment Excel reports',
  },
])

async function ensurePaymentReportSettingPermissions() {
  for (const item of PAYMENT_REPORT_SETTING_PERMISSIONS) {
    await Permission.findOneAndUpdate(
      { code: item.code },
      {
        $set: {
          ...item,
          isActive: true,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )
  }
}

module.exports = {
  PAYMENT_REPORT_SETTING_PERMISSIONS,
  ensurePaymentReportSettingPermissions,
}
