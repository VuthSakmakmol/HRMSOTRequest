<!-- frontend/src/layouts/components/AppSidebar.vue -->
<script setup>
// frontend/src/layouts/components/AppSidebar.vue

import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import ScrollPanel from 'primevue/scrollpanel'

import { useAuthStore } from '@/modules/auth/auth.store'

const props = defineProps({
  mobileVisible: {
    type: Boolean,
    default: false,
  },
  desktopCollapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:mobileVisible', 'update:desktopCollapsed'])

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { t } = useI18n()

const openGroups = ref({})

function cleanText(value) {
  return String(value ?? '').trim()
}

function firstValidText(values = []) {
  return values.map(cleanText).find(Boolean) || ''
}

const displayName = computed(() => {
  const user = auth.user || {}
  const employee = user.employee || user.employeeProfile || user.profile || {}

  const combinedName = [user.firstName, user.lastName]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')

  const employeeCombinedName = [employee.firstName, employee.lastName]
    .map(cleanText)
    .filter(Boolean)
    .join(' ')

  return (
    firstValidText([
      user.displayName,
      user.fullName,
      user.name,
      user.employeeName,
      user.englishName,
      user.localName,
      combinedName,

      employee.displayName,
      employee.fullName,
      employee.name,
      employee.employeeName,
      employee.englishName,
      employee.localName,
      employeeCombinedName,

      user.loginId,
      user.username,
      user.employeeNo,
    ]) || 'User'
  )
})

const accountSubtitle = computed(() => {
  const user = auth.user || {}
  const employee = user.employee || user.employeeProfile || user.profile || {}

  return (
    firstValidText([
      user.loginId,
      user.username,
      user.employeeNo,
      employee.employeeNo,
      t('auth.profile'),
    ]) || t('auth.profile')
  )
})

const accountInitial = computed(() => {
  const name = displayName.value || 'U'
  return String(name).trim().charAt(0).toUpperCase() || 'U'
})

function hasAccess(requiredPermissions = []) {
  if (!requiredPermissions?.length) return true
  return auth.hasAnyPermission(requiredPermissions)
}

function isActivePath(to) {
  if (!to) return false

  return route.path === to || route.path.startsWith(`${to}/`)
}

function closeMobile() {
  emit('update:mobileVisible', false)
}

async function go(to, closeAfter = false) {
  if (!to || route.path === to) {
    if (closeAfter) closeMobile()
    return
  }

  await router.push(to)

  if (closeAfter) closeMobile()
}

async function goProfile(closeAfter = false) {
  await go('/profile', closeAfter)
}

async function logout() {
  await auth.logout()
  closeMobile()
  router.push('/login')
}

const navGroups = computed(() => {
  const groups = [
    {
      key: 'organization',
      label: t('nav.organization'),
      icon: 'pi pi-sitemap',
      items: [
        {
          key: 'permissions',
          label: t('nav.permissions'),
          icon: 'pi pi-shield',
          to: '/access/permissions',
          permissions: ['PERMISSION_VIEW'],
        },
        {
          key: 'roles',
          label: t('nav.roles'),
          icon: 'pi pi-id-card',
          to: '/org/roles',
          permissions: ['ROLE_VIEW', 'ROLE_CREATE', 'ROLE_UPDATE'],
        },
        {
          key: 'departments',
          label: t('nav.departments'),
          icon: 'pi pi-building',
          to: '/org/departments',
          permissions: ['DEPARTMENT_VIEW', 'DEPARTMENT_CREATE', 'DEPARTMENT_UPDATE'],
        },
        {
          key: 'positions',
          label: t('nav.positions'),
          icon: 'pi pi-briefcase',
          to: '/org/positions',
          permissions: ['POSITION_VIEW', 'POSITION_CREATE', 'POSITION_UPDATE'],
        },
        {
          key: 'lines',
          label: t('nav.lines'),
          icon: 'pi pi-sitemap',
          to: '/org/lines',
          permissions: ['LINE_VIEW', 'LINE_CREATE', 'LINE_UPDATE'],
        },
        {
          key: 'employees',
          label: t('nav.employees'),
          icon: 'pi pi-users',
          to: '/org/employees',
          permissions: ['EMPLOYEE_VIEW', 'EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE'],
        },
        {
          key: 'org-chart',
          label: t('nav.orgChart'),
          icon: 'pi pi-share-alt',
          to: '/org/org-chart',
          permissions: ['EMPLOYEE_VIEW'],
        },
      ],
    },
    {
      key: 'calendar',
      label: t('nav.calendar'),
      icon: 'pi pi-calendar',
      items: [
        {
          key: 'holidays',
          label: t('nav.holidayMaster'),
          icon: 'pi pi-calendar-plus',
          to: '/calendar/holidays',
          permissions: ['HOLIDAY_VIEW'],
        },
      ],
    },
    {
      key: 'shift',
      label: t('nav.shift'),
      icon: 'pi pi-stopwatch',
      items: [
        {
          key: 'shift-master',
          label: t('nav.shiftMaster'),
          icon: 'pi pi-clock',
          to: '/shift/list',
          permissions: ['SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_UPDATE'],
        },
      ],
    },
    {
      key: 'access',
      label: t('nav.accessControl'),
      icon: 'pi pi-lock',
      items: [
        {
          key: 'accounts',
          label: t('nav.accounts'),
          icon: 'pi pi-user-edit',
          to: '/auth/accounts',
          permissions: [
            'ACCOUNT_VIEW',
            'ACCOUNT_CREATE',
            'ACCOUNT_UPDATE',
            'ACCOUNT_RESET_PASSWORD',
          ],
        },
      ],
    },
    {
      key: 'attendance',
      label: t('nav.attendance'),
      icon: 'pi pi-calendar-clock',
      items: [
        {
          key: 'attendance-imports',
          label: t('nav.attendanceImport'),
          icon: 'pi pi-upload',
          to: '/attendance/imports',
          permissions: ['ATTENDANCE_VIEW', 'ATTENDANCE_IMPORT'],
        },
        {
          key: 'attendance-records',
          label: t('nav.attendanceRecords'),
          icon: 'pi pi-table',
          to: '/attendance/records',
          permissions: ['ATTENDANCE_VIEW'],
        },
        {
          key: 'attendance-verification',
          label: t('nav.otVerification'),
          icon: 'pi pi-check-square',
          to: '/attendance/ot-verification',
          permissions: ['ATTENDANCE_VERIFY'],
        },
      ],
    },
    {
      key: 'overtime',
      label: t('nav.overtime'),
      icon: 'pi pi-clock',
      items: [
        {
          key: 'ot-requests',
          label: t('nav.otRequests'),
          icon: 'pi pi-file-edit',
          to: '/ot/requests',
          permissions: ['OT_REQUEST_VIEW'],
        },
        {
          key: 'ot-approvals',
          label: t('nav.approvalInbox'),
          icon: 'pi pi-inbox',
          to: '/ot/approvals',
          permissions: ['OT_REQUEST_APPROVE'],
        },
        {
          key: 'ot-acknowledgements',
          label: t('nav.acknowledgeInbox'),
          icon: 'pi pi-info-circle',
          to: '/ot/acknowledgements',
          permissions: ['OT_REQUEST_ACKNOWLEDGE'],
        },
        {
          key: 'ot-policies',
          label: t('nav.otPolicies'),
          icon: 'pi pi-sliders-h',
          to: '/ot/policies',
          permissions: ['OT_POLICY_VIEW', 'OT_POLICY_CREATE', 'OT_POLICY_UPDATE'],
        },
        {
          key: 'shift-ot-options',
          label: t('nav.shiftOtOptions'),
          icon: 'pi pi-list-check',
          to: '/ot/shift-options',
          permissions: [
            'SHIFT_OT_OPTION_VIEW',
            'SHIFT_OT_OPTION_CREATE',
            'SHIFT_OT_OPTION_UPDATE',
          ],
        },
        {
          key: 'ot-execution-controls',
          label: t('nav.otExecutionControls'),
          icon: 'pi pi-power-off',
          to: '/ot/execution-controls',
          permissions: ['OT_EXECUTION_VIEW', 'OT_EXECUTION_UPDATE'],
        },
      ],
    },
    {
      key: 'payment',
      label: t('nav.payment'),
      icon: 'pi pi-wallet',
      items: [
        {
          key: 'payment-formulas',
          label: t('nav.paymentFormulas'),
          icon: 'pi pi-calculator',
          to: '/payment/formulas',
          permissions: ['PAYMENT_FORMULA_VIEW'],
        },
        {
          key: 'payment-allowance-policies',
          label: t('nav.paymentAllowancePolicies'),
          icon: 'pi pi-gift',
          to: '/payment/allowance-policies',
          permissions: ['PAYMENT_ALLOWANCE_POLICY_VIEW'],
        },
        {
          key: 'payment-process',
          label: t('nav.paymentProcess'),
          icon: 'pi pi-file-excel',
          to: '/payment/process',
          permissions: ['PAYMENT_PROCESS'],
        },
      ],
    },
  ]

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAccess(item.permissions)),
    }))
    .filter((group) => group.items.length > 0)
})

