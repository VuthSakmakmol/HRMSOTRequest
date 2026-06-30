// frontend/src/app/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/modules/auth/auth.store'
import i18n from '@/shared/i18n'
import { resolveDefaultHomePath, safeRedirectPath } from './defaultRoute'

import AppLayout from '@/layouts/AppLayout.vue'

import LoginView from '@/modules/auth/views/LoginView.vue'
import AccountsView from '@/modules/auth/views/AccountsView.vue'
import ProfileView from '@/modules/auth/views/ProfileView.vue'
import SystemRoleView from '@/modules/access/views/SystemRoleView.vue'
import PermissionsView from '@/modules/access/views/PermissionsView.vue'


import DepartmentView from '@/modules/org/views/DepartmentView.vue'
import PositionView from '@/modules/org/views/PositionView.vue'
import EmployeeView from '@/modules/org/views/EmployeeView.vue'
import OrgChartView from '@/modules/org/views/OrgChartView.vue'
import LineView from '@/modules/org/views/LineView.vue'

import HolidayListView from '@/modules/calendar/views/HolidayListView.vue'
import ShiftListView from '@/modules/shift/views/ShiftListView.vue'

import OTRequestListView from '@/modules/ot/views/OTRequestListView.vue'
import OTRequestCreateView from '@/modules/ot/views/OTRequestCreateView.vue'
import OTApprovalInboxView from '@/modules/ot/views/OTApprovalInboxView.vue'
import OTAcknowledgeInboxView from '@/modules/ot/views/OTAcknowledgeInboxView.vue'
import OTCalculationPolicyListView from '@/modules/ot/views/OTCalculationPolicyListView.vue'
import ShiftOTOptionListView from '@/modules/ot/views/ShiftOTOptionListView.vue'
import OTExecutionSettingsView from '@/modules/ot/views/OTExecutionSettingsView.vue'
import OTApprovalCalendarRulesView from '@/modules/ot/views/OTApprovalCalendarRulesView.vue'

import PaymentFormulaView from '@/modules/payment/views/PaymentFormulaView.vue'
import PaymentProcessView from '@/modules/payment/views/PaymentProcessView.vue'

import AttendanceImportView from '@/modules/attendance/views/AttendanceImportView.vue'
import AttendanceRecordsView from '@/modules/attendance/views/AttendanceRecordsView.vue'
import OTAttendanceVerificationView from '@/modules/attendance/views/OTAttendanceVerificationView.vue'

import PaymentAllowancePolicyView from '@/modules/payment/views/PaymentAllowancePolicyView.vue'

import ForbiddenView from '@/modules/errors/views/ForbiddenView.vue'

function s(value) {
  return String(value ?? '').trim()
}

function up(value) {
  return s(value).toUpperCase()
}

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map(up)
        .filter(Boolean),
    ),
  ]
}

function collectRequiredPermissions(to, key) {
  return uniqueStrings(
    to.matched.flatMap((record) => record.meta?.[key] || []),
  )
}

function routeRequiresAuth(to) {
  return to.matched.some((record) => record.meta?.requiresAuth)
}

function routeIsPublic(to) {
  return to.matched.some((record) => record.meta?.public)
}

function hasRoutePermission(auth, to) {
  if (auth.isRootAdmin) return true

  const requiredAll = collectRequiredPermissions(to, 'requiredPermissions')
  const requiredAny = collectRequiredPermissions(to, 'requiredAnyPermissions')

  if (!requiredAll.length && !requiredAny.length) return true
  if (requiredAll.length && !auth.hasAllPermissions(requiredAll)) return false
  if (requiredAny.length && !auth.hasAnyPermission(requiredAny)) return false

  return true
}

async function ensureAuthBootstrapped() {
  const auth = useAuthStore()

  if (auth.bootstrapped) return

  try {
    await auth.bootstrap()
  } catch {
    auth.clearAuth()
  }
}

