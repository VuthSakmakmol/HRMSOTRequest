<!-- frontend/src/layouts/components/AppSidebar.vue -->
<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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

const openGroups = ref({})

const permissionCodes = computed(() => {
  const raw = auth.user?.effectivePermissionCodes
  return Array.isArray(raw)
    ? raw.map((v) => String(v || '').trim().toUpperCase()).filter(Boolean)
    : []
})

const roleCodes = computed(() => {
  const raw = auth.user?.roleCodes
  return Array.isArray(raw)
    ? raw.map((v) => String(v || '').trim().toUpperCase()).filter(Boolean)
    : []
})

const isRootAdmin = computed(() => {
  if (auth.user?.isRootAdmin) return true
  return roleCodes.value.includes('ROOT_ADMIN')
})

function hasAccess(required = []) {
  if (!required?.length) return true
  if (isRootAdmin.value) return true

  const normalized = required
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)

  return normalized.some((code) => permissionCodes.value.includes(code))
}

function isActivePath(to) {
  if (!to) return false
  return route.path === to || route.path.startsWith(`${to}/`)
}

function closeMobile() {
  emit('update:mobileVisible', false)
}

async function go(to, closeAfter = false) {
  if (!to) return
  await router.push(to)
  if (closeAfter) closeMobile()
}

async function logout() {
  await auth.logout()
  closeMobile()
  router.push('/login')
}

