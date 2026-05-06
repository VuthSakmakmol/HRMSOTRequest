<!-- frontend/src/modules/dashboard/components/EmployeeDashboardWidget.vue -->
<script setup>
// frontend/src/modules/dashboard/components/EmployeeDashboardWidget.vue

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import Button from 'primevue/button'
import Chart from 'primevue/chart'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'

import { getEmployeeDashboardSummary } from '../dashboard.api'

const loading = ref(false)
const errorMessage = ref('')
const chartRenderKey = ref(0)
const chartsReady = ref(false)
const themeTick = ref(0)

let themeObserver = null
let bodyObserver = null

const summary = ref({
  total: 0,
  active: 0,
  inactive: 0,
  activeRate: 0,
  inactiveRate: 0,
  statusChart: {
    labels: ['Active', 'Inactive'],
    data: [0, 0],
  },
  monthlyTrend: {
    labels: [],
    data: [],
  },
})

const hasEmployeeData = computed(() => Number(summary.value.total || 0) > 0)

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
    active: dark ? 'rgba(20, 184, 166, 0.9)' : 'rgba(13, 148, 136, 0.86)',
    inactive: dark ? 'rgba(100, 116, 139, 0.88)' : 'rgba(100, 116, 139, 0.7)',
    line: dark ? '#2dd4bf' : '#0f766e',
    lineFill: dark ? 'rgba(45, 212, 191, 0.14)' : 'rgba(13, 148, 136, 0.12)',
    point: dark ? '#5eead4' : '#0f766e',
    tooltipBg: dark ? '#020617' : '#0f172a',
    tooltipText: '#f8fafc',
  }
})

const statusChartData = computed(() => ({
  labels: summary.value.statusChart.labels,
  datasets: [
    {
      data: summary.value.statusChart.data,
      backgroundColor: [chartTheme.value.active, chartTheme.value.inactive],
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
      label: 'New Employees',
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

const statusChartOptions = computed(() => ({
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
    const res = await getEmployeeDashboardSummary()
    summary.value = res.data?.data || summary.value
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      error?.message ||
      'Failed to load employee dashboard.'
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
            <i class="pi pi-users"></i>
          </div>

          <div>
            <h2 class="text-base font-semibold text-[color:var(--ot-text)]">
              Employee Overview
            </h2>
            <p class="text-xs text-[color:var(--ot-text-muted)]">
              Active status and monthly employee creation trend
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

      <div class="grid gap-3 md:grid-cols-3">
        <div class="dashboard-stat-card">
          <p class="dashboard-stat-label">
            Total Employees
          </p>

          <Skeleton v-if="loading" width="5rem" height="2rem" class="mt-2" />

          <p v-else class="dashboard-stat-value">
            {{ summary.total }}
          </p>
        </div>

        <div class="dashboard-stat-card dashboard-stat-card-active">
          <div class="flex items-center justify-between gap-2">
            <p class="dashboard-stat-label">
              Active
            </p>

            <Tag severity="success" :value="`${summary.activeRate}%`" class="dashboard-mini-tag" />
          </div>

          <Skeleton v-if="loading" width="5rem" height="2rem" class="mt-2" />

          <p v-else class="dashboard-stat-value text-teal-500">
            {{ summary.active }}
          </p>
        </div>

        <div class="dashboard-stat-card">
          <div class="flex items-center justify-between gap-2">
            <p class="dashboard-stat-label">
              Inactive
            </p>

            <Tag severity="secondary" :value="`${summary.inactiveRate}%`" class="dashboard-mini-tag" />
          </div>

          <Skeleton v-if="loading" width="5rem" height="2rem" class="mt-2" />

          <p v-else class="dashboard-stat-value">
            {{ summary.inactive }}
          </p>
        </div>
      </div>

      <div class="mt-3 grid gap-3 xl:grid-cols-5">
        <div class="dashboard-chart-card xl:col-span-2">
          <div class="dashboard-chart-header">
            <h3>Status Breakdown</h3>
            <span>Active vs inactive</span>
          </div>

          <div class="dashboard-chart-box">
            <Skeleton v-if="loading" width="100%" height="100%" border-radius="1rem" />

            <Chart
              v-else-if="chartsReady && hasEmployeeData"
              :key="`employee-status-${chartRenderKey}`"
              type="doughnut"
              :data="statusChartData"
              :options="statusChartOptions"
              class="h-full"
            />

            <div v-else class="dashboard-chart-empty">
              No employee data yet.
            </div>
          </div>
        </div>

        <div class="dashboard-chart-card xl:col-span-3">
          <div class="dashboard-chart-header">
            <h3>Monthly Trend</h3>
            <span>Last 6 months</span>
          </div>

          <div class="dashboard-chart-box">
            <Skeleton v-if="loading" width="100%" height="100%" border-radius="1rem" />

            <Chart
              v-else-if="chartsReady && hasMonthlyData"
              :key="`employee-monthly-${chartRenderKey}`"
              type="line"
              :data="monthlyChartData"
              :options="monthlyChartOptions"
              class="h-full"
            />

            <div v-else class="dashboard-chart-empty">
              No new employees in the last 6 months.
            </div>
          </div>
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

.dashboard-stat-card-active {
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, #14b8a6 10%, var(--ot-surface)),
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

:deep(.p-tag.dashboard-mini-tag) {
  min-height: 1.35rem !important;
  padding: 0.12rem 0.45rem !important;
  font-size: 0.7rem !important;
  font-weight: 600 !important;
  line-height: 1 !important;
  border-radius: 999px !important;
}
</style>