function getRouteTitle(to) {
  const titleKey = s(to.meta?.titleKey)
  const fallbackTitle = s(to.meta?.title) || 'OT Request'

  if (titleKey) {
    return i18n.global.t(titleKey)
  }

  return fallbackTitle
}

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: {
      public: true,
      title: 'Login',
      titleKey: 'auth.login',
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
        name: 'home',
        meta: {
          requiresAuth: true,
        },
        beforeEnter: () => true,
      },

      {
        path: 'profile',
        name: 'Profile',
        component: ProfileView,
        meta: {  
          requiresAuth: true,
          title: 'Profile',
          titleKey: 'auth.profile',
        },
      },

      // =========================
      // Auth / Access
      // =========================
      {
        path: 'auth/accounts',
        name: 'accounts',
        component: AccountsView,
        meta: {
          requiresAuth: true,
          title: 'Accounts',
          titleKey: 'nav.accounts',
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
          titleKey: 'nav.permissions',
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
          titleKey: 'nav.roles',
          requiredAnyPermissions: ['ROLE_VIEW', 'ROLE_CREATE', 'ROLE_UPDATE'],
        },
      },

      // =========================
      // Organization
      // =========================
      {
        path: 'org/departments',
        name: 'departments',
        component: DepartmentView,
        meta: {
          requiresAuth: true,
          title: 'Departments',
          titleKey: 'nav.departments',
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
          titleKey: 'nav.positions',
          requiredAnyPermissions: [
            'POSITION_VIEW',
            'POSITION_CREATE',
            'POSITION_UPDATE',
          ],
        },
      },
      {
        path: 'org/lines',
        name: 'lines',
        component: LineView,
        meta: {
          requiresAuth: true,
          title: 'Production Lines',
          titleKey: 'nav.lines',
          requiredAnyPermissions: ['LINE_VIEW', 'LINE_CREATE', 'LINE_UPDATE'],
        },
      },
      {
        path: 'org/employees',
        name: 'employees',
        component: EmployeeView,
        meta: {
          requiresAuth: true,
          title: 'Employees',
          titleKey: 'nav.employees',
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
          titleKey: 'nav.orgChart',
          requiredAnyPermissions: ['EMPLOYEE_VIEW'],
        },
      },

      // =========================
      // Calendar / Shift
      // =========================
      {
        path: 'calendar/holidays',
        name: 'holidays',
        component: HolidayListView,
        meta: {
          requiresAuth: true,
          title: 'Holiday Master',
          titleKey: 'nav.holidayMaster',
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
          titleKey: 'nav.shiftMaster',
          requiredAnyPermissions: ['SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_UPDATE'],
        },
      },

      // =========================
      // OT Request Workflow
      // =========================
      {
        path: 'ot/requests',
        name: 'ot-request-list',
        component: OTRequestListView,
        meta: {
          requiresAuth: true,
          title: 'OT Requests',
          titleKey: 'nav.otRequests',
          requiredAnyPermissions: [
            'OT_REQUEST_VIEW',
            'OT_REQUEST_CREATE',
            'OT_REQUEST_UPDATE',
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
          titleKey: 'ot.requests.createTitle',
          requiredAnyPermissions: ['OT_REQUEST_CREATE'],
        },
      },
      {
        path: 'ot/approvals',
        name: 'ot-approval-inbox',
        component: OTApprovalInboxView,
        meta: {
          requiresAuth: true,
          title: 'OT Approval Inbox',
          titleKey: 'ot.requests.approvalTitle',
          requiredAnyPermissions: ['OT_REQUEST_APPROVE'],
        },
      },
      {
        path: 'ot/acknowledgements',
        name: 'ot-acknowledgement-inbox',
        component: OTAcknowledgeInboxView,
        meta: {
          requiresAuth: true,
          title: 'OT Acknowledge Inbox',
          titleKey: 'ot.requests.acknowledgeTitle',
          requiredAnyPermissions: ['OT_REQUEST_ACKNOWLEDGE'],
        },
      },
      {
        path: 'ot/requests/:id/edit',
        name: 'ot-request-edit',
        component: OTRequestCreateView,
        meta: {
          requiresAuth: true,
          title: 'Edit OT Request',
          titleKey: 'ot.requests.editTitle',
          requiredAnyPermissions: ['OT_REQUEST_UPDATE'],
        },
      },

      // =========================
      // OT Master Setup
      // =========================
      {
        path: 'ot/policies',
        name: 'ot-calculation-policies',
        component: OTCalculationPolicyListView,
        meta: {
          requiresAuth: true,
          title: 'OT Calculation Policies',
          titleKey: 'nav.otPolicies',
          requiredAnyPermissions: [
            'OT_POLICY_VIEW',
            'OT_POLICY_CREATE',
            'OT_POLICY_UPDATE',
          ],
        },
      },
      {
        path: 'ot/shift-options',
        name: 'shift-ot-options',
        component: ShiftOTOptionListView,
        meta: {
          requiresAuth: true,
          title: 'Shift OT Options',
          titleKey: 'nav.shiftOtOptions',
          requiredAnyPermissions: [
            'SHIFT_OT_OPTION_VIEW',
            'SHIFT_OT_OPTION_CREATE',
            'SHIFT_OT_OPTION_UPDATE',
          ],
        },
      },
      {
        path: 'ot/execution-controls',
        name: 'ot-execution-controls',
        component: OTExecutionSettingsView,
        meta: {
          requiresAuth: true,
          title: 'OT Execution Control',
          requiredAnyPermissions: ['OT_EXECUTION_VIEW', 'OT_EXECUTION_UPDATE'],
        },
      },
      {
        path: 'ot/approval-calendar-rules',
        name: 'ot-approval-calendar-rules',
        component: OTApprovalCalendarRulesView,
        meta: {
          requiresAuth: true,
          title: 'OT Approval Calendar Rules',
          titleKey: 'nav.otApprovalCalendarRules',
          requiredAnyPermissions: ['OT_APPROVAL_RULE_VIEW', 'OT_APPROVAL_RULE_UPDATE'],
        },
      },

      // =========================
      // Attendance
      // =========================
      {
        path: 'attendance/imports',
        name: 'attendance-imports',
        component: AttendanceImportView,
        meta: {
          requiresAuth: true,
          title: 'Attendance Import',
          titleKey: 'nav.attendanceImport',
          requiredAnyPermissions: ['ATTENDANCE_VIEW', 'ATTENDANCE_IMPORT'],
        },
      },
      {
        path: 'attendance/records',
        name: 'attendance-records',
        component: AttendanceRecordsView,
        meta: {
          requiresAuth: true,
          title: 'Attendance Records',
          titleKey: 'nav.attendanceRecords',
          requiredAnyPermissions: ['ATTENDANCE_VIEW'],
        },
      },
      {
        path: 'attendance/ot-verification/:otRequestId?',
        name: 'attendance-ot-verification',
        component: OTAttendanceVerificationView,
        meta: {
          requiresAuth: true,
          title: 'OT Attendance Verification',
          titleKey: 'nav.otVerification',
          requiredAnyPermissions: ['ATTENDANCE_VERIFY'],
        },
      },

      // =========================
      // Payment
      // =========================
      {
        path: 'payment/formulas',
        name: 'payment-formulas',
        component: PaymentFormulaView,
        meta: {
          requiresAuth: true,
          title: 'Payment Formulas',
          titleKey: 'nav.paymentFormulas',
          requiredAnyPermissions: ['PAYMENT_FORMULA_VIEW'],
        },
      },
      {
        path: 'payment/process',
        name: 'payment-process',
        component: PaymentProcessView,
        meta: {
          requiresAuth: true,
          title: 'Payment Process',
          titleKey: 'nav.paymentProcess',
          requiredAnyPermissions: ['PAYMENT_PROCESS'],
        },
      },
      {
        path: 'payment/allowance-policies',
        name: 'payment-allowance-policies',
        component: PaymentAllowancePolicyView,
        meta: {
          requiresAuth: true,
          title: 'Payment Allowance Policies',
          titleKey: 'nav.paymentAllowancePolicies',
          requiredAnyPermissions: [
            'PAYMENT_ALLOWANCE_POLICY_VIEW',
            'PAYMENT_ALLOWANCE_POLICY_CREATE',
            'PAYMENT_ALLOWANCE_POLICY_UPDATE',
          ],
        },
      },

      // =========================
      // Errors
      // =========================
      {
        path: '403',
        name: 'forbidden',
        component: ForbiddenView,
        meta: {
          requiresAuth: true,
          title: 'Forbidden',
          titleKey: 'auth.accessDenied',
        },
      },
    ],
  },
  {
    path: '/dashboard',
    redirect: '/',
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
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

  if (routeIsPublic(to) && auth.token && to.path === '/login') {
    return safeRedirectPath(to.query?.redirect, auth)
  }

  if (routeRequiresAuth(to) && auth.token && (to.path === '/' || to.path === '/dashboard')) {
    return resolveDefaultHomePath(auth)
  }

  if (routeRequiresAuth(to) && !auth.token) {
    return {
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    }
  }

  if (routeRequiresAuth(to) && auth.token && !hasRoutePermission(auth, to)) {
    if (to.name === 'forbidden') return true
    return '/403'
  }

  return true
})

router.afterEach((to) => {
  const title = getRouteTitle(to)
  document.title = title ? `${title} | OT Request` : 'OT Request'
})

export default router