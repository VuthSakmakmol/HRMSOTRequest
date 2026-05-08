<!-- frontend/src/modules/ot/views/OTRequestListView.vue -->
<script setup>
// frontend/src/modules/ot/views/OTRequestListView.vue

import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import AppTableLoading from '@/shared/components/AppTableLoading.vue'

import { useAuthStore } from '@/modules/auth/auth.store'
import {
  getOTRequests,
  exportOTRequestsExcel,
} from '@/modules/ot/ot.api'

const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const PAGE_SIZE = 10
const SEARCH_DEBOUNCE_MS = 250

const rows = ref([])
const totalRecords = ref(0)
const loadedPages = ref(new Set())
const expandedRows = ref({})

const bootstrapped = ref(false)
const backgroundLoading = ref(false)
const exporting = ref(false)

const filters = reactive({
  search: '',
  status: '',
  dayType: '',
  otDateFrom: null,
  otDateTo: null,
})

const canCreateRequest = computed(() => auth.hasAnyPermission(['OT_REQUEST_CREATE']))
const canUpdateRequest = computed(() => auth.hasAnyPermission(['OT_REQUEST_UPDATE']))
const canVerifyAttendance = computed(() => auth.hasAnyPermission(['ATTENDANCE_VERIFY']))
const firstLoading = computed(() => {
  return backgroundLoading.value && !bootstrapped.value && !hasAnyData.value
})

