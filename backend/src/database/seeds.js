// backend/src/database/seeds.js
require('../config/env')

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const { connectMongo } = require('./mongoose')
const Permission = require('../modules/org/models/Permission')
const SystemRole = require('../modules/org/models/SystemRole')
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

  // Employees
  {
    code: 'EMPLOYEE_VIEW',
    name: 'View Employees',
    module: 'ORG',
    description: 'Allow viewing employee records',
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
      }
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
    }
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
    }
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