const desktopSidebarClass = computed(() =>
  props.desktopCollapsed ? 'app-sidebar--collapsed' : 'app-sidebar--expanded',
)

function isGroupExpanded(groupKey, groupItems = []) {
  if (typeof openGroups.value[groupKey] === 'boolean') {
    return openGroups.value[groupKey]
  }

  return groupItems.some((item) => isActivePath(item.to))
}

function toggleGroup(groupKey, groupItems = []) {
  openGroups.value = {
    ...openGroups.value,
    [groupKey]: !isGroupExpanded(groupKey, groupItems),
  }
}

function sidebarItemClass(to, collapsed = false) {
  return [
    'ot-nav-item',
    {
      'ot-nav-item-active': isActivePath(to),
      'ot-nav-item-collapsed': collapsed,
    },
  ]
}
</script>

<template>
  <aside
    class="app-sidebar"
    :class="desktopSidebarClass"
  >
    <div class="app-sidebar__brand">
      <div class="app-sidebar__logo">
        <i class="pi pi-objects-column" />
      </div>

      <div
        v-if="!desktopCollapsed"
        class="app-sidebar__brand-text"
      >
        {{ t('common.appName') }}
      </div>
    </div>

    <div class="app-sidebar__nav">
      <ScrollPanel style="width: 100%; height: 100%">
        <div class="app-sidebar__nav-inner">
          <template
            v-for="group in navGroups"
            :key="group.key"
          >
            <div
              v-if="desktopCollapsed"
              class="app-sidebar__collapsed-group"
            >
              <button
                v-for="item in group.items"
                :key="item.key"
                type="button"
                :class="sidebarItemClass(item.to, true)"
                :title="item.label"
                :aria-label="item.label"
                @click="go(item.to)"
              >
                <i
                  :class="item.icon"
                  class="ot-nav-item__icon"
                />
              </button>
            </div>

            <div
              v-else
              class="app-sidebar__group"
            >
              <button
                type="button"
                class="ot-group-button"
                @click="toggleGroup(group.key, group.items)"
              >
                <div class="ot-group-button__main">
                  <i
                    :class="group.icon"
                    class="ot-group-button__icon"
                  />
                  <span class="ot-group-button__label">
                    {{ group.label }}
                  </span>
                </div>

                <i
                  class="pi ot-group-button__arrow"
                  :class="
                    isGroupExpanded(group.key, group.items)
                      ? 'pi-chevron-down'
                      : 'pi-chevron-right'
                  "
                />
              </button>

              <div
                v-show="isGroupExpanded(group.key, group.items)"
                class="app-sidebar__items"
              >
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  type="button"
                  :class="sidebarItemClass(item.to)"
                  @click="go(item.to)"
                >
                  <i
                    :class="item.icon"
                    class="ot-nav-item__icon"
                  />
                  <span class="ot-nav-item__label">
                    {{ item.label }}
                  </span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </ScrollPanel>
    </div>

    <div
      class="app-sidebar__footer"
      :class="{ 'app-sidebar__footer--collapsed': desktopCollapsed }"
    >
      <button
        type="button"
        class="app-sidebar__profile-card"
        :class="{
          'app-sidebar__profile-card--collapsed': desktopCollapsed,
          'app-sidebar__profile-card--active': isActivePath('/profile'),
        }"
        :title="displayName"
        :aria-label="displayName"
        @click="goProfile()"
      >
        <Avatar
          :label="accountInitial"
          shape="circle"
          class="app-sidebar__profile-avatar"
        />

        <template v-if="!desktopCollapsed">
          <div class="app-sidebar__profile-text">
            <span class="app-sidebar__profile-name">
              {{ displayName }}
            </span>
            <span class="app-sidebar__profile-subtitle">
              {{ accountSubtitle }}
            </span>
          </div>

          <i class="pi pi-angle-right app-sidebar__profile-arrow" />
        </template>
      </button>

      <Button
        v-if="!desktopCollapsed"
        :label="t('auth.logout')"
        icon="pi pi-sign-out"
        text
        severity="danger"
        size="small"
        class="app-sidebar__logout-btn w-full !justify-start"
        @click="logout"
      />

      <Button
        v-else
        icon="pi pi-sign-out"
        text
        rounded
        severity="danger"
        size="small"
        class="app-sidebar__logout-btn app-sidebar__logout-btn--icon w-full"
        :aria-label="t('auth.logout')"
        @click="logout"
      />
    </div>
  </aside>

  <Drawer
    :visible="mobileVisible"
    position="left"
    modal
    dismissable
    class="ot-app-drawer lg:!hidden"
    @update:visible="emit('update:mobileVisible', $event)"
  >
    <template #header>
      <div class="app-sidebar__mobile-brand">
        <div class="app-sidebar__logo">
          <i class="pi pi-objects-column" />
        </div>

        <div class="app-sidebar__brand-text">
          {{ t('common.appName') }}
        </div>
      </div>
    </template>

    <div class="app-sidebar__mobile">
      <div class="app-sidebar__mobile-nav">
        <ScrollPanel style="width: 100%; height: 100%">
          <div class="app-sidebar__nav-inner">
            <template
              v-for="group in navGroups"
              :key="`mobile-${group.key}`"
            >
              <div class="app-sidebar__group">
                <button
                  type="button"
                  class="ot-group-button"
                  @click="toggleGroup(`mobile-${group.key}`, group.items)"
                >
                  <div class="ot-group-button__main">
                    <i
                      :class="group.icon"
                      class="ot-group-button__icon"
                    />
                    <span class="ot-group-button__label">
                      {{ group.label }}
                    </span>
                  </div>

                  <i
                    class="pi ot-group-button__arrow"
                    :class="
                      isGroupExpanded(`mobile-${group.key}`, group.items)
                        ? 'pi-chevron-down'
                        : 'pi-chevron-right'
                    "
                  />
                </button>

                <div
                  v-show="isGroupExpanded(`mobile-${group.key}`, group.items)"
                  class="app-sidebar__items"
                >
                  <button
                    v-for="item in group.items"
                    :key="item.key"
                    type="button"
                    :class="sidebarItemClass(item.to)"
                    @click="go(item.to, true)"
                  >
                    <i
                      :class="item.icon"
                      class="ot-nav-item__icon"
                    />
                    <span class="ot-nav-item__label">
                      {{ item.label }}
                    </span>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </ScrollPanel>
      </div>

      <div class="app-sidebar__mobile-footer">
        <button
          type="button"
          class="app-sidebar__profile-card"
          :class="{ 'app-sidebar__profile-card--active': isActivePath('/profile') }"
          :title="displayName"
          :aria-label="displayName"
          @click="goProfile(true)"
        >
          <Avatar
            :label="accountInitial"
            shape="circle"
            class="app-sidebar__profile-avatar"
          />

          <div class="app-sidebar__profile-text">
            <span class="app-sidebar__profile-name">
              {{ displayName }}
            </span>
            <span class="app-sidebar__profile-subtitle">
              {{ accountSubtitle }}
            </span>
          </div>

          <i class="pi pi-angle-right app-sidebar__profile-arrow" />
        </button>

        <Button
          :label="t('auth.logout')"
          icon="pi pi-sign-out"
          text
          severity="danger"
          size="small"
          class="app-sidebar__logout-btn w-full !justify-start"
          @click="logout"
        />
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: none;
  flex-direction: column;
  border-right: 1px solid var(--ot-border);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--ot-surface) 98%, transparent),
      color-mix(in srgb, var(--ot-surface-2) 96%, transparent)
    );
  transition: width 0.2s ease-out;
}

