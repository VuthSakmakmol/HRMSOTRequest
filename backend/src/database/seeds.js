// backend/src/database/seeds.js

require('../config/env')

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const { connectMongo } = require('./mongoose')
const Permission = require('../modules/access/models/Permission')
const SystemRole = require('../modules/access/models/SystemRole')
const Account = require('../modules/auth/models/Account')

const ROOT_ADMIN_ROLE_CODE = 'ROOT_ADMIN'

function permission(code, name, module, description = '') {
  return {
    code,
    name,
    module,
    description,
  }
}

const PERMISSIONS = [
  // =========================
  // Auth / Accounts
  // =========================
  permission('ACCOUNT_VIEW', 'View Accounts', 'AUTH', 'Allow viewing account records'),
  permission('ACCOUNT_CREATE', 'Create Accounts', 'AUTH', 'Allow creating account records'),
  permission('ACCOUNT_UPDATE', 'Update Accounts', 'AUTH', 'Allow updating account records'),
  permission(
    'ACCOUNT_RESET_PASSWORD',
    'Reset Account Password',
    'AUTH',
    'Allow resetting account passwords',
  ),

  // =========================
  // Access / Permissions
  // =========================
  permission(
    'PERMISSION_VIEW',
    'View Permissions',
    'ORG',
    'Allow viewing permission master records',
  ),
  permission(
    'PERMISSION_CREATE',
    'Create Permissions',
    'ORG',
    'Allow creating permission master records',
  ),
  permission(
    'PERMISSION_UPDATE',
    'Update Permissions',
    'ORG',
    'Allow updating permission master records',
  ),

  // =========================
  // Access / Roles
  // =========================
  permission('ROLE_VIEW', 'View Roles', 'ORG', 'Allow viewing system roles'),
  permission('ROLE_CREATE', 'Create Roles', 'ORG', 'Allow creating system roles'),
  permission('ROLE_UPDATE', 'Update Roles', 'ORG', 'Allow updating system roles'),

  // =========================
  // Organization / Departments
  // =========================
  permission('DEPARTMENT_VIEW', 'View Departments', 'ORG', 'Allow viewing department records'),
  permission(
    'DEPARTMENT_CREATE',
    'Create Departments',
    'ORG',
    'Allow creating department records',
  ),
  permission(
    'DEPARTMENT_UPDATE',
    'Update Departments',
    'ORG',
    'Allow updating department records',
  ),
  permission(
    'DEPARTMENT_LOOKUP',
    'Lookup Departments',
    'ORG',
    'Allow reading department options for selectors and dropdowns only',
  ),

  // =========================
  // Organization / Positions
  // =========================
  permission('POSITION_VIEW', 'View Positions', 'ORG', 'Allow viewing position records'),
  permission('POSITION_CREATE', 'Create Positions', 'ORG', 'Allow creating position records'),
  permission('POSITION_UPDATE', 'Update Positions', 'ORG', 'Allow updating position records'),
  permission(
    'POSITION_LOOKUP',
    'Lookup Positions',
    'ORG',
    'Allow reading position options for selectors and dropdowns only',
  ),

  // =========================
  // Organization / Employees
  // =========================
  permission('EMPLOYEE_VIEW', 'View Employees', 'ORG', 'Allow viewing employee records'),
  permission(
    'EMPLOYEE_LOOKUP',
    'Lookup Employees',
    'ORG',
    'Allow reading employee options for selectors and dropdowns only',
  ),
  permission(
    'EMPLOYEE_LOOKUP_ALL',
    'Lookup All Employees',
    'ORG',
    'Allow reading all employee options across managed scope limits',
  ),
  permission('EMPLOYEE_CREATE', 'Create Employees', 'ORG', 'Allow creating employee records'),
  permission('EMPLOYEE_UPDATE', 'Update Employees', 'ORG', 'Allow updating employee records'),

  // =========================
  // Organization / Production Lines
  // =========================
  permission('LINE_VIEW', 'View Lines', 'ORG', 'Allow viewing production line records'),
  permission(
    'LINE_LOOKUP',
    'Lookup Lines',
    'ORG',
    'Allow reading production line options for selectors and dropdowns only',
  ),
  permission('LINE_CREATE', 'Create Lines', 'ORG', 'Allow creating production line records'),
  permission('LINE_UPDATE', 'Update Lines', 'ORG', 'Allow updating production line records'),
  permission('LINE_IMPORT', 'Import Lines', 'ORG', 'Allow importing production line records from Excel'),
  permission('LINE_EXPORT', 'Export Lines', 'ORG', 'Allow exporting production line records to Excel'),

  // =========================
  // Organization / Line Supervisors
  // =========================
  permission(
    'LINE_SUPERVISOR_VIEW',
    'View Line Supervisors',
    'ORG',
    'Allow viewing supervisor assignments for production lines',
  ),
  permission(
    'LINE_SUPERVISOR_ASSIGN',
    'Assign Line Supervisors',
    'ORG',
    'Allow assigning supervisors to production lines',
  ),

  // =========================
  // Calendar / Holidays
  // =========================
  permission('HOLIDAY_VIEW', 'View Holidays', 'CALENDAR', 'Allow viewing holiday records'),
  permission(
    'HOLIDAY_LOOKUP',
    'Lookup Holidays',
    'CALENDAR',
    'Allow reading active holiday records for date pickers, OT, attendance, and payment lookup',
  ),
  permission('HOLIDAY_CREATE', 'Create Holidays', 'CALENDAR', 'Allow creating holiday records'),
  permission('HOLIDAY_UPDATE', 'Update Holidays', 'CALENDAR', 'Allow updating holiday records'),
  permission(
    'HOLIDAY_IMPORT',
    'Import Holidays',
    'CALENDAR',
    'Allow importing holiday records from Excel',
  ),
  permission(
    'HOLIDAY_EXPORT',
    'Export Holidays',
    'CALENDAR',
    'Allow exporting holiday records to Excel',
  ),

  // =========================
  // Shift
  // =========================
  permission('SHIFT_VIEW', 'View Shifts', 'SHIFT', 'Allow viewing shift records'),
  permission('SHIFT_CREATE', 'Create Shifts', 'SHIFT', 'Allow creating shift records'),
  permission('SHIFT_UPDATE', 'Update Shifts', 'SHIFT', 'Allow updating shift records'),
  permission(
    'SHIFT_LOOKUP',
    'Lookup Shifts',
    'SHIFT',
    'Allow reading shift options for selectors and dropdowns only',
  ),

  // =========================
  // OT Request Workflow
  // =========================
  permission('OT_REQUEST_VIEW', 'View OT Requests', 'OT', 'Allow viewing own OT requests'),
  permission(
    'OT_REQUEST_VIEW_ALL',
    'View All OT Requests',
    'OT',
    'Allow viewing OT requests from all employees',
  ),
  permission('OT_REQUEST_CREATE', 'Create OT Requests', 'OT', 'Allow creating OT requests'),
  permission('OT_REQUEST_UPDATE', 'Update OT Requests', 'OT', 'Allow updating OT requests'),
  permission(
    'OT_REQUEST_DELETE',
    'Delete OT Requests',
    'OT',
    'Allow permanently deleting OT requests from the system',
  ),
  permission('OT_REQUEST_APPROVE', 'Approve OT Requests', 'OT', 'Allow approving OT requests'),
  permission(
    'OT_REQUEST_ACKNOWLEDGE',
    'Acknowledge OT Requests',
    'OT',
    'Allow viewing OT requests where the user is included as an acknowledge/FYI person',
  ),
  permission(
    'OT_ADD_OTHER_LINE_EMPLOYEE',
    'Add Other Line Employee to OT',
    'OT',
    'Allow adding employees from other production lines to an OT request with a required reason',
  ),
  permission(
    'OT_EXECUTION_VIEW',
    'View OT Execution Controls',
    'OT',
    'Allow viewing OT request-window and payment approval controls',
  ),
  permission(
    'OT_EXECUTION_UPDATE',
    'Update OT Execution Controls',
    'OT',
    'Allow opening or closing OT requests, setting the request time window, and changing the payment approval rule',
  ),
  permission(
    'OT_APPROVAL_RULE_VIEW',
    'View OT Approval Calendar Rules',
    'OT',
    'Allow viewing calendar day-type approval roles and final approver setup',
  ),
  permission(
    'OT_APPROVAL_RULE_UPDATE',
    'Update OT Approval Calendar Rules',
    'OT',
    'Allow setting employee OT roles by Working Day, Sunday, and Holiday',
  ),

  // =========================
  // Attendance
  // =========================
  permission(
    'ATTENDANCE_VIEW',
    'View Attendance',
    'ATTENDANCE',
    'Allow viewing attendance imports and attendance records',
  ),
  permission(
    'ATTENDANCE_IMPORT',
    'Import Attendance',
    'ATTENDANCE',
    'Allow importing attendance files',
  ),
  permission(
    'ATTENDANCE_VERIFY',
    'Verify Attendance',
    'ATTENDANCE',
    'Allow verifying OT requests against attendance records',
  ),

  // =========================
  // OT Policy Master
  // =========================
  permission('OT_POLICY_VIEW', 'View OT Policies', 'OT', 'Allow viewing OT calculation policies'),
  permission(
    'OT_POLICY_CREATE',
    'Create OT Policies',
    'OT',
    'Allow creating OT calculation policies',
  ),
  permission(
    'OT_POLICY_UPDATE',
    'Update OT Policies',
    'OT',
    'Allow updating OT calculation policies',
  ),

  // =========================
  // Shift OT Option Master
  // =========================
  permission(
    'SHIFT_OT_OPTION_VIEW',
    'View Shift OT Options',
    'OT',
    'Allow viewing shift OT options',
  ),
  permission(
    'SHIFT_OT_OPTION_CREATE',
    'Create Shift OT Options',
    'OT',
    'Allow creating shift OT options',
  ),
  permission(
    'SHIFT_OT_OPTION_UPDATE',
    'Update Shift OT Options',
    'OT',
    'Allow updating shift OT options',
  ),

  // =========================
  // Payment / Formula
  // =========================
  permission(
    'PAYMENT_FORMULA_VIEW',
    'View Payment Formula',
    'PAYMENT',
    'Allow viewing payment formulas',
  ),
  permission(
    'PAYMENT_FORMULA_LOOKUP',
    'Lookup Payment Formula',
    'PAYMENT',
    'Allow reading active payment formula options for payment processing dropdowns only',
  ),
  permission(
    'PAYMENT_FORMULA_CREATE',
    'Create Payment Formula',
    'PAYMENT',
    'Allow creating payment formulas',
  ),
  permission(
    'PAYMENT_FORMULA_UPDATE',
    'Update Payment Formula',
    'PAYMENT',
    'Allow updating payment formulas',
  ),

  // =========================
  // Payment / Process
  // =========================
  permission(
    'PAYMENT_PROCESS',
    'Process Payment',
    'PAYMENT',
    'Allow uploading salary Excel, previewing payment, and exporting payment calculation files',
  ),

  // =========================
  // Payment / Allowance Policy
  // =========================
  permission(
    'PAYMENT_ALLOWANCE_POLICY_VIEW',
    'View Payment Allowance Policies',
    'PAYMENT',
    'Allow viewing payment allowance policy master records',
  ),
  permission(
    'PAYMENT_ALLOWANCE_POLICY_CREATE',
    'Create Payment Allowance Policies',
    'PAYMENT',
    'Allow creating payment allowance policy master records',
  ),
  permission(
    'PAYMENT_ALLOWANCE_POLICY_UPDATE',
    'Update Payment Allowance Policies',
    'PAYMENT',
    'Allow updating payment allowance policy master records',
  ),
]

