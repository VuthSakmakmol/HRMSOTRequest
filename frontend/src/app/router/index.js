// frontend/src/app/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/modules/auth/auth.store'

import AppLayout from '@/layouts/AppLayout.vue'

import LoginView from '@/modules/auth/views/LoginView.vue'
import AccountsView from '@/modules/auth/views/AccountsView.vue'
import SystemRoleView from '@/modules/access/views/SystemRoleView.vue'
import PermissionsView from '@/modules/access/views/PermissionsView.vue'
import DepartmentView from '@/modules/org/views/DepartmentView.vue'
import PositionView from '@/modules/org/views/PositionView.vue'
import EmployeeView from '@/modules/org/views/EmployeeView.vue'
import OrgChartView from '@/modules/org/views/OrgChartView.vue'
import HolidayListView from '@/modules/calendar/views/HolidayListView.vue'
import OTRequestListView from '@/modules/ot/views/OTRequestListView.vue'
import OTRequestCreateView from '@/modules/ot/views/OTRequestCreateView.vue'
import OTApprovalInboxView from '@/modules/ot/views/OTApprovalInboxView.vue'
import OTRequestDetailView from '../../modules/ot/views/OTRequestDetailView.vue'
import OTRequestEditView from '@/modules/ot/views/OTRequestEditView.vue'
import ShiftListView from '@/modules/shift/views/ShiftListView.vue'
import ForbiddenView from '@/modules/errors/views/ForbiddenView.vue'

let bootstrapped = false

function s(v) {
  return String(v ?? '').trim()
}

function up(v) {
  return s(v).toUpperCase()
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(up).filter(Boolean))]
}

async function ensureAuthBootstrapped() {
  const auth = useAuthStore()

  if (bootstrapped) return
  bootstrapped = true

  if (!auth.token) {
    auth.bootstrapped = true
    return
  }

  try {
    await auth.bootstrap()
  } catch (_) {
    // auth store handles invalid token cleanup
  }
}

