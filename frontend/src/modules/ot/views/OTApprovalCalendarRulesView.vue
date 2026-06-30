<!-- frontend/src/modules/ot/views/OTApprovalCalendarRulesView.vue -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'

import { useAuthStore } from '@/modules/auth/auth.store'
import { getApiErrorMessage } from '@/shared/utils/apiError'
import {
  getOTApprovalCalendarRules,
  getOTApprovalCalendarRuleEmployees,
  updateOTApprovalCalendarRule,
  resetOTApprovalCalendarRule,
} from '@/modules/ot/otMaster.api'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const loading = ref(false)
const savingEmployeeId = ref('')
const resettingEmployeeId = ref('')

const rules = ref([])
const employeeOptions = ref([])
const employeeSearch = ref('')
const selectedEmployeeId = ref('')

const roleOptions = computed(() => [
  { value: 'USE_DEFAULT', label: t('ot.approvalCalendarRules.useEmployeeDefault') },
  { value: 'APPROVER', label: t('ot.approvalCalendarRules.approver') },
  { value: 'FINAL_APPROVER', label: t('ot.approvalCalendarRules.finalApprover') },
  { value: 'ACKNOWLEDGE', label: t('ot.approvalCalendarRules.acknowledge') },
  { value: 'SKIP', label: t('ot.approvalCalendarRules.skip') },
])

const canView = computed(() => hasPermission('OT_APPROVAL_RULE_VIEW'))
const canUpdate = computed(() => hasPermission('OT_APPROVAL_RULE_UPDATE'))

const selectedEmployee = computed(() =>
  employeeOptions.value.find((item) => item.employeeId === selectedEmployeeId.value) || null,
)

const availableEmployeeOptions = computed(() => {
  const configured = new Set(rules.value.map((item) => item.employeeId))
  return employeeOptions.value.filter((item) => !configured.has(item.employeeId))
})

function hasPermission(code) {
  return (
    auth.user?.isRootAdmin ||
    auth.isRootAdmin ||
    auth.hasPermission?.(code) ||
    auth.hasAnyPermission?.([code])
  )
}

function normalizeResponse(response) {
  return response?.data?.data || response?.data || {}
}

function normalizeRole(value) {
  const role = String(value || 'USE_DEFAULT').trim().toUpperCase()
  return roleOptions.value.some((item) => item.value === role) ? role : 'USE_DEFAULT'
}

function roleLabel(value) {
  return roleOptions.value.find((item) => item.value === normalizeRole(value))?.label
    || t('ot.approvalCalendarRules.useEmployeeDefault')
}

function roleClass(value) {
  const role = normalizeRole(value)
  if (role === 'FINAL_APPROVER') return 'is-final'
  if (role === 'APPROVER') return 'is-approver'
  if (role === 'ACKNOWLEDGE') return 'is-acknowledge'
  if (role === 'SKIP') return 'is-skip'
  return 'is-default'
}

function roleIcon(value) {
  const role = normalizeRole(value)
  if (role === 'FINAL_APPROVER') return 'pi pi-check-circle'
  if (role === 'APPROVER') return 'pi pi-check'
  if (role === 'ACKNOWLEDGE') return 'pi pi-eye'
  if (role === 'SKIP') return 'pi pi-minus-circle'
  return 'pi pi-circle'
}

function normalizeRule(item = {}) {
  return {
    ...item,
    workingDayRole: normalizeRole(item.workingDayRole),
    sundayRole: normalizeRole(item.sundayRole),
    holidayRole: normalizeRole(item.holidayRole),
  }
}

function employeeName(rule = {}) {
  return rule.employeeName || rule.employeeLabel || t('ot.approvalCalendarRules.unknownEmployee')
}

function employeeCode(rule = {}) {
  return rule.employeeCode || ''
}

