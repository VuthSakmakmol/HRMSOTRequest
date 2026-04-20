<!-- frontend/src/modules/ot/views/OTApprovalInboxView.vue -->
<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import {
  decideOTRequest,
  exportOTApprovalInboxExcel,
  getOTApprovalInbox,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const exporting = ref(false)

const filters = reactive({
  search: '',
  status: '',
  dayType: '',
  otDateFrom: null,
  otDateTo: null,
  sortField: 'createdAt',
  sortOrder: -1,
})

const decisionDialog = reactive({
  visible: false,
  loading: false,
  action: 'APPROVE',
  remark: '',
  row: null,
})

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const dayTypeOptions = [
  { label: 'All Day Types', value: '' },
  { label: 'Working Day', value: 'WORKING_DAY' },
  { label: 'Sunday', value: 'SUNDAY' },
  { label: 'Holiday', value: 'HOLIDAY' },
]

const totalInbox = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalInbox.value}`)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalInbox.value > PAGE_SIZE)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function formatDateYMD(value) {
  if (!value) return undefined

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

function buildQuery(page) {
  return {
    page,
    limit: PAGE_SIZE,
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
    sortBy: filters.sortField,
    sortOrder: filters.sortOrder === 1 ? 'asc' : 'desc',
  }
}

function dayTypeSeverity(value) {
  if (value === 'HOLIDAY') return 'danger'
  if (value === 'SUNDAY') return 'warning'
  return 'success'
}

function statusSeverity(value) {
  if (value === 'APPROVED') return 'success'
  if (value === 'REJECTED') return 'danger'
  if (value === 'CANCELLED') return 'contrast'
  if (value === 'PENDING') return 'warning'
  if (value === 'DRAFT') return 'info'
  return 'secondary'
}

function formatDateTime(value) {
  if (!value) return '-'

  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

function formatTimeRange(row) {
  const start = String(row?.startTime || '').trim()
  const end = String(row?.endTime || '').trim()
  if (!start && !end) return '-'
  return [start, end].filter(Boolean).join(' - ')
}

function formatRequester(row) {
  const name = String(
    row?.requesterName ||
      row?.createdByName ||
      row?.ownerName ||
      row?.employeeName ||
      '',
  ).trim()

  const employeeNo = String(
    row?.requesterEmployeeNo ||
      row?.createdByEmployeeNo ||
      row?.employeeNo ||
      '',
  ).trim()

  return {
    name: name || '-',
    employeeNo: employeeNo || '-',
  }
}

function getTargetEmployees(row) {
  if (Array.isArray(row?.employees)) return row.employees
  if (Array.isArray(row?.employeeItems)) return row.employeeItems
  if (Array.isArray(row?.targetEmployees)) return row.targetEmployees
  if (Array.isArray(row?.employeeList)) return row.employeeList
  return []
}

function getEmployeeCount(row) {
  const explicitCount = Number(row?.employeeCount || row?.totalEmployees || 0)
  if (explicitCount > 0) return explicitCount
  return getTargetEmployees(row).length
}

function currentStepLabel(row) {
  const current = Number(row?.currentApprovalStep || 1)
  const total = Array.isArray(row?.approvalSteps)
    ? row.approvalSteps.length
    : Number(row?.approvalStepCount || 0)

  return `Step ${current} / ${total || 0}`
}

function canDecide(row) {
  return String(row?.status || '').toUpperCase() === 'PENDING'
}

function openView(row) {
  const id = String(row?._id || row?.id || '').trim()
  if (!id) return
  router.push(`/ot/requests/${id}`)
}

function resetDecisionDialog() {
  decisionDialog.visible = false
  decisionDialog.loading = false
  decisionDialog.action = 'APPROVE'
  decisionDialog.remark = ''
  decisionDialog.row = null
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTApprovalInbox(buildQuery(page))
    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload)
    const total = Number(
      payload?.pagination?.total ||
        payload?.pagination?.totalRecords ||
        0,
    )

    totalRecords.value = total

    if (replace) {
      const nextRows = Array.from({ length: total }, () => null)
      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        nextRows[startIndex + i] = items[i]
      }

      rows.value = total === 0 ? [] : nextRows
      loadedPages.value = new Set([page])
    } else {
      if (!rows.value.length && total > 0) {
        rows.value = Array.from({ length: total }, () => null)
      }

      const startIndex = (page - 1) * PAGE_SIZE

      for (let i = 0; i < items.length; i += 1) {
        rows.value[startIndex + i] = items[i]
      }

      loadedPages.value.add(page)
    }

    bootstrapped.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Load failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to load approval inbox',
      life: 3000,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true } = {}) {
  if (!keepVisible) {
    rows.value = []
    totalRecords.value = 0
    loadedPages.value = new Set()
  }

  await fetchPage(1, {
    replace: true,
    silent: true,
  })
}

function runSearchSoon() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    reloadFirstPage({ keepVisible: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true })
}

function onDayTypeChange() {
  reloadFirstPage({ keepVisible: true })
}

function onDateChange() {
  reloadFirstPage({ keepVisible: true })
}

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
  filters.otDateFrom = null
  filters.otDateTo = null
  filters.sortField = 'createdAt'
  filters.sortOrder = -1
  reloadFirstPage({ keepVisible: true })
}

function onSort(event) {
  const fieldMap = {
    requestNo: 'requestNo',
    otDate: 'otDate',
    totalHours: 'totalHours',
    dayType: 'dayType',
    status: 'status',
    createdAt: 'createdAt',
  }

  filters.sortField = fieldMap[event.sortField] || 'createdAt'
  filters.sortOrder = typeof event.sortOrder === 'number' ? event.sortOrder : -1
  reloadFirstPage({ keepVisible: true })
}

async function onVirtualLazyLoad(event) {
  if (!useVirtualScroll.value) return

  const first = Number(event?.first || 0)
  const last = Number(event?.last || first + PAGE_SIZE)

  const startPage = Math.floor(first / PAGE_SIZE) + 1
  const endPage = Math.floor(Math.max(last - 1, first) / PAGE_SIZE) + 1

  for (let page = startPage; page <= endPage; page += 1) {
    if (!loadedPages.value.has(page)) {
      await fetchPage(page, { silent: true })
    }
  }
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

async function onExportExcel() {
  try {
    exporting.value = true

    const res = await exportOTApprovalInboxExcel(buildExportQuery())

    const blob =
      res?.data instanceof Blob
        ? res.data
        : new Blob([res?.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

    downloadBlob(blob, 'ot-approval-inbox.xlsx')

    toast.add({
      severity: 'success',
      summary: 'Export ready',
      detail: 'Excel exported successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to export Excel.',
      life: 3000,
    })
  } finally {
    exporting.value = false
  }
}

function openDecision(row, action) {
  if (!canDecide(row)) return

  decisionDialog.visible = true
  decisionDialog.loading = false
  decisionDialog.action = action
  decisionDialog.remark = ''
  decisionDialog.row = row
}

function closeDecision() {
  if (decisionDialog.loading) return
  resetDecisionDialog()
}

async function submitDecision() {
  const row = decisionDialog.row
  if (!row?._id && !row?.id) return

  if (decisionDialog.action === 'REJECT' && !String(decisionDialog.remark || '').trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Validation',
      detail: 'Please enter rejection remark.',
      life: 2500,
    })
    return
  }

  try {
    decisionDialog.loading = true

    await decideOTRequest(row._id || row.id, {
      action: decisionDialog.action,
      remark: decisionDialog.remark,
    })

    toast.add({
      severity: 'success',
      summary: 'Success',
      detail:
        decisionDialog.action === 'APPROVE'
          ? 'OT request approved successfully.'
          : 'OT request rejected successfully.',
      life: 2500,
    })

    resetDecisionDialog()
    await reloadFirstPage({ keepVisible: false })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Decision failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Unable to process decision.',
      life: 4000,
    })
    decisionDialog.loading = false
  }
}

onMounted(() => {
  reloadFirstPage({ keepVisible: false })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-semibold text-[color:var(--ot-text)]">
          OT Approval Inbox
        </h1>
        <p class="mt-1 text-sm text-[color:var(--ot-text-muted)]">
          Review overtime requests assigned to you with backend-driven search, filter, and approval status.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-[92px] flex-col items-center justify-center rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-3 py-2 text-center"
        >
          <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--ot-text-muted)]">
            Total
          </div>
          <div class="mt-1 text-lg font-semibold leading-none text-[color:var(--ot-text)]">
            {{ totalInbox }}
          </div>
        </div>

        <Button
          label="Export Excel"
          icon="pi pi-file-excel"
          severity="success"
          outlined
          size="small"
          :loading="exporting"
          @click="onExportExcel"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[320px] xl:shrink-0">
            <InputIcon class="pi pi-search" />
            <InputText
              v-model="filters.search"
              placeholder="Search request no, requester, employee, department, reason"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[170px] xl:shrink-0">
            <Select
              v-model="filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Status"
              class="w-full"
              size="small"
              @change="onStatusChange"
            />
          </div>

          <div class="w-full xl:w-[190px] xl:shrink-0">
            <Select
              v-model="filters.dayType"
              :options="dayTypeOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Day Type"
              class="w-full"
              size="small"
              @change="onDayTypeChange"
            />
          </div>

          <div class="w-full xl:w-[190px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateFrom"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date From"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="w-full xl:w-[190px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateTo"
              dateFormat="yy-mm-dd"
              showIcon
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date To"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="flex items-center gap-2 xl:ml-auto xl:shrink-0">
            <div class="rounded-lg border border-[color:var(--ot-border)] px-3 py-1.5 text-xs font-medium text-[color:var(--ot-text-muted)]">
              Loaded {{ summaryText }}
            </div>

            <Button
              label="Clear"
              icon="pi pi-refresh"
              severity="secondary"
              outlined
              size="small"
              @click="clearFilters"
            />
          </div>
        </div>
      </div>

      <DataTable
        :value="rows"
        lazy
        removableSort
        scrollable
        scrollHeight="500px"
        :sortField="filters.sortField"
        :sortOrder="filters.sortOrder"
        tableStyle="min-width: 104rem"
        class="ot-approval-table"
        :virtualScrollerOptions="useVirtualScroll ? {
          lazy: true,
          onLazyLoad: onVirtualLazyLoad,
          itemSize: 72,
          delay: 0,
          showLoader: false,
          loading: false,
          numToleratedItems: 12,
        } : null"
        @sort="onSort"
      >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No OT approval records found.
          </div>
        </template>

        <Column field="requestNo" header="Request No" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data" class="font-medium">{{ data.requestNo || '-' }}</span>
          </template>
        </Column>

        <Column header="Request Owner" style="min-width: 15rem">
          <template #body="{ data }">
            <div v-if="data">
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ formatRequester(data).name }}
              </div>
              <div class="text-xs text-[color:var(--ot-text-muted)]">
                {{ formatRequester(data).employeeNo }}
              </div>
            </div>
          </template>
        </Column>

        <Column header="Employees" style="min-width: 9rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="`${getEmployeeCount(data)} staff`"
              severity="info"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column field="otDate" header="OT Date" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.otDate || '-' }}</span>
          </template>
        </Column>

        <Column header="Time" style="min-width: 11rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatTimeRange(data) }}</span>
          </template>
        </Column>

        <Column field="totalHours" header="Hours" sortable style="min-width: 8rem">
          <template #body="{ data }">
            <span v-if="data">{{ data.totalHours ?? '-' }}</span>
          </template>
        </Column>

        <Column field="dayType" header="Day Type" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.dayType || '-'"
              :severity="dayTypeSeverity(data.dayType)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column field="status" header="Status" sortable style="min-width: 9rem">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.status || '-'"
              :severity="statusSeverity(data.status)"
              class="ot-status-tag"
            />
          </template>
        </Column>

        <Column header="Current Step" style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="data">{{ currentStepLabel(data) }}</span>
          </template>
        </Column>

        <Column field="createdAt" header="Created At" sortable style="min-width: 14rem">
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTime(data.createdAt) }}</span>
          </template>
        </Column>

        <Column header="Actions" style="width: 19rem; min-width: 19rem">
          <template #body="{ data }">
            <div v-if="data" class="flex flex-wrap gap-2">
              <Button
                label="View"
                icon="pi pi-eye"
                size="small"
                severity="secondary"
                outlined
                @click="openView(data)"
              />

              <Button
                v-if="canDecide(data)"
                label="Approve"
                icon="pi pi-check"
                size="small"
                @click="openDecision(data, 'APPROVE')"
              />

              <Button
                v-if="canDecide(data)"
                label="Reject"
                icon="pi pi-times"
                size="small"
                severity="danger"
                outlined
                @click="openDecision(data, 'REJECT')"
              />

              <span
                v-if="!canDecide(data)"
                class="inline-flex items-center text-xs font-medium text-[color:var(--ot-text-muted)]"
              >
                
              </span>
            </div>
          </template>
        </Column>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </div>

    <Dialog
      v-model:visible="decisionDialog.visible"
      modal
      :closable="!decisionDialog.loading"
      :style="{ width: '36rem', maxWidth: '94vw' }"
      :header="decisionDialog.action === 'APPROVE' ? 'Approve OT Request' : 'Reject OT Request'"
    >
      <div class="space-y-4">
        <div
          v-if="decisionDialog.row"
          class="rounded-xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)] px-4 py-3 text-sm"
        >
          <div class="font-semibold text-[color:var(--ot-text)]">
            {{ decisionDialog.row.requestNo }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            Request owner: {{ formatRequester(decisionDialog.row).name }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            OT date: {{ decisionDialog.row.otDate || '-' }} • {{ formatTimeRange(decisionDialog.row) }}
          </div>

          <div class="mt-1 text-[color:var(--ot-text-muted)]">
            Total hours: {{ decisionDialog.row.totalHours ?? '-' }}
          </div>

          <div class="mt-3">
            <div class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--ot-text-muted)]">
              Employees
            </div>

            <div class="flex flex-wrap gap-2">
              <Tag
                :value="`${getEmployeeCount(decisionDialog.row)} staff`"
                severity="info"
                class="ot-status-tag"
              />
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-[color:var(--ot-text)]">
            Remark
            <span v-if="decisionDialog.action === 'REJECT'" class="text-red-500">*</span>
          </label>
          <Textarea
            v-model.trim="decisionDialog.remark"
            rows="4"
            autoResize
            class="w-full"
            :placeholder="decisionDialog.action === 'APPROVE' ? 'Optional remark' : 'Please enter rejection reason'"
          />
        </div>

        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            text
            size="small"
            :disabled="decisionDialog.loading"
            @click="closeDecision"
          />
          <Button
            :label="decisionDialog.action === 'APPROVE' ? 'Approve' : 'Reject'"
            :icon="decisionDialog.action === 'APPROVE' ? 'pi pi-check' : 'pi pi-times'"
            :severity="decisionDialog.action === 'APPROVE' ? 'primary' : 'danger'"
            :loading="decisionDialog.loading"
            size="small"
            @click="submitDecision"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
:deep(.ot-approval-table .p-datatable-thead > tr > th) {
  padding: 0.72rem 0.9rem !important;
}

:deep(.ot-approval-table .p-datatable-tbody > tr > td) {
  padding: 0.62rem 0.8rem !important;
  height: 72px !important;
  vertical-align: middle !important;
}

:deep(.ot-approval-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>