const statusOptions = [
  { label: 'All Status', value: '' },
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

const totalRequests = computed(() => Number(totalRecords.value || 0))
const loadedCount = computed(() => rows.value.filter(Boolean).length)
const summaryText = computed(() => `${loadedCount.value} of ${totalRequests.value}`)

const hasAnyData = computed(() => rows.value.some(Boolean))
const useVirtualScroll = computed(() => totalRequests.value > PAGE_SIZE)

let searchTimer = null
let currentRequestId = 0

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizeItems(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}

function normalizeRow(row) {
  if (!row) return row

  return {
    ...row,
    id: String(row?.id || row?._id || '').trim(),
  }
}

function rowIdOf(row) {
  return String(row?.id || row?._id || '').trim()
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function upper(value) {
  return String(value || '').trim().toUpperCase()
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }

  return ''
}

function formatDateYMD(value) {
  if (!value) return undefined

  const raw = String(value || '').trim()

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) return raw

  const dmyMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatDateDMY(value) {
  if (!value) return '-'

  const raw = String(value || '').trim()

  const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return raw || '-'

  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`
}

function formatDateTimeDMY(value) {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value || '-')

  const dd = pad2(date.getDate())
  const mm = pad2(date.getMonth() + 1)
  const yyyy = date.getFullYear()
  const hh = pad2(date.getHours())
  const min = pad2(date.getMinutes())

  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
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
  }
}

function buildExportQuery() {
  return {
    search: String(filters.search || '').trim() || undefined,
    status: filters.status || undefined,
    dayType: filters.dayType || undefined,
    otDateFrom: formatDateYMD(filters.otDateFrom),
    otDateTo: formatDateYMD(filters.otDateTo),
  }
}

function normalizeClassKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

function dayTypeClass(value) {
  return `ot-day-${normalizeClassKey(value || 'unknown')}`
}

function statusSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'APPROVED') return 'success'
  if (normalized === 'REJECTED') return 'danger'
  if (normalized === 'CANCELLED') return 'contrast'
  if (normalized === 'PENDING') return 'warning'

  return 'secondary'
}

function dayTypeSeverity(value) {
  const normalized = upper(value)

  if (normalized === 'HOLIDAY') return 'danger'
  if (normalized === 'SUNDAY') return 'warning'
  if (normalized === 'WORKING_DAY') return 'success'

  return 'secondary'
}

function formatTimeRange(row) {
  const start = String(row?.requestStartTime || row?.startTime || '').trim()
  const end = String(row?.requestEndTime || row?.endTime || '').trim()

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

function canEdit(row) {
  return canUpdateRequest.value && !!row?.canEdit
}

function approvalDisplay(row) {
  const display = row?.approvalDisplay || {
    type: row?.approvalDisplayType || row?.status || 'UNKNOWN',
    label: row?.approvalDisplayLabel || row?.status || '-',
    subLabel: row?.approvalDisplaySubLabel || '',
    severity: row?.approvalDisplaySeverity || statusSeverity(row?.status),
  }

  const type = upper(display.type)
  const status = upper(row?.status)

  // Old requester-confirmation workflow is removed from UI.
  if (type === 'REQUESTER_CONFIRMATION' || status === 'PENDING_REQUESTER_CONFIRMATION') {
    return {
      ...display,
      type: 'WAITING',
      label: 'Pending',
      subLabel: '',
      severity: 'warning',
    }
  }

  if (type === 'REQUESTER_DISAGREED' || status === 'REQUESTER_DISAGREED') {
    return {
      ...display,
      type: 'REJECTED',
      label: 'Rejected',
      subLabel: '',
      severity: 'danger',
    }
  }

  return display
}

function approvalDisplayClass(row) {
  return `ot-approval-${normalizeClassKey(approvalDisplay(row).type || 'unknown')}`
}

function approvalDisplaySeverity(row) {
  const display = approvalDisplay(row)
  const severity = display.severity

  if (severity) return severity

  const type = upper(display.type)

  if (type === 'APPROVED') return 'success'
  if (type === 'REJECTED') return 'danger'
  if (type === 'WAITING') return 'warning'
  if (type === 'CANCELLED') return 'secondary'

  return 'secondary'
}

function getTargetEmployees(row) {
  if (Array.isArray(row?.employees)) return row.employees
  if (Array.isArray(row?.approvedEmployees)) return row.approvedEmployees
  if (Array.isArray(row?.requestedEmployees)) return row.requestedEmployees
  if (Array.isArray(row?.employeeItems)) return row.employeeItems
  if (Array.isArray(row?.targetEmployees)) return row.targetEmployees
  if (Array.isArray(row?.employeeList)) return row.employeeList

  return []
}

function getEmployeeCount(row) {
  const explicitCount = Number(
    row?.employeeCount ||
      row?.approvedEmployeeCount ||
      row?.requestedEmployeeCount ||
      row?.totalEmployees ||
      0,
  )

  if (explicitCount > 0) return explicitCount

  return getTargetEmployees(row).length
}

function employeeIdOf(employee) {
  return String(employee?.employeeId || employee?._id || employee?.id || '').trim()
}

function employeeNameOf(employee) {
  return String(
    employee?.employeeName ||
      employee?.displayName ||
      employee?.name ||
      employee?.fullName ||
      '-',
  ).trim() || '-'
}

function employeeCodeOf(employee) {
  return String(
    employee?.employeeCode ||
      employee?.employeeNo ||
      employee?.code ||
      employee?.loginId ||
      '-',
  ).trim() || '-'
}

function employeePositionOf(employee) {
  return String(
    employee?.positionName ||
      employee?.position?.name ||
      employee?.positionTitle ||
      '-',
  ).trim() || '-'
}

function employeeLineOf(employee, row = null) {
  const directLabel = firstText(
    employee?.lineLabel,
    employee?.productionLineLabel,
    employee?.employeeLineLabel,
    employee?.assignedLineLabel,
    employee?.lineDisplay,
    employee?.productionLineDisplay,
    employee?.lineText,
  )

  if (directLabel) return directLabel

  const code = firstText(
    employee?.lineCode,
    employee?.productionLineCode,
    employee?.employeeLineCode,
    employee?.assignedLineCode,
    employee?.line?.code,
    employee?.line?.lineCode,
    employee?.productionLine?.code,
    employee?.productionLine?.lineCode,
    employee?.productionLineId?.code,
    employee?.productionLineId?.lineCode,
    employee?.lineId?.code,
    employee?.lineId?.lineCode,
    row?.lineCode,
    row?.productionLineCode,
    row?.line?.code,
    row?.productionLine?.code,
  )

  const name = firstText(
    employee?.lineName,
    employee?.productionLineName,
    employee?.employeeLineName,
    employee?.assignedLineName,
    employee?.line?.name,
    employee?.line?.lineName,
    employee?.productionLine?.name,
    employee?.productionLine?.lineName,
    employee?.productionLineId?.name,
    employee?.productionLineId?.lineName,
    employee?.lineId?.name,
    employee?.lineId?.lineName,
    row?.lineName,
    row?.productionLineName,
    row?.line?.name,
    row?.productionLine?.name,
  )

  if (code && name) return `${code} · ${name}`
  if (code) return code
  if (name) return name

  const fallback = firstText(
    employee?.lineNo,
    employee?.lineNumber,
    employee?.productionLineNo,
    employee?.productionLineNumber,
    employee?.line,
    employee?.productionLine,
  )

  return fallback
}

function employeeOtTimeOf(employee, row) {
  const employeeStart = String(
    employee?.requestStartTime ||
      employee?.startTime ||
      employee?.otStartTime ||
      employee?.approvedStartTime ||
      '',
  ).trim()

  const employeeEnd = String(
    employee?.requestEndTime ||
      employee?.endTime ||
      employee?.otEndTime ||
      employee?.approvedEndTime ||
      '',
  ).trim()

  if (employeeStart || employeeEnd) {
    return [employeeStart, employeeEnd].filter(Boolean).join(' - ')
  }

  return formatTimeRange(row)
}

async function fetchPage(page, { replace = false, silent = false } = {}) {
  if (!replace && loadedPages.value.has(page)) return

  const requestId = ++currentRequestId

  if (silent) {
    backgroundLoading.value = true
  }

  try {
    const res = await getOTRequests(buildQuery(page))
    if (requestId !== currentRequestId) return

    const payload = normalizePayload(res)
    const items = normalizeItems(payload).map(normalizeRow)
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
        'Failed to load OT requests',
      life: 3000,
    })
  } finally {
    backgroundLoading.value = false
  }
}

async function reloadFirstPage({ keepVisible = true, resetExpanded = false } = {}) {
  if (resetExpanded) {
    expandedRows.value = {}
  }

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
    reloadFirstPage({ keepVisible: true, resetExpanded: true })
  }, SEARCH_DEBOUNCE_MS)
}

function onSearchInput() {
  runSearchSoon()
}

function onStatusChange() {
  reloadFirstPage({ keepVisible: true, resetExpanded: true })
}

function onDayTypeChange() {
  reloadFirstPage({ keepVisible: true, resetExpanded: true })
}

function onDateChange() {
  reloadFirstPage({ keepVisible: true, resetExpanded: true })
}

function clearFilters() {
  filters.search = ''
  filters.status = ''
  filters.dayType = ''
  filters.otDateFrom = null
  filters.otDateTo = null

  reloadFirstPage({ keepVisible: true, resetExpanded: true })
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

function goCreate() {
  if (!canCreateRequest.value) return

  router.push('/ot/requests/create')
}

function goEdit(id) {
  if (!id || !canUpdateRequest.value) return

  router.push(`/ot/requests/${id}/edit`)
}

function goVerifyAttendance(id) {
  if (!id || !canVerifyAttendance.value) return

  router.push(`/attendance/ot-verification/${id}`)
}

function getExportFilenameFromHeaders(headers = {}) {
  const disposition =
    headers?.['content-disposition'] || headers?.['Content-Disposition'] || ''
  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)"?/i)

  if (!match?.[1]) return 'ot-requests.xlsx'

  return decodeURIComponent(match[1]).replace(/[/\\?%*:|"<>]/g, '_')
}

async function onExportExcel() {
  if (exporting.value) return

  exporting.value = true

  try {
    const res = await exportOTRequestsExcel(buildExportQuery())

    const blob = new Blob(
      [
        res?.data instanceof Blob
          ? res.data
          : new Uint8Array(res?.data || []),
      ],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    )

    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = getExportFilenameFromHeaders(res?.headers || {})

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.URL.revokeObjectURL(url)

    toast.add({
      severity: 'success',
      summary: 'Export ready',
      detail: 'Excel file downloaded successfully.',
      life: 2500,
    })
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail:
        error?.response?.data?.message ||
        error?.message ||
        'Failed to export Excel file',
      life: 3000,
    })
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  reloadFirstPage({ keepVisible: false, resetExpanded: true })
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          label="Export Excel"
          icon="pi pi-file-excel"
          severity="success"
          outlined
          size="small"
          :loading="exporting"
          @click="onExportExcel"
        />

        <Button
          v-if="canCreateRequest"
          label="New OT Request"
          icon="pi pi-plus"
          size="small"
          @click="goCreate"
        />
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]">
      <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
        <div class="flex flex-col gap-2 xl:flex-row xl:items-center">
          <IconField class="w-full xl:w-[190px] xl:shrink-0">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="filters.search"
              placeholder="Search"
              class="w-full"
              size="small"
              @input="onSearchInput"
            />
          </IconField>

          <div class="w-full xl:w-[165px] xl:shrink-0">
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

          <div class="w-full xl:w-[170px] xl:shrink-0">
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

          <div class="w-full xl:w-[175px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateFrom"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
              class="w-full"
              inputClass="w-full"
              placeholder="OT Date From"
              @date-select="onDateChange"
              @clear-click="onDateChange"
            />
          </div>

          <div class="w-full xl:w-[175px] xl:shrink-0">
            <DatePicker
              v-model="filters.otDateTo"
              dateFormat="dd/mm/yy"
              showIcon
              showButtonBar
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
      

      <AppTableLoading
          v-if="firstLoading"
          title="Loading OT requests"
          message="Fetching OT request records..."
          :rows="8"
          :columns="9"
        />

        <DataTable
          v-else
          v-model:expandedRows="expandedRows"
          :value="rows"
          dataKey="id"
          lazy
          scrollable
          scrollHeight="500px"
          tableStyle="width: max-content; min-width: 100%; table-layout: auto;"
          class="ot-request-table"
          :virtualScrollerOptions="useVirtualScroll ? {
            lazy: true,
            onLazyLoad: onVirtualLazyLoad,
            itemSize: 64,
            delay: 0,
            showLoader: false,
            loading: false,
            numToleratedItems: 12,
          } : null"
        >
        <template #empty>
          <div
            v-if="bootstrapped"
            class="py-10 text-center text-sm text-[color:var(--ot-text-muted)]"
          >
            No OT requests found.
          </div>
        </template>

        <Column expander />

        <Column
          field="requestNo"
          header="Request No"
        >
          <template #body="{ data }">
            <span
              v-if="data"
              class="font-medium"
            >
              {{ data.requestNo || '-' }}
            </span>
          </template>
        </Column>

        <Column header="Requester">
          <template #body="{ data }">
            <div
              v-if="data"
              class="requester-cell"
            >
              <div class="font-medium text-[color:var(--ot-text)]">
                {{ formatRequester(data).name }}
              </div>

              <div class="text-xs text-[color:var(--ot-text-muted)]">
                {{ formatRequester(data).employeeNo }}
              </div>
            </div>
          </template>
        </Column>

        <Column
          field="status"
          header="Approval Status"
        >
          <template #body="{ data }">
            <div
              v-if="data"
              class="approval-status-cell"
            >
              <Tag
                :value="approvalDisplay(data).label"
                :severity="approvalDisplaySeverity(data)"
                class="ot-status-tag approval-display-tag"
                :class="approvalDisplayClass(data)"
              />
            </div>
          </template>
        </Column>

        <Column header="Staff">
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="`${getEmployeeCount(data)} staff`"
              severity="info"
              class="ot-status-tag ot-count-approved"
            />
          </template>
        </Column>

        <Column
          field="otDate"
          header="OT Date"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatDateDMY(data.otDate) }}</span>
          </template>
        </Column>

        <Column header="OT Time">
          <template #body="{ data }">
            <span v-if="data">{{ formatTimeRange(data) }}</span>
          </template>
        </Column>

        <Column
          field="dayType"
          header="Day Type"
        >
          <template #body="{ data }">
            <Tag
              v-if="data"
              :value="data.dayType || '-'"
              :severity="dayTypeSeverity(data.dayType)"
              class="ot-status-tag"
              :class="dayTypeClass(data.dayType)"
            />
          </template>
        </Column>

        <Column
          field="createdAt"
          header="Created At"
        >
          <template #body="{ data }">
            <span v-if="data">{{ formatDateTimeDMY(data.createdAt) }}</span>
          </template>
        </Column>

        <Column header="Actions">
          <template #body="{ data }">
            <div
              v-if="data"
              class="action-cell"
            >
              <Button
                v-if="canVerifyAttendance"
                label="Verify"
                icon="pi pi-check-square"
                size="small"
                severity="success"
                outlined
                @click="goVerifyAttendance(data._id || data.id)"
              />

              <Button
                v-if="canEdit(data)"
                label="Edit"
                icon="pi pi-pencil"
                size="small"
                severity="warning"
                outlined
                @click="goEdit(data._id || data.id)"
              />
            </div>
          </template>
        </Column>

        <template #expansion="{ data }">
          <div class="ot-expanded-box">
            <div
              v-if="getTargetEmployees(data).length"
              class="ot-expanded-content"
            >
              <div class="ot-expanded-responsive-table">
                <div class="ot-expanded-grid-row is-head">
                  <div>No</div>
                  <div>ID</div>
                  <div>Name</div>
                  <div>Position</div>
                  <div>OT Time</div>
                  <div>Line</div>
                </div>

                <div
                  v-for="(employee, index) in getTargetEmployees(data)"
                  :key="employeeIdOf(employee) || index"
                  class="ot-expanded-grid-row"
                >
                  <div class="cell-center">
                    {{ index + 1 }}
                  </div>

                  <div class="cell-mono cell-wrap">
                    {{ employeeCodeOf(employee) }}
                  </div>

                  <div class="cell-strong cell-wrap">
                    {{ employeeNameOf(employee) }}
                  </div>

                  <div class="cell-wrap">
                    {{ employeePositionOf(employee) }}
                  </div>

                  <div class="cell-center cell-mono cell-wrap">
                    {{ employeeOtTimeOf(employee, data) }}
                  </div>

                  <div class="cell-center cell-wrap">
                    {{ employeeLineOf(employee, data) || '-' }}
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="ot-expanded-empty">
              No employee data found for this request.
            </div>
          </div>
        </template>
      </DataTable>

      <div
        v-if="backgroundLoading && hasAnyData"
        class="flex items-center justify-center border-t border-[color:var(--ot-border)] px-3 py-2 text-xs text-[color:var(--ot-text-muted)]"
      >
        Updating...
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.ot-request-table .p-datatable-table) {
  width: max-content !important;
  min-width: 100% !important;
  table-layout: auto !important;
}

:deep(.ot-request-table .p-datatable-thead > tr > th) {
  padding: 0.62rem 0.75rem !important;
  white-space: nowrap !important;
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
}

:deep(.ot-request-table .p-datatable-tbody > tr > td) {
  padding: 0.55rem 0.75rem !important;
  height: 64px !important;
  vertical-align: middle !important;
  white-space: nowrap !important;
  width: auto !important;
  min-width: auto !important;
  max-width: none !important;
}

:deep(.ot-request-table .p-sortable-column-icon),
:deep(.ot-request-table .p-column-header-content .p-icon),
:deep(.ot-request-table .p-datatable-sort-icon) {
  display: none !important;
}

:deep(.ot-request-table .p-row-toggler) {
  width: 1.75rem !important;
  height: 1.75rem !important;
}

.requester-cell {
  min-width: max-content;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.approval-status-cell {
  display: flex;
  align-items: center;
  min-width: 0;
}

:deep(.ot-request-table .p-button.p-button-sm) {
  padding: 0.34rem 0.58rem !important;
  font-size: 0.78rem !important;
}

:deep(.ot-request-table .p-button.p-button-sm .p-button-icon) {
  font-size: 0.78rem !important;
}

:deep(.ot-request-table .p-tag.ot-status-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.48rem !important;
  font-size: 0.7rem !important;
  font-weight: 500 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
  border: 1px solid transparent !important;
  white-space: nowrap !important;
}

:deep(.p-tag.approval-display-tag) {
  max-width: 15rem;
}

:deep(.p-tag.approval-display-tag .p-tag-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Expanded employee area */
:deep(.ot-request-table .p-datatable-row-expansion > td) {
  height: auto !important;
  padding: 0 !important;
  white-space: normal !important;
  overflow: hidden !important;
}

.ot-expanded-box {
  position: sticky;
  left: 0;
  width: min(100%, 980px);
  max-width: none;
  overflow: visible;
  border-top: 1px solid var(--ot-border);
  border-bottom: 1px solid var(--ot-border);
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.05), transparent),
    var(--ot-bg);
  padding: 0.75rem;
}

.ot-expanded-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.55rem;
}

.ot-expanded-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ot-text);
}

.ot-expanded-subtitle {
  margin-top: 0.08rem;
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

.ot-expanded-content {
  width: 100%;
  max-width: none;
  overflow: visible;
}

.ot-expanded-responsive-table {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--ot-border);
  border-radius: 0.85rem;
  background: var(--ot-surface);
}

.ot-expanded-grid-row {
  display: grid;
  grid-template-columns:
    2.7rem
    minmax(4.8rem, 0.55fr)
    minmax(8rem, 1.1fr)
    minmax(7rem, 0.85fr)
    minmax(6.4rem, 0.65fr)
    minmax(4.8rem, 0.55fr);
  align-items: stretch;
}

.ot-expanded-grid-row > div {
  min-width: 0;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--ot-border);
  padding: 0.46rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--ot-text);
  line-height: 1.28;
}

.ot-expanded-grid-row.is-head > div {
  background: color-mix(in srgb, var(--ot-bg) 82%, transparent);
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--ot-text-muted);
  white-space: nowrap;
}

.ot-expanded-grid-row:last-child > div {
  border-bottom: 0;
}

.ot-expanded-grid-row:not(.is-head):hover > div {
  background: color-mix(in srgb, var(--ot-bg) 68%, transparent);
}

.cell-center {
  justify-content: center;
  text-align: center;
}

.cell-mono {
  font-variant-numeric: tabular-nums;
}

.cell-strong {
  font-weight: 600 !important;
}

.cell-wrap {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ot-expanded-empty {
  border: 1px dashed var(--ot-border);
  border-radius: 0.75rem;
  padding: 0.85rem;
  text-align: center;
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--ot-text-muted);
}

/* Count colors */
:deep(.p-tag.ot-count-approved) {
  background: #e0f2fe !important;
  color: #075985 !important;
  border-color: #38bdf8 !important;
}

/* Status colors */
:deep(.p-tag.ot-status-pending),
:deep(.p-tag.ot-approval-waiting) {
  background: #fef3c7 !important;
  color: #92400e !important;
  border-color: #f59e0b !important;
}

:deep(.p-tag.ot-status-approved),
:deep(.p-tag.ot-approval-approved) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-status-rejected),
:deep(.p-tag.ot-approval-rejected) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

:deep(.p-tag.ot-status-cancelled),
:deep(.p-tag.ot-approval-cancelled) {
  background: #e5e7eb !important;
  color: #374151 !important;
  border-color: #9ca3af !important;
}

/* Day type colors */
:deep(.p-tag.ot-day-working-day) {
  background: #dcfce7 !important;
  color: #166534 !important;
  border-color: #22c55e !important;
}

:deep(.p-tag.ot-day-sunday) {
  background: #ffedd5 !important;
  color: #9a3412 !important;
  border-color: #f97316 !important;
}

:deep(.p-tag.ot-day-holiday) {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border-color: #ef4444 !important;
}

/* Dark mode */
:global(.dark) :deep(.p-tag.ot-status-pending),
:global(.dark) :deep(.p-tag.ot-approval-waiting) {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-approved),
:global(.dark) :deep(.p-tag.ot-approval-approved) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-rejected),
:global(.dark) :deep(.p-tag.ot-approval-rejected) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-status-cancelled),
:global(.dark) :deep(.p-tag.ot-approval-cancelled) {
  background: rgba(148, 163, 184, 0.18) !important;
  color: #cbd5e1 !important;
  border-color: rgba(148, 163, 184, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-working-day) {
  background: rgba(34, 197, 94, 0.18) !important;
  color: #86efac !important;
  border-color: rgba(34, 197, 94, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-sunday) {
  background: rgba(249, 115, 22, 0.18) !important;
  color: #fdba74 !important;
  border-color: rgba(249, 115, 22, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-day-holiday) {
  background: rgba(239, 68, 68, 0.18) !important;
  color: #fca5a5 !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

:global(.dark) :deep(.p-tag.ot-count-approved) {
  background: rgba(14, 165, 233, 0.18) !important;
  color: #7dd3fc !important;
  border-color: rgba(14, 165, 233, 0.45) !important;
}

@media (max-width: 1200px) {
  .ot-expanded-box {
    width: min(100%, 900px);
  }

  .ot-expanded-grid-row {
    grid-template-columns:
      2.5rem
      minmax(4.5rem, 0.52fr)
      minmax(7rem, 1fr)
      minmax(6.5rem, 0.75fr)
      minmax(6rem, 0.62fr)
      minmax(4.5rem, 0.5fr);
  }

  .ot-expanded-grid-row > div {
    padding: 0.42rem 0.46rem;
    font-size: 0.68rem;
  }
}

@media (max-width: 768px) {
  .ot-expanded-header {
    flex-direction: column;
    align-items: stretch;
  }

  .ot-expanded-box {
    width: max-content;
    min-width: 760px;
    max-width: none;
    padding: 0.6rem;
  }

  .ot-expanded-content {
    width: max-content;
    min-width: 760px;
    max-width: none;
    overflow: visible;
  }

  .ot-expanded-responsive-table {
    width: max-content;
    min-width: 760px;
    max-width: none;
    overflow: visible;
  }

  .ot-expanded-grid-row {
    grid-template-columns:
      2.4rem
      5.8rem
      8.8rem
      8.2rem
      7.4rem
      10rem;
  }

  .ot-expanded-grid-row > div {
    padding: 0.42rem 0.5rem;
    font-size: 0.68rem;
    line-height: 1.25;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.64rem;
  }

  .cell-wrap {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}

@media (max-width: 420px) {
  .ot-expanded-box {
    width: max-content;
    min-width: 760px;
    max-width: none;
    padding: 0.55rem;
  }

  .ot-expanded-content {
    width: max-content;
    min-width: 760px;
    max-width: none;
  }

  .ot-expanded-responsive-table {
    width: max-content;
    min-width: 760px;
    max-width: none;
  }

  .ot-expanded-grid-row {
    grid-template-columns:
      2.3rem
      5.6rem
      8.5rem
      8rem
      7.2rem
      10rem;
  }

  .ot-expanded-grid-row > div {
    padding: 0.4rem 0.46rem;
    font-size: 0.66rem;
    line-height: 1.25;
  }

  .ot-expanded-grid-row.is-head > div {
    font-size: 0.62rem;
  }
}
</style>