function employeeInitials(rule = {}) {
  const source = employeeName(rule)
  const words = String(source || '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return String(source || '?').slice(0, 2).toUpperCase()
}

async function loadRules({ silent = false } = {}) {
  if (!canView.value) return

  loading.value = true
  try {
    const response = await getOTApprovalCalendarRules()
    const data = normalizeResponse(response)
    rules.value = Array.isArray(data.items) ? data.items.map(normalizeRule) : []
  } catch (error) {
    if (!silent) {
      toast.add({
        severity: 'error',
        summary: t('ot.approvalCalendarRules.loadFailed'),
        detail: getApiErrorMessage(error, t('ot.approvalCalendarRules.loadFailedDetail')),
        life: 4500,
      })
    }
  } finally {
    loading.value = false
  }
}

async function searchEmployees() {
  if (!canUpdate.value) return

  try {
    const response = await getOTApprovalCalendarRuleEmployees({
      search: employeeSearch.value.trim(),
      limit: 100,
    })
    const data = normalizeResponse(response)
    employeeOptions.value = Array.isArray(data.items) ? data.items : []
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('ot.approvalCalendarRules.employeeSearchFailed'),
      detail: getApiErrorMessage(error, t('ot.approvalCalendarRules.employeeSearchFailedDetail')),
      life: 4000,
    })
  }
}

function rulePayload(rule = {}) {
  return {
    workingDayRole: normalizeRole(rule.workingDayRole),
    sundayRole: normalizeRole(rule.sundayRole),
    holidayRole: normalizeRole(rule.holidayRole),
    isActive: rule.isActive !== false,
  }
}

async function saveRule(rule, { quiet = false } = {}) {
  if (!canUpdate.value || !rule?.employeeId) return

  savingEmployeeId.value = rule.employeeId

  try {
    const response = await updateOTApprovalCalendarRule(rule.employeeId, rulePayload(rule))
    const item = normalizeRule(normalizeResponse(response)?.item || {})
    const index = rules.value.findIndex((row) => row.employeeId === rule.employeeId)

    if (index >= 0) {
      rules.value.splice(index, 1, item)
    } else {
      rules.value.push(item)
      rules.value.sort((a, b) => String(a.employeeLabel || '').localeCompare(String(b.employeeLabel || '')))
    }

    if (!quiet) {
      toast.add({
        severity: 'success',
        summary: t('ot.approvalCalendarRules.ruleSaved'),
        detail: t('ot.approvalCalendarRules.ruleSavedDetail', { employee: employeeName(item) }),
        life: 2400,
      })
    }
  } catch (error) {
    await loadRules({ silent: true })
    toast.add({
      severity: 'error',
      summary: t('ot.approvalCalendarRules.saveFailed'),
      detail: getApiErrorMessage(error, t('ot.approvalCalendarRules.saveFailedDetail')),
      life: 5000,
    })
  } finally {
    savingEmployeeId.value = ''
  }
}

async function addSelectedEmployee() {
  const employee = selectedEmployee.value
  if (!employee || !canUpdate.value) return

  const rule = {
    employeeId: employee.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    employeeLabel: employee.employeeLabel,
    workingDayRole: 'USE_DEFAULT',
    sundayRole: 'USE_DEFAULT',
    holidayRole: 'USE_DEFAULT',
    isActive: true,
  }

  await saveRule(rule)
  selectedEmployeeId.value = ''
}

async function resetRule(rule) {
  if (!canUpdate.value || !rule?.employeeId) return

  resettingEmployeeId.value = rule.employeeId

  try {
    await resetOTApprovalCalendarRule(rule.employeeId)
    rules.value = rules.value.filter((item) => item.employeeId !== rule.employeeId)

    toast.add({
      severity: 'success',
      summary: t('ot.approvalCalendarRules.ruleReset'),
      detail: t('ot.approvalCalendarRules.ruleResetDetail', { employee: employeeName(rule) }),
      life: 2600,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('ot.approvalCalendarRules.resetFailed'),
      detail: getApiErrorMessage(error, t('ot.approvalCalendarRules.resetFailedDetail')),
      life: 4500,
    })
  } finally {
    resettingEmployeeId.value = ''
  }
}