const navGroups = computed(() => {
  const groups = [
    {
      key: 'workspace',
      label: 'Workspace',
      icon: 'pi pi-home',
      items: [
        {
          key: 'dashboard',
          label: 'Dashboard',
          icon: 'pi pi-chart-bar',
          to: '/',
        },
      ],
    },
    {
      key: 'organization',
      label: 'Organization',
      icon: 'pi pi-sitemap',
      items: [
        {
          key: 'permissions',
          label: 'Permissions',
          icon: 'pi pi-shield',
          to: '/access/permissions',
          permissions: ['PERMISSION_VIEW'],
        },
        {
          key: 'roles',
          label: 'Roles',
          icon: 'pi pi-id-card',
          to: '/org/roles',
          permissions: ['ROLE_VIEW'],
        },
        {
          key: 'departments',
          label: 'Departments',
          icon: 'pi pi-building',
          to: '/org/departments',
          permissions: ['DEPARTMENT_VIEW'],
        },
        {
          key: 'positions',
          label: 'Positions',
          icon: 'pi pi-briefcase',
          to: '/org/positions',
          permissions: ['POSITION_VIEW'],
        },
        {
          key: 'employees',
          label: 'Employees',
          icon: 'pi pi-users',
          to: '/org/employees',
          permissions: ['EMPLOYEE_VIEW'],
        },
        {
          key: 'org-chart',
          label: 'Organization Chart',
          icon: 'pi pi-share-alt',
          to: '/org/org-chart',
          permissions: ['EMPLOYEE_VIEW'],
        },
      ],
    },
    {
      key: 'calendar',
      label: 'Calendar',
      icon: 'pi pi-calendar',
      items: [
        {
          key: 'holidays',
          label: 'Holiday Master',
          icon: 'pi pi-calendar-plus',
          to: '/calendar/holidays',
          permissions: ['HOLIDAY_VIEW', 'HOLIDAY_CREATE', 'HOLIDAY_UPDATE'],
        },
      ],
    },
    {
      key: 'shift',
      label: 'Shift',
      icon: 'pi pi-stopwatch',
      items: [
        {
          key: 'shift-master',
          label: 'Shift Master',
          icon: 'pi pi-clock',
          to: '/shift/list',
          permissions: ['SHIFT_VIEW', 'SHIFT_CREATE', 'SHIFT_UPDATE'],
        },
      ],
    },
    {
      key: 'access',
      label: 'Access Control',
      icon: 'pi pi-lock',
      items: [
        {
          key: 'accounts',
          label: 'Accounts',
          icon: 'pi pi-user-edit',
          to: '/auth/accounts',
          permissions: ['ACCOUNT_VIEW'],
        },
      ],
    },
    {
      key: 'overtime',
      label: 'Overtime',
      icon: 'pi pi-clock',
      items: [
        {
          key: 'ot-requests',
          label: 'OT Requests',
          icon: 'pi pi-file-edit',
          to: '/ot/requests',
          permissions: ['OT_REQUEST_VIEW', 'OT_REQUEST_CREATE', 'OT_REQUEST_APPROVE'],
        },
        {
          key: 'ot-approvals',
          label: 'Approval Inbox',
          icon: 'pi pi-inbox',
          to: '/ot/approvals',
          permissions: ['OT_REQUEST_APPROVE'],
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

const currentUserName = computed(() => auth.user?.displayName || 'System User')
const currentUserLogin = computed(() => auth.user?.loginId || '-')
const currentRoleLabel = computed(() => {
  if (isRootAdmin.value) return 'ROOT_ADMIN'
  return roleCodes.value[0] || 'USER'
})

const desktopSidebarClass = computed(() =>
  props.desktopCollapsed ? 'w-[88px]' : 'w-[272px]',
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
  const base = isActivePath(to) ? 'ot-nav-item ot-nav-item-active' : 'ot-nav-item'
  return collapsed ? `${base} ot-nav-item-collapsed` : base
}
</script>

<template>
  <aside
    :class="desktopSidebarClass"
    class="fixed inset-y-0 left-0 z-40 hidden border-r border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] transition-[width] duration-200 ease-out lg:flex lg:flex-col"
  >
    <div class="flex h-[56px] items-center gap-3 border-b border-[color:var(--ot-border)] px-3">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--ot-blue)] text-white shadow-sm"
      >
        <i class="pi pi-objects-column text-sm" />
      </div>

      <div v-if="!desktopCollapsed" class="min-w-0">
        <div class="truncate text-[15px] font-semibold text-[color:var(--ot-text)]">
          OT Request
        </div>
        <div class="truncate text-[11px] text-[color:var(--ot-text-muted)]">
          Enterprise Workspace
        </div>
      </div>
    </div>

    <div v-if="!desktopCollapsed" class="border-b border-[color:var(--ot-border)] px-3 py-3">
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--ot-sky)] text-sm font-semibold text-[color:var(--ot-text)]"
        >
          {{ String(currentUserName).charAt(0).toUpperCase() }}
        </div>

        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-[color:var(--ot-text)]">
            {{ currentUserName }}
          </div>
          <div class="truncate text-xs text-[color:var(--ot-text-muted)]">
            {{ currentUserLogin }}
          </div>
        </div>
      </div>

      <div class="mt-3">
        <span class="ot-role-chip">
          {{ currentRoleLabel }}
        </span>
      </div>
    </div>

    <div class="min-h-0 flex-1 px-2 py-3">
      <ScrollPanel style="width: 100%; height: 100%">
        <div class="space-y-1.5">
          <template v-for="group in navGroups" :key="group.key">
            <div v-if="desktopCollapsed" class="space-y-1">
              <button
                v-for="item in group.items"
                :key="item.key"
                type="button"
                :class="sidebarItemClass(item.to, true)"
                :title="item.label"
                @click="go(item.to)"
              >
                <i :class="item.icon" class="text-sm" />
              </button>
            </div>

            <div v-else class="rounded-xl">
              <button
                type="button"
                class="ot-group-button"
                @click="toggleGroup(group.key, group.items)"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <i :class="group.icon" class="text-sm" />
                  <span class="truncate">{{ group.label }}</span>
                </div>
                <i
                  class="pi text-xs transition-transform duration-150"
                  :class="isGroupExpanded(group.key, group.items) ? 'pi-chevron-down' : 'pi-chevron-right'"
                />
              </button>

              <div
                v-show="isGroupExpanded(group.key, group.items)"
                class="mt-1 space-y-1"
              >
                <button
                  v-for="item in group.items"
                  :key="item.key"
                  type="button"
                  :class="sidebarItemClass(item.to)"
                  @click="go(item.to)"
                >
                  <i :class="item.icon" class="text-sm" />
                  <span class="truncate">{{ item.label }}</span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </ScrollPanel>
    </div>

    <div class="border-t border-[color:var(--ot-border)] p-2">
      <Button
        v-if="!desktopCollapsed"
        label="Logout"
        icon="pi pi-sign-out"
        text
        severity="secondary"
        size="small"
        class="w-full !justify-start"
        @click="logout"
      />
      <Button
        v-else
        icon="pi pi-sign-out"
        text
        rounded
        severity="secondary"
        size="small"
        class="w-full"
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
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--ot-blue)] text-white shadow-sm"
        >
          <i class="pi pi-objects-column text-sm" />
        </div>

        <div class="min-w-0">
          <div class="truncate text-[15px] font-semibold text-[color:var(--ot-text)]">
            OT Request
          </div>
          <div class="truncate text-xs text-[color:var(--ot-text-muted)]">
            Enterprise Workspace
          </div>
        </div>
      </div>
    </template>

    <div class="flex h-full min-h-0 flex-col">
      <div class="border-b border-[color:var(--ot-border)] pb-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--ot-sky)] text-sm font-semibold text-[color:var(--ot-text)]"
          >
            {{ String(currentUserName).charAt(0).toUpperCase() }}
          </div>

          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-[color:var(--ot-text)]">
              {{ currentUserName }}
            </div>
            <div class="truncate text-xs text-[color:var(--ot-text-muted)]">
              {{ currentUserLogin }}
            </div>
          </div>
        </div>

        <div class="mt-3">
          <span class="ot-role-chip">
            {{ currentRoleLabel }}
          </span>
        </div>
      </div>

      <div class="min-h-0 flex-1 py-3">
        <ScrollPanel style="width: 100%; height: 100%">
          <div class="space-y-1.5">
            <template v-for="group in navGroups" :key="`mobile-${group.key}`">
              <div class="rounded-xl">
                <button
                  type="button"
                  class="ot-group-button"
                  @click="toggleGroup(`mobile-${group.key}`, group.items)"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <i :class="group.icon" class="text-sm" />
                    <span class="truncate">{{ group.label }}</span>
                  </div>
                  <i
                    class="pi text-xs transition-transform duration-150"
                    :class="isGroupExpanded(`mobile-${group.key}`, group.items) ? 'pi-chevron-down' : 'pi-chevron-right'"
                  />
                </button>

                <div
                  v-show="isGroupExpanded(`mobile-${group.key}`, group.items)"
                  class="mt-1 space-y-1"
                >
                  <button
                    v-for="item in group.items"
                    :key="item.key"
                    type="button"
                    :class="sidebarItemClass(item.to)"
                    @click="go(item.to, true)"
                  >
                    <i :class="item.icon" class="text-sm" />
                    <span class="truncate">{{ item.label }}</span>
                  </button>
                </div>
              </div>
            </template>
          </div>
        </ScrollPanel>
      </div>

      <div class="border-t border-[color:var(--ot-border)] pt-3">
        <Button
          label="Logout"
          icon="pi pi-sign-out"
          text
          severity="secondary"
          size="small"
          class="w-full !justify-start"
          @click="logout"
        />
      </div>
    </div>
  </Drawer>
