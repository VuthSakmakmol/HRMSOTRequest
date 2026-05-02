// backend/src/database/seeds.js

require('../config/env')

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const { connectMongo } = require('./mongoose')
const Permission = require('../modules/access/models/Permission')
const SystemRole = require('../modules/access/models/SystemRole')
const Account = require('../modules/auth/models/Account')

const ROOT_ADMIN_ROLE_CODE = 'ROOT_ADMIN'

const PERMISSIONS = [
  // Accounts
  {
    code: 'ACCOUNT_VIEW',
    name: 'View Accounts',
    module: 'AUTH',
    description: 'Allow viewing account records',
  },
  {
    code: 'ACCOUNT_CREATE',
    name: 'Create Accounts',
    module: 'AUTH',
    description: 'Allow creating account records',
  },
  {
    code: 'ACCOUNT_UPDATE',
    name: 'Update Accounts',
    module: 'AUTH',
    description: 'Allow updating account records',
  },
  {
    code: 'ACCOUNT_RESET_PASSWORD',
    name: 'Reset Account Password',
    module: 'AUTH',
    description: 'Allow resetting account passwords',
  },

  // Permissions
  {
    code: 'PERMISSION_VIEW',
    name: 'View Permissions',
    module: 'ORG',
    description: 'Allow viewing permission master records',
  },
  {
    code: 'PERMISSION_CREATE',
    name: 'Create Permissions',
    module: 'ORG',
    description: 'Allow creating permission master records',
  },
  {
    code: 'PERMISSION_UPDATE',
    name: 'Update Permissions',
    module: 'ORG',
    description: 'Allow updating permission master records',
  },

  // Roles
  {
    code: 'ROLE_VIEW',
    name: 'View Roles',
    module: 'ORG',
    description: 'Allow viewing system roles',
  },
  {
    code: 'ROLE_CREATE',
    name: 'Create Roles',
    module: 'ORG',
    description: 'Allow creating system roles',
  },
  {
    code: 'ROLE_UPDATE',
    name: 'Update Roles',
    module: 'ORG',
    description: 'Allow updating system roles',
  },

  // Departments
  {
    code: 'DEPARTMENT_VIEW',
    name: 'View Departments',
    module: 'ORG',
    description: 'Allow viewing department records',
  },
  {
    code: 'DEPARTMENT_CREATE',
    name: 'Create Departments',
    module: 'ORG',
    description: 'Allow creating department records',
  },
  {
    code: 'DEPARTMENT_UPDATE',
    name: 'Update Departments',
    module: 'ORG',
    description: 'Allow updating department records',
  },
  {
    code: 'DEPARTMENT_LOOKUP',
    name: 'Lookup Departments',
    module: 'ORG',
    description: 'Allow reading department options for selectors and dropdowns only',
  },

  // Positions
  {
    code: 'POSITION_VIEW',
    name: 'View Positions',
    module: 'ORG',
    description: 'Allow viewing position records',
  },
  {
    code: 'POSITION_CREATE',
    name: 'Create Positions',
    module: 'ORG',
    description: 'Allow creating position records',
  },
  {
    code: 'POSITION_UPDATE',
    name: 'Update Positions',
    module: 'ORG',
    description: 'Allow updating position records',
  },
  {
    code: 'POSITION_LOOKUP',
    name: 'Lookup Positions',
    module: 'ORG',
    description: 'Allow reading position options for selectors and dropdowns only',
  },

  // Employees
  {
    code: 'EMPLOYEE_VIEW',
    name: 'View Employees',
    module: 'ORG',
    description: 'Allow viewing employee records',
  },
  {
    code: 'EMPLOYEE_LOOKUP',
    name: 'Lookup Employees',
    module: 'ORG',
    description: 'Allow reading employee options for selectors and dropdowns only',
  },
  {
    code: 'EMPLOYEE_CREATE',
    name: 'Create Employees',
    module: 'ORG',
    description: 'Allow creating employee records',
  },
  {
    code: 'EMPLOYEE_UPDATE',
    name: 'Update Employees',
    module: 'ORG',
    description: 'Allow updating employee records',
  },

  // Production Lines
  {
    code: 'LINE_VIEW',
    name: 'View Lines',
    module: 'ORG',
    description: 'Allow viewing production line records',
  },
  {
    code: 'LINE_LOOKUP',
    name: 'Lookup Lines',
    module: 'ORG',
    description: 'Allow reading production line options for selectors and dropdowns only',
  },
  {
    code: 'LINE_CREATE',
    name: 'Create Lines',
    module: 'ORG',
    description: 'Allow creating production line records',
  },
  {
    code: 'LINE_UPDATE',
    name: 'Update Lines',
    module: 'ORG',
    description: 'Allow updating production line records',
  },
  {
    code: 'LINE_IMPORT',
    name: 'Import Lines',
    module: 'ORG',
    description: 'Allow importing production line records from Excel',
  },
  {
    code: 'LINE_EXPORT',
    name: 'Export Lines',
    module: 'ORG',
    description: 'Allow exporting production line records to Excel',
  },

  // Line Supervisor Assignment
  {
    code: 'LINE_SUPERVISOR_VIEW',
    name: 'View Line Supervisors',
    module: 'ORG',
    description: 'Allow viewing supervisor assignments for production lines',
  },
  {
    code: 'LINE_SUPERVISOR_ASSIGN',
    name: 'Assign Line Supervisors',
    module: 'ORG',
    description: 'Allow assigning supervisors to production lines',
  },

  // Holidays
  {
    code: 'HOLIDAY_VIEW',
    name: 'View Holidays',
    module: 'CALENDAR',
    description: 'Allow viewing holiday records',
  },
  {
    code: 'HOLIDAY_CREATE',
    name: 'Create Holidays',
    module: 'CALENDAR',
    description: 'Allow creating holiday records',
  },
  {
    code: 'HOLIDAY_UPDATE',
    name: 'Update Holidays',
    module: 'CALENDAR',
    description: 'Allow updating holiday records',
  },
  {
    code: 'HOLIDAY_LOOKUP',
    name: 'Lookup Holidays',
    module: 'CALENDAR',
    description: 'Allow reading holiday options for selectors and dropdowns only',
  },

  // Shifts
  {
    code: 'SHIFT_VIEW',
    name: 'View Shifts',
    module: 'SHIFT',
    description: 'Allow viewing shift records',
  },
  {
    code: 'SHIFT_CREATE',
    name: 'Create Shifts',
    module: 'SHIFT',
    description: 'Allow creating shift records',
  },
  {
    code: 'SHIFT_UPDATE',
    name: 'Update Shifts',
    module: 'SHIFT',
    description: 'Allow updating shift records',
  },
  {
    code: 'SHIFT_LOOKUP',
    name: 'Lookup Shifts',
    module: 'SHIFT',
    description: 'Allow reading shift options for selectors and dropdowns only',
  },

  // OT
  {
    code: 'OT_REQUEST_VIEW',
    name: 'View OT Requests',
    module: 'OT',
    description: 'Allow viewing OT requests',
  },
  {
    code: 'OT_REQUEST_CREATE',
    name: 'Create OT Requests',
    module: 'OT',
    description: 'Allow creating OT requests',
  },
  {
    code: 'OT_REQUEST_UPDATE',
    name: 'Update OT Requests',
    module: 'OT',
    description: 'Allow updating OT requests',
  },
  {
    code: 'OT_REQUEST_APPROVE',
    name: 'Approve OT Requests',
    module: 'OT',
    description: 'Allow approving OT requests',
  },
  {
    code: 'OT_ADD_OTHER_LINE_EMPLOYEE',
    name: 'Add Other Line Employee to OT',
    module: 'OT',
    description: 'Allow adding employees from other production lines to an OT request with a required reason',
  },

  // Attendance
  {
    code: 'ATTENDANCE_VIEW',
    name: 'View Attendance',
    module: 'ATTENDANCE',
    description: 'Allow viewing attendance imports and attendance records',
  },
  {
    code: 'ATTENDANCE_IMPORT',
    name: 'Import Attendance',
    module: 'ATTENDANCE',
    description: 'Allow importing attendance files',
  },
  {
    code: 'ATTENDANCE_VERIFY',
    name: 'Verify Attendance',
    module: 'ATTENDANCE',
    description: 'Allow verifying OT requests against attendance records',
  },

  // OT Policy Master
  {
    code: 'OT_POLICY_VIEW',
    name: 'View OT Policies',
    module: 'OT',
    description: 'Allow viewing OT calculation policies',
  },
  {
    code: 'OT_POLICY_CREATE',
    name: 'Create OT Policies',
    module: 'OT',
    description: 'Allow creating OT calculation policies',
  },
  {
    code: 'OT_POLICY_UPDATE',
    name: 'Update OT Policies',
    module: 'OT',
    description: 'Allow updating OT calculation policies',
  },

  // Shift OT Option Master
  {
    code: 'SHIFT_OT_OPTION_VIEW',
    name: 'View Shift OT Options',
    module: 'OT',
    description: 'Allow viewing shift OT options',
  },
  {
    code: 'SHIFT_OT_OPTION_CREATE',
    name: 'Create Shift OT Options',
    module: 'OT',
    description: 'Allow creating shift OT options',
  },
  {
    code: 'SHIFT_OT_OPTION_UPDATE',
    name: 'Update Shift OT Options',
    module: 'OT',
    description: 'Allow updating shift OT options',
  },
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
  const loginId = String(process.env.SUPER_ADMIN_LOGIN_ID || 'root_admin').trim().toLowerCase()
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