function saveOnRoleChange(rule) {
  saveRule(rule, { quiet: true })
}

onMounted(async () => {
  await Promise.all([loadRules(), searchEmployees()])
})
</script>

<template>
  <div class="ot-page-shell ot-approval-calendar-rules-page">
    <section class="ot-table-card ot-approval-calendar-rules-card">
      <header class="ot-approval-calendar-header">
        <div class="ot-approval-calendar-heading">
          <div class="ot-approval-calendar-heading-icon">
            <i class="pi pi-calendar-clock" />
          </div>
          <div>
            <h2 class="ot-table-title">{{ t('ot.approvalCalendarRules.pageTitle') }}</h2>
            <div class="ot-approval-calendar-heading-meta">
              <span><i class="pi pi-sitemap" /> {{ t('ot.approvalCalendarRules.calendarWorkflow') }}</span>
              <span v-if="rules.length" class="ot-approval-calendar-count">
                {{ t('ot.approvalCalendarRules.rulesConfigured', { count: rules.length }) }}
              </span>
            </div>
          </div>
        </div>

        <Button
          :label="t('ot.approvalCalendarRules.reload')"
          icon="pi pi-refresh"
          size="small"
          severity="secondary"
          outlined
          :loading="loading"
          @click="loadRules"
        />
      </header>

      <div v-if="!canView" class="ot-empty-state">
        <div class="ot-empty-icon"><i class="pi pi-lock" /></div>
        <div class="ot-empty-title">{{ t('ot.approvalCalendarRules.accessDenied') }}</div>
        <div class="ot-empty-text">{{ t('ot.approvalCalendarRules.accessDeniedDetail') }}</div>
      </div>

      <template v-else>
        <div v-if="canUpdate" class="ot-approval-calendar-add-bar">
          <div class="ot-approval-calendar-add-icon"><i class="pi pi-user-plus" /></div>
          <div class="ot-approval-calendar-add-controls">
            <InputText
              v-model="employeeSearch"
              class="ot-approval-calendar-search"
              :placeholder="t('ot.approvalCalendarRules.searchPlaceholder')"
              @keyup.enter="searchEmployees"
            />
            <Button
              icon="pi pi-search"
              severity="secondary"
              outlined
              size="small"
              :aria-label="t('common.search')"
              @click="searchEmployees"
            />
            <Select
              v-model="selectedEmployeeId"
              :options="availableEmployeeOptions"
              option-label="employeeLabel"
              option-value="employeeId"
              :placeholder="t('ot.approvalCalendarRules.selectEmployee')"
              filter
              class="ot-approval-calendar-employee-select"
              :disabled="!availableEmployeeOptions.length"
            >
              <template #option="slotProps">
                <div class="ot-approval-calendar-option">
                  <strong>{{ slotProps.option.employeeName || slotProps.option.employeeLabel }}</strong>
                  <span>{{ slotProps.option.employeeCode }}</span>
                </div>
              </template>
            </Select>
            <Button
              :label="t('ot.approvalCalendarRules.add')"
              icon="pi pi-plus"
              size="small"
              :disabled="!selectedEmployeeId || Boolean(savingEmployeeId)"
              @click="addSelectedEmployee"
            />
          </div>
        </div>

        <div v-else class="ot-approval-calendar-view-only">
          <i class="pi pi-eye" />
          <span>{{ t('ot.approvalCalendarRules.viewOnly') }}</span>
        </div>

        <div v-if="loading && !rules.length" class="ot-empty-state">
          <div class="ot-empty-icon"><i class="pi pi-spin pi-spinner" /></div>
          <div class="ot-empty-text">{{ t('ot.approvalCalendarRules.loading') }}</div>
        </div>

        <div v-else-if="!rules.length" class="ot-empty-state ot-approval-calendar-empty">
          <div class="ot-empty-icon"><i class="pi pi-calendar-plus" /></div>
          <div class="ot-empty-title">{{ t('ot.approvalCalendarRules.noRules') }}</div>
        </div>

        <div v-else class="ot-approval-calendar-rule-list">
          <article
            v-for="rule in rules"
            :key="rule.employeeId"
            class="ot-approval-calendar-rule-card"
          >
            <div class="ot-approval-calendar-person">
              <Avatar
                :label="employeeInitials(rule)"
                shape="circle"
                class="ot-approval-calendar-avatar"
              />
              <div class="ot-approval-calendar-person-copy">
                <strong>{{ employeeName(rule) }}</strong>
                <span v-if="employeeCode(rule)">{{ employeeCode(rule) }}</span>
              </div>
              <Button
                v-if="canUpdate"
                icon="pi pi-undo"
                :label="t('ot.approvalCalendarRules.reset')"
                severity="secondary"
                text
                size="small"
                :loading="resettingEmployeeId === rule.employeeId"
                :disabled="Boolean(savingEmployeeId)"
                @click="resetRule(rule)"
              />
            </div>

            <div class="ot-approval-calendar-role-grid">
              <div class="ot-approval-calendar-day-card is-working-day">
                <div class="ot-approval-calendar-day-heading">
                  <i class="pi pi-briefcase" />
                  <span>{{ t('ot.approvalCalendarRules.workingDay') }}</span>
                </div>
                <Select
                  v-model="rule.workingDayRole"
                  :options="roleOptions"
                  option-label="label"
                  option-value="value"
                  :disabled="!canUpdate || savingEmployeeId === rule.employeeId"
                  :aria-label="t('ot.approvalCalendarRules.workingDay')"
                  @change="saveOnRoleChange(rule)"
                />
                <div class="ot-approval-calendar-role-state" :class="roleClass(rule.workingDayRole)">
                  <i :class="roleIcon(rule.workingDayRole)" />
                  <span>{{ roleLabel(rule.workingDayRole) }}</span>
                </div>
              </div>

              <div class="ot-approval-calendar-day-card is-sunday">
                <div class="ot-approval-calendar-day-heading">
                  <i class="pi pi-sun" />
                  <span>{{ t('ot.approvalCalendarRules.sunday') }}</span>
                </div>
                <Select
                  v-model="rule.sundayRole"
                  :options="roleOptions"
                  option-label="label"
                  option-value="value"
                  :disabled="!canUpdate || savingEmployeeId === rule.employeeId"
                  :aria-label="t('ot.approvalCalendarRules.sunday')"
                  @change="saveOnRoleChange(rule)"
                />
                <div class="ot-approval-calendar-role-state" :class="roleClass(rule.sundayRole)">
                  <i :class="roleIcon(rule.sundayRole)" />
                  <span>{{ roleLabel(rule.sundayRole) }}</span>
                </div>
              </div>

              <div class="ot-approval-calendar-day-card is-holiday">
                <div class="ot-approval-calendar-day-heading">
                  <i class="pi pi-calendar" />
                  <span>{{ t('ot.approvalCalendarRules.holiday') }}</span>
                </div>
                <Select
                  v-model="rule.holidayRole"
                  :options="roleOptions"
                  option-label="label"
                  option-value="value"
                  :disabled="!canUpdate || savingEmployeeId === rule.employeeId"
                  :aria-label="t('ot.approvalCalendarRules.holiday')"
                  @change="saveOnRoleChange(rule)"
                />
                <div class="ot-approval-calendar-role-state" :class="roleClass(rule.holidayRole)">
                  <i :class="roleIcon(rule.holidayRole)" />
                  <span>{{ roleLabel(rule.holidayRole) }}</span>
                </div>
              </div>
            </div>

            <div v-if="savingEmployeeId === rule.employeeId" class="ot-approval-calendar-saving">
              <i class="pi pi-spin pi-spinner" />
              <span>{{ t('ot.approvalCalendarRules.saving') }}</span>
            </div>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.ot-approval-calendar-rules-page {
  min-width: 0;
}

