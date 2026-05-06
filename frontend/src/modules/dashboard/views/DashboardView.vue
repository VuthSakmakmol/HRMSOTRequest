<!-- frontend/src/modules/dashboard/views/DashboardView.vue -->
<script setup>
// frontend/src/modules/dashboard/views/DashboardView.vue

import { computed } from 'vue'
import { useAuthStore } from '@/modules/auth/auth.store'

import DepartmentDashboardWidget from '../components/DepartmentDashboardWidget.vue'
import PositionDashboardWidget from '../components/PositionDashboardWidget.vue'
import EmployeeDashboardWidget from '../components/EmployeeDashboardWidget.vue'
import OTDashboardWidget from '../components/OTDashboardWidget.vue'
import AttendanceDashboardWidget from '../components/AttendanceDashboardWidget.vue'

const auth = useAuthStore()

function can(permissionCode) {
  if (auth.isRootAdmin) return true
  return auth.hasAnyPermission([permissionCode])
}

const canViewDepartmentWidget = computed(() => can('DEPARTMENT_VIEW'))
const canViewPositionWidget = computed(() => can('POSITION_VIEW'))
const canViewEmployeeWidget = computed(() => can('EMPLOYEE_VIEW'))
const canViewOTWidget = computed(() => can('OT_REQUEST_VIEW'))
const canViewAttendanceWidget = computed(() => can('ATTENDANCE_VIEW'))

const hasAnyWidget = computed(() => {
  return (
    canViewDepartmentWidget.value ||
    canViewPositionWidget.value ||
    canViewEmployeeWidget.value ||
    canViewOTWidget.value ||
    canViewAttendanceWidget.value
  )
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div class="px-4 py-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 class="mt-1 text-xl font-semibold text-[color:var(--ot-text)]">
              Dashboard
            </h1>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div
              class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]"
            >
              Modular dashboard
            </div>
          </div>
        </div>
      </div>
    </div>

    <DepartmentDashboardWidget v-if="canViewDepartmentWidget" />

    <PositionDashboardWidget v-if="canViewPositionWidget" />

    <EmployeeDashboardWidget v-if="canViewEmployeeWidget" />

    <OTDashboardWidget v-if="canViewOTWidget" />

    <AttendanceDashboardWidget v-if="canViewAttendanceWidget" />

    <div
      v-if="!hasAnyWidget"
      class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
    >
      <div class="px-4 py-10 text-center">
        <div
          class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--ot-border)] text-[color:var(--ot-text-muted)]"
        >
          <i class="pi pi-lock text-lg"></i>
        </div>

        <h2 class="mt-4 text-base font-semibold text-[color:var(--ot-text)]">
          No dashboard widgets available
        </h2>

        <p class="mx-auto mt-1 max-w-md text-sm text-[color:var(--ot-text-muted)]">
          Your account can open the dashboard, but it does not have permission to view
          dashboard module data.
        </p>

        <p class="mt-3 text-xs text-[color:var(--ot-text-muted)]">
          Required permission: DEPARTMENT_VIEW, POSITION_VIEW, EMPLOYEE_VIEW,
          OT_REQUEST_VIEW, or ATTENDANCE_VIEW
        </p>
      </div>
    </div>
  </div>
</template>