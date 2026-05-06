<!-- frontend/src/modules/dashboard/components/OTDashboardWidget.vue -->
<script setup>
// frontend/src/modules/dashboard/components/OTDashboardWidget.vue

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import Button from 'primevue/button'
import Chart from 'primevue/chart'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'

import { getOTDashboardSummary } from '../dashboard.api'

const loading = ref(false)
const errorMessage = ref('')
const chartRenderKey = ref(0)
const chartsReady = ref(false)
const themeTick = ref(0)

let themeObserver = null
let bodyObserver = null

const summary = ref({
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  cancelled: 0,
  requesterDisagreed: 0,
  approvedRate: 0,
  pendingRate: 0,
  statusChart: {
    labels: [],
    data: [],
  },
  dayTypeChart: {
    labels: [],
    data: [],
  },
  monthlyTrend: {
    labels: [],
    data: [],
  },
})

const hasOTData = computed(() => Number(summary.value.total || 0) > 0)

const hasStatusData = computed(() => {
  return (summary.value.statusChart.data || []).some((value) => Number(value || 0) > 0)
})

const hasDayTypeData = computed(() => {
  return (summary.value.dayTypeChart.data || []).some((value) => Number(value || 0) > 0)
})

const hasMonthlyData = computed(() => {
  return (summary.value.monthlyTrend.data || []).some((value) => Number(value || 0) > 0)
})

function readCssVar(name, fallback = '') {
  const rootValue = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (rootValue) return rootValue

  const bodyValue = getComputedStyle(document.body).getPropertyValue(name).trim()
  if (bodyValue) return bodyValue

  return fallback
}

function isDarkTheme() {
  themeTick.value

  const root = document.documentElement
  const body = document.body

  return (
    root.classList.contains('dark') ||
    root.classList.contains('app-dark') ||
    body.classList.contains('dark') ||
    body.classList.contains('app-dark')
  )
}

const chartTheme = computed(() => {
  const dark = isDarkTheme()

  return {
    text: readCssVar('--ot-text', dark ? '#f8fafc' : '#0f172a'),
    mutedText: readCssVar('--ot-text-muted', dark ? '#94a3b8' : '#64748b'),
    surface: readCssVar('--ot-surface', dark ? '#0f172a' : '#ffffff'),
    grid: dark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.25)',
    pending: dark ? 'rgba(250, 204, 21, 0.9)' : 'rgba(234, 179, 8, 0.88)',
    approved: dark ? 'rgba(34, 197, 94, 0.9)' : 'rgba(22, 163, 74, 0.86)',
    rejected: dark ? 'rgba(248, 113, 113, 0.9)' : 'rgba(220, 38, 38, 0.82)',
    cancelled: dark ? 'rgba(148, 163, 184, 0.88)' : 'rgba(100, 116, 139, 0.72)',
    disagreed: dark ? 'rgba(251, 146, 60, 0.9)' : 'rgba(249, 115, 22, 0.82)',
    workingDay: dark ? 'rgba(56, 189, 248, 0.9)' : 'rgba(2, 132, 199, 0.86)',
    sunday: dark ? 'rgba(250, 204, 21, 0.9)' : 'rgba(234, 179, 8, 0.88)',
    holiday: dark ? 'rgba(248, 113, 113, 0.9)' : 'rgba(220, 38, 38, 0.82)',
    line: dark ? '#38bdf8' : '#0284c7',
    lineFill: dark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(14, 165, 233, 0.12)',
    point: dark ? '#7dd3fc' : '#0369a1',
    tooltipBg: dark ? '#020617' : '#0f172a',
    tooltipText: '#f8fafc',
  }
})

const statusColors = computed(() => {
  const theme = chartTheme.value

  return [
    theme.pending,
    theme.approved,
    theme.rejected,
    theme.cancelled,
    theme.disagreed,
  ]
})

const dayTypeColors = computed(() => {
  const theme = chartTheme.value

  return [
    theme.workingDay,
    theme.sunday,
    theme.holiday,
    theme.cancelled,
  ]
})

const statusChartData = computed(() => ({
  labels: summary.value.statusChart.labels,
  datasets: [
    {
      data: summary.value.statusChart.data,
      backgroundColor: statusColors.value,
      borderColor: chartTheme.value.surface,
      borderWidth: 3,
      hoverOffset: 8,
    },
  ],
}))

const dayTypeChartData = computed(() => ({
  labels: summary.value.dayTypeChart.labels,
  datasets: [
    {
      data: summary.value.dayTypeChart.data,
      backgroundColor: dayTypeColors.value,
      borderColor: chartTheme.value.surface,
      borderWidth: 3,
      hoverOffset: 8,
    },
  ],
}))