.ot-approval-calendar-rules-card {
  padding: 1rem;
}

.ot-approval-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  padding-bottom: 0.95rem;
  border-bottom: 1px solid var(--ot-border);
}

.ot-approval-calendar-heading,
.ot-approval-calendar-heading-meta,
.ot-approval-calendar-person,
.ot-approval-calendar-day-heading,
.ot-approval-calendar-role-state,
.ot-approval-calendar-view-only {
  display: flex;
  align-items: center;
}

.ot-approval-calendar-heading {
  min-width: 0;
  gap: 0.7rem;
}

.ot-approval-calendar-heading-icon {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--ot-primary) 25%, var(--ot-border));
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--ot-primary) 10%, var(--ot-surface));
  color: var(--ot-primary);
  font-size: 1rem;
}

.ot-approval-calendar-heading-meta {
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  margin-top: 0.22rem;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
}

.ot-approval-calendar-heading-meta > span:first-child {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.ot-approval-calendar-count {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0.1rem 0.48rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-primary) 10%, var(--ot-surface));
  color: var(--ot-primary);
  font-weight: 700;
}

.ot-approval-calendar-add-bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.6rem;
  align-items: center;
  margin-top: 0.85rem;
  padding: 0.65rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
}

.ot-approval-calendar-add-icon {
  display: grid;
  width: 2.05rem;
  height: 2.05rem;
  place-items: center;
  border-radius: 0.65rem;
  background: color-mix(in srgb, var(--ot-primary) 10%, var(--ot-surface));
  color: var(--ot-primary);
  font-size: 0.88rem;
}