.app-sidebar--expanded {
  width: 272px;
}

.app-sidebar--collapsed {
  width: 88px;
}

.app-sidebar__brand {
  display: flex;
  height: 56px;
  align-items: center;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-border);
  padding-inline: 0.75rem;
}

.app-sidebar__logo {
  display: inline-flex;
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 0.9rem;
  background: var(--ot-blue);
  color: #ffffff;
  box-shadow: var(--ot-shadow-sm);
}

.app-sidebar__logo i {
  font-size: 0.9rem;
}

.app-sidebar__brand-text {
  min-width: 0;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.94rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-sidebar__nav {
  min-height: 0;
  flex: 1;
  padding: 0.75rem 0.5rem;
}

.app-sidebar__nav-inner {
  display: grid;
  gap: 0.38rem;
}

.app-sidebar__collapsed-group {
  display: grid;
  gap: 0.25rem;
}

.app-sidebar__group {
  border-radius: 0.9rem;
}

.app-sidebar__items {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.app-sidebar__footer {
  display: grid;
  gap: 0.45rem;
  border-top: 1px solid var(--ot-border);
  padding: 0.55rem;
}

.app-sidebar__footer--collapsed {
  justify-items: center;
  padding-inline: 0.65rem;
}

.app-sidebar__profile-card {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 0.58rem;
  border: 1px solid color-mix(in srgb, var(--ot-border) 86%, transparent);
  border-radius: 0.95rem;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--ot-surface) 94%, white 6%),
      color-mix(in srgb, var(--ot-surface-2) 92%, white 8%)
    );
  padding: 0.48rem 0.55rem;
  color: var(--ot-text);
  text-align: left;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.05);
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.app-sidebar__profile-card:hover {
  border-color: color-mix(in srgb, var(--ot-blue) 35%, transparent);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--ot-blue) 10%, transparent),
      color-mix(in srgb, var(--ot-sky) 8%, transparent)
    );
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
}