const monthlyChartData = computed(() => ({
  labels: summary.value.monthlyTrend.labels,
  datasets: [
    {
      label: 'OT Requests',
      data: summary.value.monthlyTrend.data,
      borderColor: chartTheme.value.line,
      backgroundColor: chartTheme.value.lineFill,
      pointBackgroundColor: chartTheme.value.point,
      pointBorderColor: chartTheme.value.surface,
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 3,
      tension: 0.35,
      fill: true,
    },
  ],
}))

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: chartTheme.value.text,
        usePointStyle: true,
        boxWidth: 8,
        padding: 14,
      },
    },
    tooltip: {
      backgroundColor: chartTheme.value.tooltipBg,
      titleColor: chartTheme.value.tooltipText,
      bodyColor: chartTheme.value.tooltipText,
      borderWidth: 0,
    },
  },
}))

const monthlyChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: chartTheme.value.tooltipBg,
      titleColor: chartTheme.value.tooltipText,
      bodyColor: chartTheme.value.tooltipText,
      borderWidth: 0,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: chartTheme.value.mutedText,
        maxRotation: 0,
      },
      border: {
        color: chartTheme.value.grid,
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        color: chartTheme.value.mutedText,
        precision: 0,
      },
      grid: {
        color: chartTheme.value.grid,
      },
      border: {
        color: chartTheme.value.grid,
      },
    },
  },
}))

async function rebuildCharts() {
  themeTick.value += 1
  chartsReady.value = false
  chartRenderKey.value += 1
  await nextTick()
  chartsReady.value = true
}

async function fetchSummary() {
  loading.value = true
  chartsReady.value = false
  errorMessage.value = ''

  try {
    const res = await getOTDashboardSummary()
    summary.value = res.data?.data || summary.value
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to load OT dashboard.'
  } finally {
    loading.value = false
    await rebuildCharts()
  }
}

onMounted(() => {
  fetchSummary()

  themeObserver = new MutationObserver(rebuildCharts)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })

  bodyObserver = new MutationObserver(rebuildCharts)
  bodyObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
  })
})