.ot-approval-calendar-add-controls {
  display: grid;
  grid-template-columns: minmax(160px, 0.85fr) auto minmax(220px, 1.15fr) auto;
  gap: 0.45rem;
  align-items: center;
}

.ot-approval-calendar-search,
.ot-approval-calendar-employee-select {
  width: 100%;
}

.ot-approval-calendar-option strong,
.ot-approval-calendar-option span {
  display: block;
}

.ot-approval-calendar-option strong {
  color: var(--ot-text);
  font-size: 0.76rem;
}

.ot-approval-calendar-option span {
  margin-top: 0.08rem;
  color: var(--ot-text-muted);
  font-size: 0.66rem;
}

.ot-approval-calendar-view-only {
  width: fit-content;
  gap: 0.35rem;
  margin-top: 0.85rem;
  padding: 0.32rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-info) 10%, var(--ot-surface));
  color: var(--ot-info);
  font-size: 0.71rem;
  font-weight: 700;
}

.ot-approval-calendar-rule-list {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.ot-approval-calendar-rule-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(190px, 0.72fr) minmax(0, 2.28fr);
  gap: 0.85rem;
  align-items: stretch;
  padding: 0.8rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.9rem;
  background: var(--ot-surface);
  overflow: hidden;
}

.ot-approval-calendar-rule-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: var(--ot-primary);
  content: '';
}

.ot-approval-calendar-person {
  gap: 0.55rem;
  min-width: 0;
  padding: 0.2rem 0.2rem 0.2rem 0.4rem;
}

.ot-approval-calendar-avatar {
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--ot-primary) 16%, var(--ot-surface)) !important;
  color: var(--ot-primary) !important;
  font-size: 0.68rem;
  font-weight: 800;
}

.ot-approval-calendar-person-copy {
  min-width: 0;
  flex: 1;
}

.ot-approval-calendar-person-copy strong,
.ot-approval-calendar-person-copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-approval-calendar-person-copy strong {
  color: var(--ot-text);
  font-size: 0.8rem;
}