.app-sidebar__profile-card--active {
  border-color: color-mix(in srgb, var(--ot-blue) 42%, transparent);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--ot-blue) 16%, transparent),
      color-mix(in srgb, var(--ot-sky) 12%, transparent)
    );
}

.app-sidebar__profile-card--collapsed {
  justify-content: center;
  padding: 0.42rem;
}

.app-sidebar__profile-avatar {
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--ot-blue) 16%, transparent);
  color: var(--ot-blue);
  font-size: 0.78rem;
  font-weight: 900;
}

.app-sidebar__profile-text {
  display: grid;
  min-width: 0;
  gap: 0.06rem;
}

.app-sidebar__profile-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ot-text);
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-sidebar__profile-subtitle {
  min-width: 0;
  overflow: hidden;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
  font-weight: 650;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-sidebar__profile-arrow {
  margin-left: auto;
  flex: 0 0 auto;
  color: var(--ot-muted);
  font-size: 0.72rem;
}

.app-sidebar__logout-btn {
  color: #dc2626 !important;
}

.app-sidebar__logout-btn:hover {
  background: rgba(220, 38, 38, 0.1) !important;
  color: #b91c1c !important;
}

.app-sidebar__logout-btn--icon {
  justify-content: center !important;
}

:deep(.app-sidebar__logout-btn .p-button-icon),
:deep(.app-sidebar__logout-btn .p-button-label) {
  color: inherit !important;
}

.app-sidebar__mobile-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.app-sidebar__mobile {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.app-sidebar__mobile-nav {
  min-height: 0;
  flex: 1;
  padding-block: 0.75rem;
}

.app-sidebar__mobile-footer {
  display: grid;
  gap: 0.5rem;
  border-top: 1px solid var(--ot-border);
  padding-top: 0.75rem;
}

.ot-group-button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.8rem;
  padding: 0.58rem 0.7rem;
  color: var(--ot-text-muted);
  font-size: 0.82rem;
  font-weight: 650;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.ot-group-button:hover {
  background: color-mix(in srgb, var(--ot-blue) 9%, transparent);
  color: var(--ot-text);
}

.ot-group-button__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
}

.ot-group-button__icon {
  flex: 0 0 auto;
  font-size: 0.86rem;
}

.ot-group-button__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-group-button__arrow {
  flex: 0 0 auto;
  font-size: 0.68rem;
  transition: transform 0.15s ease;
}

.ot-nav-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.62rem;
  border-radius: 0.8rem;
  padding: 0.58rem 0.7rem 0.58rem 0.9rem;
  color: var(--ot-text-muted);
  text-align: left;
  font-size: 0.82rem;
  font-weight: 550;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.ot-nav-item:hover {
  background: color-mix(in srgb, var(--ot-blue) 10%, transparent);
  color: var(--ot-text);
}

.ot-nav-item-active {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--ot-blue) 18%, transparent),
      color-mix(in srgb, var(--ot-sky) 14%, transparent)
    );
  color: var(--ot-text);
  font-weight: 700;
}