async function seedPermissions() {
  const results = []

  for (const item of PERMISSIONS) {
    const doc = await Permission.findOneAndUpdate(
      { code: item.code },
      {
        $set: {
          code: item.code,
          name: item.name,
          module: item.module,
          description: item.description || '',
          isActive: true,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    )

    results.push(doc)
  }

  console.log(`✅ Permissions seeded: ${results.length}`)
  return results
}

async function seedRootAdminRole(allPermissions) {
  const permissionIds = allPermissions.map((item) => item._id)

  const role = await SystemRole.findOneAndUpdate(
    { code: ROOT_ADMIN_ROLE_CODE },
    {
      $set: {
        code: ROOT_ADMIN_ROLE_CODE,
        displayName: 'Root Admin',
        permissionIds,
        isActive: true,
      },
      $unset: {
        permissionCodes: 1,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  )

  console.log(`✅ Role seeded: ${ROOT_ADMIN_ROLE_CODE}`)
  return role
}

async function seedSuperAccount(rootAdminRole) {
  const loginId = String(process.env.SUPER_ADMIN_LOGIN_ID || 'root_admin')
    .trim()
    .toLowerCase()

  const password = process.env.SUPER_ADMIN_PASSWORD || 'RootAdmin@123'
  const displayName = process.env.SUPER_ADMIN_DISPLAY_NAME || 'System Root Admin'

  const passwordHash = await bcrypt.hash(password, 10)

  const existing = await Account.findOne({ loginId })

  if (!existing) {
    await Account.create({
      loginId,
      passwordHash,
      displayName,
      employeeId: null,
      roleIds: [rootAdminRole._id],
      directPermissionCodes: [],
      passwordVersion: 1,
      mustChangePassword: false,
      isActive: true,
    })

    console.log(`✅ Super account created: ${loginId}`)
    return
  }

  await Account.updateOne(
    { _id: existing._id },
    {
      $set: {
        displayName,
        roleIds: [rootAdminRole._id],
        directPermissionCodes: [],
        isActive: true,
      },
    },
  )

  console.log(`✅ Super account synced: ${loginId}`)
}

async function run() {
  await connectMongo()

  const permissions = await seedPermissions()
  const rootAdminRole = await seedRootAdminRole(permissions)

  await seedSuperAccount(rootAdminRole)

  console.log('✅ Seed completed')
  await mongoose.connection.close()
}

run().catch(async (error) => {
  console.error('❌ Seed failed')
  console.error(error)

  try {
    await mongoose.connection.close()
  } catch (_) {}

  process.exit(1)
})