.ot-approval-calendar-person-copy span {
  margin-top: 0.14rem;
  color: var(--ot-text-muted);
  font-size: 0.68rem;
}

.ot-approval-calendar-role-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.ot-approval-calendar-day-card {
  min-width: 0;
  padding: 0.58rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.72rem;
  background: color-mix(in srgb, var(--ot-surface) 92%, var(--ot-page-background));
}

.ot-approval-calendar-day-card.is-working-day {
  border-top: 3px solid color-mix(in srgb, var(--ot-primary) 65%, var(--ot-border));
}

.ot-approval-calendar-day-card.is-sunday {
  border-top: 3px solid color-mix(in srgb, var(--ot-warning) 72%, var(--ot-border));
}

.ot-approval-calendar-day-card.is-holiday {
  border-top: 3px solid color-mix(in srgb, var(--ot-danger) 62%, var(--ot-border));
}

.ot-approval-calendar-day-heading {
  gap: 0.33rem;
  min-height: 1rem;
  margin-bottom: 0.4rem;
  color: var(--ot-text-muted);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.035em;
  text-transform: uppercase;
}

.ot-approval-calendar-day-card :deep(.p-select) {
  width: 100%;
  min-width: 0;
}

.ot-approval-calendar-day-card :deep(.p-select-label) {
  min-width: 0;
  overflow: hidden;
  font-size: 0.73rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-approval-calendar-role-state {
  min-width: 0;
  gap: 0.28rem;
  margin-top: 0.42rem;
  color: var(--ot-text-muted);
  font-size: 0.64rem;
  font-weight: 700;
}

.ot-approval-calendar-role-state span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-approval-calendar-role-state.is-final {
  color: var(--ot-success);
}

.ot-approval-calendar-role-state.is-approver {
  color: var(--ot-info);
}

.ot-approval-calendar-role-state.is-acknowledge {
  color: var(--ot-warning);
}

.ot-approval-calendar-role-state.is-skip,
.ot-approval-calendar-role-state.is-default {
  color: var(--ot-text-muted);
}

.ot-approval-calendar-saving {
  position: absolute;
  top: 0.45rem;
  right: 0.55rem;
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--ot-info);
  font-size: 0.64rem;
  font-weight: 700;
}

@media (max-width: 1100px) {
  .ot-approval-calendar-rule-card {
    grid-template-columns: 1fr;
  }

  .ot-approval-calendar-person {
    min-height: 2.25rem;
    padding-right: 4.7rem;
  }
}

@media (max-width: 820px) {
  .ot-approval-calendar-rules-card {
    padding: 0.75rem;
  }

  .ot-approval-calendar-header {
    align-items: flex-start;
  }

  .ot-approval-calendar-add-controls {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .ot-approval-calendar-employee-select {
    grid-column: 1 / -1;
  }

  .ot-approval-calendar-role-grid {
    grid-template-columns: 1fr;
  }

  .ot-approval-calendar-day-card {
    display: grid;
    grid-template-columns: minmax(105px, 0.65fr) minmax(0, 1fr);
    column-gap: 0.5rem;
    align-items: center;
  }

  .ot-approval-calendar-day-heading {
    margin-bottom: 0;
  }

  .ot-approval-calendar-role-state {
    grid-column: 2;
  }

  :deep(.p-inputtext),
  :deep(.p-select-label) {
    font-size: 16px !important;
  }
}

@media (max-width: 560px) {
  .ot-approval-calendar-header {
    flex-direction: column;
  }

  .ot-approval-calendar-header :deep(.p-button) {
    width: 100%;
    justify-content: center;
  }

  .ot-approval-calendar-add-bar {
    grid-template-columns: 1fr;
  }

  .ot-approval-calendar-add-icon {
    display: none;
  }

  .ot-approval-calendar-day-card {
    grid-template-columns: 1fr;
  }

  .ot-approval-calendar-role-state {
    grid-column: auto;
  }
}
</style>