</template>

<style scoped>
.ot-role-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.22rem 0.6rem;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1;
  background: rgba(129, 166, 198, 0.14);
  color: var(--ot-text);
  border: 1px solid rgba(129, 166, 198, 0.2);
}

.ot-group-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 12px;
  padding: 0.62rem 0.72rem;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--ot-text-muted);
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.ot-group-button:hover {
  background: rgba(129, 166, 198, 0.08);
  color: var(--ot-text);
}

.ot-nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border-radius: 12px;
  padding: 0.62rem 0.72rem 0.62rem 0.9rem;
  text-align: left;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--ot-text-muted);
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}

.ot-nav-item:hover {
  background: rgba(129, 166, 198, 0.09);
  color: var(--ot-text);
}

.ot-nav-item-active {
  background: rgba(129, 166, 198, 0.14);
  color: var(--ot-text);
  font-weight: 600;
}

.ot-nav-item-collapsed {
  justify-content: center;
  padding: 0.72rem;
}

:deep(.p-scrollpanel .p-scrollpanel-bar) {
  background: rgba(129, 166, 198, 0.38) !important;
}

:deep(.ot-app-drawer.p-drawer) {
  width: min(88vw, 280px) !important;
  background: var(--ot-surface) !important;
  border-right: 1px solid var(--ot-border) !important;
}

:deep(.ot-app-drawer .p-drawer-header) {
  padding: 1rem 1rem 0.75rem !important;
  border-bottom: 1px solid var(--ot-border) !important;
  background: var(--ot-surface) !important;
}

:deep(.ot-app-drawer .p-drawer-content) {
  padding: 1rem !important;
  background: var(--ot-surface) !important;
}
</style>