onBeforeUnmount(() => {
  if (themeObserver) themeObserver.disconnect()
  if (bodyObserver) bodyObserver.disconnect()
})
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-[color:var(--ot-border)] bg-[color:var(--ot-surface)]"
  >
    <div class="border-b border-[color:var(--ot-border)] px-3 py-3">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--ot-border)] text-primary"
          >
            <i class="pi pi-clock"></i>
          </div>

          <div>
            <h2 class="text-base font-semibold text-[color:var(--ot-text)]">
              Overtime Overview
            </h2>
            <p class="text-xs text-[color:var(--ot-text-muted)]">
              OT request status, day type, and monthly request trend
            </p>
          </div>
        </div>

        <Button
          icon="pi pi-refresh"
          label="Refresh"
          size="small"
          severity="secondary"
          outlined
          :loading="loading"
          @click="fetchSummary"
        />
      </div>
    </div>

    <div class="p-3">
      <div
        v-if="errorMessage"
        class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      >
        {{ errorMessage }}
      </div>

      <div class="grid gap-3 md:grid-cols-4">
        <div class="dashboard-stat-card">
          <p class="dashboard-stat-label">
            Total OT Requests
          </p>

          <Skeleton v-if="loading" width="5rem" height="2rem" class="mt-2" />

          <p v-else class="dashboard-stat-value">
            {{ summary.total }}
          </p>
        </div>

        <div class="dashboard-stat-card dashboard-stat-card-pending">
          <div class="flex items-center justify-between gap-2">
            <p class="dashboard-stat-label">
              Pending
            </p>

            <Tag severity="warning" :value="`${summary.pendingRate}%`" class="dashboard-mini-tag" />
          </div>

          <Skeleton v-if="loading" width="5rem" height="2rem" class="mt-2" />

          <p v-else class="dashboard-stat-value text-yellow-500">
            {{ summary.pending }}
          </p>
        </div>

        <div class="dashboard-stat-card dashboard-stat-card-approved">
          <div class="flex items-center justify-between gap-2">
            <p class="dashboard-stat-label">
              Approved
            </p>

            <Tag severity="success" :value="`${summary.approvedRate}%`" class="dashboard-mini-tag" />
          </div>

          <Skeleton v-if="loading" width="5rem" height="2rem" class="mt-2" />

          <p v-else class="dashboard-stat-value text-green-500">
            {{ summary.approved }}
          </p>
        </div>

        <div class="dashboard-stat-card">
          <p class="dashboard-stat-label">
            Rejected / Cancelled
          </p>

          <Skeleton v-if="loading" width="5rem" height="2rem" class="mt-2" />

          <p v-else class="dashboard-stat-value">
            {{ summary.rejected + summary.cancelled + summary.requesterDisagreed }}
          </p>
        </div>
      </div>

      <div class="mt-3 grid gap-3 xl:grid-cols-6">
        <div class="dashboard-chart-card xl:col-span-2">
          <div class="dashboard-chart-header">
            <h3>Status Breakdown</h3>
            <span>By request status</span>
          </div>

          <div class="dashboard-chart-box">
            <Skeleton v-if="loading" width="100%" height="100%" border-radius="1rem" />

            <Chart
              v-else-if="chartsReady && hasStatusData"
              :key="`ot-status-${chartRenderKey}`"
              type="doughnut"
              :data="statusChartData"
              :options="doughnutOptions"
              class="h-full"
            />

            <div v-else class="dashboard-chart-empty">
              No OT status data yet.
            </div>
          </div>
        </div>

        <div class="dashboard-chart-card xl:col-span-2">
          <div class="dashboard-chart-header">
            <h3>Day Type Breakdown</h3>
            <span>Working / Sunday / Holiday</span>
          </div>

          <div class="dashboard-chart-box">
            <Skeleton v-if="loading" width="100%" height="100%" border-radius="1rem" />

            <Chart
              v-else-if="chartsReady && hasDayTypeData"
              :key="`ot-day-type-${chartRenderKey}`"
              type="doughnut"
              :data="dayTypeChartData"
              :options="doughnutOptions"
              class="h-full"
            />

            <div v-else class="dashboard-chart-empty">
              No OT day type data yet.
            </div>
          </div>
        </div>

        <div class="dashboard-chart-card xl:col-span-2">
          <div class="dashboard-chart-header">
            <h3>Monthly Trend</h3>
            <span>Last 6 months</span>
          </div>

          <div class="dashboard-chart-box">
            <Skeleton v-if="loading" width="100%" height="100%" border-radius="1rem" />

            <Chart
              v-else-if="chartsReady && hasMonthlyData"
              :key="`ot-monthly-${chartRenderKey}`"
              type="line"
              :data="monthlyChartData"
              :options="monthlyChartOptions"
              class="h-full"
            />

            <div v-else class="dashboard-chart-empty">
              No new OT requests in the last 6 months.
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="hasOTData"
        class="mt-3 grid gap-3 md:grid-cols-4"
      >
        <div class="dashboard-mini-box">
          <span>Rejected</span>
          <strong>{{ summary.rejected }}</strong>
        </div>

        <div class="dashboard-mini-box">
          <span>Cancelled</span>
          <strong>{{ summary.cancelled }}</strong>
        </div>

        <div class="dashboard-mini-box">
          <span>Requester Disagreed</span>
          <strong>{{ summary.requesterDisagreed }}</strong>
        </div>

        <div class="dashboard-mini-box">
          <span>Active Workflow</span>
          <strong>{{ summary.pending }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-stat-card {
  border-radius: 1rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  padding: 1rem;
}

.dashboard-stat-card-pending {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, #eab308 12%, var(--ot-surface)),
      var(--ot-surface)
    );
}

.dashboard-stat-card-approved {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, #22c55e 12%, var(--ot-surface)),
      var(--ot-surface)
    );
}

.dashboard-stat-label {
  font-size: 0.75rem;
  color: var(--ot-text-muted);
}

.dashboard-stat-value {
  margin-top: 0.35rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--ot-text);
}

.dashboard-chart-card {
  border-radius: 1rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  padding: 1rem;
}

.dashboard-chart-header {
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.dashboard-chart-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ot-text);
}

.dashboard-chart-header span {
  font-size: 0.75rem;
  color: var(--ot-text-muted);
}

.dashboard-chart-box {
  height: 16rem;
}

.dashboard-chart-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  border: 1px dashed var(--ot-border);
  padding: 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--ot-text-muted);
}

.dashboard-mini-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: 0.85rem;
  border: 1px solid var(--ot-border);
  background: var(--ot-surface);
  padding: 0.75rem 0.9rem;
}

.dashboard-mini-box span {
  font-size: 0.75rem;
  color: var(--ot-text-muted);
}

.dashboard-mini-box strong {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ot-text);
}

:deep(.p-tag.dashboard-mini-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>