.ot-nav-item-collapsed {
  justify-content: center;
  padding: 0.72rem;
}

.ot-nav-item__icon {
  flex: 0 0 auto;
  font-size: 0.88rem;
}

.ot-nav-item__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.p-scrollpanel .p-scrollpanel-bar) {
  background: color-mix(in srgb, var(--ot-blue) 48%, transparent) !important;
}

:deep(.ot-app-drawer.p-drawer) {
  width: min(88vw, 280px) !important;
  border-right: 1px solid var(--ot-border) !important;
  background: var(--ot-surface) !important;
}

:deep(.ot-app-drawer .p-drawer-header) {
  border-bottom: 1px solid var(--ot-border) !important;
  background: var(--ot-surface) !important;
  padding: 1rem 1rem 0.75rem !important;
}

:deep(.ot-app-drawer .p-drawer-content) {
  background: var(--ot-surface) !important;
  padding: 1rem !important;
}

:global(.dark) .app-sidebar {
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--ot-surface) 94%, #020617 6%),
      color-mix(in srgb, var(--ot-surface-2) 88%, #020617 12%)
    );
}

:global(.dark) .app-sidebar__profile-card {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--ot-surface) 92%, #020617 8%),
      color-mix(in srgb, var(--ot-surface-2) 88%, #020617 12%)
    );
  box-shadow: none;
}

:global(.dark) .app-sidebar__profile-card:hover,
:global(.dark) .app-sidebar__profile-card--active {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--ot-blue) 18%, transparent),
      color-mix(in srgb, var(--ot-sky) 12%, transparent)
    );
}

:global(.dark) .app-sidebar__logout-btn {
  color: #f87171 !important;
}

:global(.dark) .app-sidebar__logout-btn:hover {
  background: rgba(248, 113, 113, 0.13) !important;
  color: #fecaca !important;
}

@media (min-width: 1024px) {
  .app-sidebar {
    display: flex;
  }
}
</style>