function hasRoutePermission(auth, to) {
  if (auth.isRootAdmin) return true

  const requiredAll = uniqueStrings(to.meta?.requiredPermissions || [])
  const requiredAny = uniqueStrings(to.meta?.requiredAnyPermissions || [])

  if (!requiredAll.length && !requiredAny.length) return true
  if (requiredAll.length && !auth.hasAllPermissions(requiredAll)) return false
  if (requiredAny.length && !auth.hasAnyPermission(requiredAny)) return false

  return true
}

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: {
      public: true,
      title: 'Login',
    },
  },
  {
    path: '/',
    component: AppLayout,
    meta: {
      requiresAuth: true,
    },
    children: [
      {
        path: '',
        redirect: '/auth/accounts',
      },
      {
        path: 'auth/accounts',
        name: 'accounts',
        component: AccountsView,
        meta: {
          requiresAuth: true,
          title: 'Accounts',
          requiredAnyPermissions: [
            'ACCOUNT_VIEW',
            'ACCOUNT_CREATE',
            'ACCOUNT_UPDATE',
            'ACCOUNT_RESET_PASSWORD',
          ],
        },
      },
      {
        path: 'access/permissions',
        name: 'permissions',
        component: PermissionsView,
        meta: {
          requiresAuth: true,
          title: 'Permissions',
          requiredAnyPermissions: ['PERMISSION_VIEW'],
        },
      },
      {
        path: 'org/roles',
        name: 'roles',
        component: SystemRoleView,
        meta: {
          requiresAuth: true,
          title: 'Roles',
          requiredAnyPermissions: [
            'ROLE_VIEW',
            'ROLE_CREATE',
            'ROLE_UPDATE',
          ],
        },
      },
      {
        path: 'org/departments',
        name: 'departments',
        component: DepartmentView,
        meta: {
          requiresAuth: true,
          title: 'Departments',
          requiredAnyPermissions: [
            'DEPARTMENT_VIEW',
            'DEPARTMENT_CREATE',
            'DEPARTMENT_UPDATE',
          ],
        },
      },
      {
        path: 'org/positions',
        name: 'positions',
        component: PositionView,
        meta: {
          requiresAuth: true,
          title: 'Positions',
          requiredAnyPermissions: [
            'POSITION_VIEW',
            'POSITION_CREATE',
            'POSITION_UPDATE',
          ],
        },
      },
      {
        path: 'org/employees',
        name: 'employees',
        component: EmployeeView,
        meta: {
          requiresAuth: true,
          title: 'Employees',
          requiredAnyPermissions: [
            'EMPLOYEE_VIEW',
            'EMPLOYEE_CREATE',
            'EMPLOYEE_UPDATE',
          ],
        },
      },
      {
        path: 'org/org-chart',
        name: 'org-chart',
        component: OrgChartView,
        meta: {
          requiresAuth: true,
          title: 'Organization Chart',
          requiredAnyPermissions: [
            'EMPLOYEE_VIEW',
          ],
        },
      },
      {
        path: 'calendar/holidays',
        name: 'holidays',
        component: HolidayListView,
        meta: {
          requiresAuth: true,
          title: 'Holiday Master',
          requiredAnyPermissions: [
            'HOLIDAY_VIEW',
            'HOLIDAY_CREATE',
            'HOLIDAY_UPDATE',
          ],
        },
      },
      {
        path: 'shift/list',
        name: 'shifts',
        component: ShiftListView,
        meta: {
          requiresAuth: true,
          title: 'Shift Master',
          requiredAnyPermissions: [
            'SHIFT_VIEW',
            'SHIFT_CREATE',
            'SHIFT_UPDATE',
          ],
        },
      },
      {
        path: 'ot/requests',
        name: 'ot-request-list',
        component: OTRequestListView,
        meta: {
          requiresAuth: true,
          title: 'OT Requests',
          requiredAnyPermissions: [
            'OT_REQUEST_VIEW',
            'OT_REQUEST_CREATE',
            'OT_REQUEST_UPDATE',
            'OT_REQUEST_APPROVE',
          ],
        },
      },
      {
        path: 'ot/requests/create',
        name: 'ot-request-create',
        component: OTRequestCreateView,
        meta: {
          requiresAuth: true,
          title: 'Create OT Request',
          requiredAnyPermissions: [
            'OT_REQUEST_CREATE',
          ],
        },
      },
      {
        path: 'ot/approvals',
        name: 'ot-approval-inbox',
        component: OTApprovalInboxView,
        meta: {
          requiresAuth: true,
          title: 'OT Approval Inbox',
          requiredAnyPermissions: [
            'OT_REQUEST_APPROVE',
          ],
        },
      },
      {
        path: 'ot/requests/:id',
        name: 'ot-request-detail',
        component: OTRequestDetailView,
        meta: {
          requiresAuth: true,
          title: 'OT Request Detail',
          requiredAnyPermissions: [
            'OT_REQUEST_VIEW',
            'OT_REQUEST_CREATE',
            'OT_REQUEST_UPDATE',
            'OT_REQUEST_APPROVE',
          ],
        },
      },
      {
        path: 'ot/requests/:id/edit',
        name: 'ot-request-edit',
        component: OTRequestEditView,
        meta: {
          requiresAuth: true,
          title: 'Edit OT Request',
          requiredAnyPermissions: [
            'OT_REQUEST_UPDATE',
          ],
        },
      },
      {
        path: '/403',
        name: 'forbidden',
        component: ForbiddenView,
        meta: {
          requiresAuth: true,
          title: 'Forbidden',
        },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  await ensureAuthBootstrapped()

  if (to.meta?.public && auth.token && to.path === '/login') {
    return '/'
  }

  if (to.meta?.requiresAuth && !auth.token) {
    return '/login'
  }

  if (to.meta?.requiresAuth && auth.token && !hasRoutePermission(auth, to)) {
    return '/403'
  }

  return true
})

router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} | OT Request` : 'OT Request'
})

export default router