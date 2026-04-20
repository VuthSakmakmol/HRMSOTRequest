<!-- frontend/src/modules/shift/views/ShiftListView.vue -->
<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import InputSwitch from 'primevue/inputswitch'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'

import {
  createShift,
  getShifts,
  updateShift,
} from '../shift.api'
import { useAuthStore } from '@/modules/auth/auth.store'

const toast = useToast()
const authStore = useAuthStore()

const loading = ref(false)
const submitting = ref(false)
const items = ref([])
const totalRecords = ref(0)

const filters = reactive({
  search: '',
  type: '',
  isActive: '',
})

const pagination = reactive({
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc',
})

const dialogVisible = ref(false)
const dialogMode = ref('create')
const editingId = ref('')

const form = reactive({
  code: '',
  name: '',
  type: 'DAY',
  startTime: '',
  breakStartTime: '',
  breakEndTime: '',
  endTime: '',
  isActive: true,
})

const typeOptions = [
  { label: 'All Types', value: '' },
  { label: 'Day', value: 'DAY' },
  { label: 'Night', value: 'NIGHT' },
]

const statusOptions = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
]

const shiftTypeOptions = [
  { label: 'Day', value: 'DAY' },
  { label: 'Night', value: 'NIGHT' },
]

const canView = computed(() =>
  authStore.user?.isRootAdmin ||
  authStore.user?.effectivePermissionCodes?.includes('SHIFT_VIEW')
)

const canCreate = computed(() =>
  authStore.user?.isRootAdmin ||
  authStore.user?.effectivePermissionCodes?.includes('SHIFT_CREATE')
)

const canUpdate = computed(() =>
  authStore.user?.isRootAdmin ||
  authStore.user?.effectivePermissionCodes?.includes('SHIFT_UPDATE')
)

const first = computed(() => (pagination.page - 1) * pagination.limit)

function resetForm() {
  form.code = ''
  form.name = ''
  form.type = 'DAY'
  form.startTime = ''
  form.breakStartTime = ''
  form.breakEndTime = ''
  form.endTime = ''
  form.isActive = true
  editingId.value = ''
}

function openCreateDialog() {
  resetForm()
  dialogMode.value = 'create'
  dialogVisible.value = true
}

function openEditDialog(row) {
  form.code = row.code || ''
  form.name = row.name || ''
  form.type = row.type || 'DAY'
  form.startTime = row.startTime || ''
  form.breakStartTime = row.breakStartTime || ''
  form.breakEndTime = row.breakEndTime || ''
  form.endTime = row.endTime || ''
  form.isActive = !!row.isActive
  editingId.value = row._id
  dialogMode.value = 'edit'
  dialogVisible.value = true
}

function onPage(event) {
  pagination.page = Math.floor(event.first / event.rows) + 1
  pagination.limit = event.rows
  fetchShifts()
}

function clearFilters() {
  filters.search = ''
  filters.type = ''
  filters.isActive = ''
  pagination.page = 1
  fetchShifts()
}

async function fetchShifts() {
  if (!canView.value) return

  loading.value = true
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: filters.search || undefined,
      type: filters.type || undefined,
      isActive: filters.isActive === '' ? undefined : filters.isActive,
      sortBy: pagination.sortBy,
      sortOrder: pagination.sortOrder,
    }

    const { data } = await getShifts(params)
    items.value = data?.data?.items || []
    totalRecords.value = data?.data?.pagination?.total || 0
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error?.response?.data?.message || 'Failed to load shifts',
      life: 3000,
    })
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  submitting.value = true
  try {
    const payload = {
      code: form.code,
      name: form.name,
      type: form.type,
      startTime: form.startTime,
      breakStartTime: form.breakStartTime,
      breakEndTime: form.breakEndTime,
      endTime: form.endTime,
      isActive: form.isActive,
    }

    if (dialogMode.value === 'create') {
      await createShift(payload)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Shift created successfully',
        life: 3000,
      })
    } else {
      await updateShift(editingId.value, payload)
      toast.add({
        severity: 'success',
        summary: 'Success',
        detail: 'Shift updated successfully',
        life: 3000,
      })
    }

    dialogVisible.value = false
    resetForm()
    fetchShifts()
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: error?.response?.data?.message || 'Failed to save shift',
      life: 3500,
    })
  } finally {
    submitting.value = false
  }
}

function statusSeverity(value) {
  return value ? 'success' : 'danger'
}

function typeSeverity(value) {
  return value === 'NIGHT' ? 'warning' : 'info'
}

watch(
  () => [filters.type, filters.isActive],
  () => {
    pagination.page = 1
    fetchShifts()
  },
)

let searchTimer = null
watch(
  () => filters.search,
  () => {
    pagination.page = 1
    clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      fetchShifts()
    }, 400)
  },
)

onMounted(() => {
  fetchShifts()
})
</script>

<template>
  <div class="space-y-6">
    <Toast />

    <section
      class="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm dark:border-surface-800 dark:bg-surface-900"
    >
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Shift Management
          </div>
          <h1 class="mt-1 text-2xl font-bold text-surface-900 dark:text-surface-0">
            Shift Master
          </h1>
          <p class="mt-2 text-sm text-surface-600 dark:text-surface-300">
            Manage shift definitions for later employee assignment.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button
            icon="pi pi-refresh"
            label="Refresh"
            severity="secondary"
            outlined
            @click="fetchShifts"
          />
          <Button
            v-if="canCreate"
            icon="pi pi-plus"
            label="New Shift"
            @click="openCreateDialog"
          />
        </div>
      </div>
    </section>

    <Card class="rounded-3xl border border-surface-200 shadow-sm dark:border-surface-800">
      <template #content>
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <span class="p-input-icon-left">
              <i class="pi pi-search" />
              <InputText
                v-model="filters.search"
                placeholder="Search code or name"
                class="w-full"
              />
            </span>

            <Dropdown
              v-model="filters.type"
              :options="typeOptions"
              option-label="label"
              option-value="value"
              placeholder="Filter by type"
              class="w-full"
            />

            <Dropdown
              v-model="filters.isActive"
              :options="statusOptions"
              option-label="label"
              option-value="value"
              placeholder="Filter by status"
              class="w-full"
            />

            <Button
              icon="pi pi-filter-slash"
              label="Clear"
              severity="secondary"
              outlined
              class="w-full"
              @click="clearFilters"
            />
          </div>

          <DataTable
            :value="items"
            :loading="loading"
            :lazy="true"
            paginator
            :rows="pagination.limit"
            :total-records="totalRecords"
            :first="first"
            responsive-layout="scroll"
            striped-rows
            show-gridlines
            class="p-datatable-sm"
            @page="onPage"
          >
            <template #empty>
              <div class="py-8 text-center text-sm text-surface-500 dark:text-surface-400">
                No shifts found.
              </div>
            </template>

            <Column field="code" header="Shift Code" style="min-width: 10rem" />
            <Column field="name" header="Shift Name" style="min-width: 14rem" />

            <Column header="Type" style="min-width: 8rem">
              <template #body="{ data }">
                <Tag :value="data.type" :severity="typeSeverity(data.type)" />
              </template>
            </Column>

            <Column field="startTime" header="Start" style="min-width: 8rem" />
            <Column field="breakStartTime" header="Break Start" style="min-width: 9rem" />
            <Column field="breakEndTime" header="Break End" style="min-width: 9rem" />
            <Column field="endTime" header="End" style="min-width: 8rem" />

            <Column header="Cross Night" style="min-width: 9rem">
              <template #body="{ data }">
                <Tag
                  :value="data.crossMidnight ? 'Yes' : 'No'"
                  :severity="data.crossMidnight ? 'warning' : 'contrast'"
                />
              </template>
            </Column>

            <Column header="Status" style="min-width: 8rem">
              <template #body="{ data }">
                <Tag
                  :value="data.isActive ? 'Active' : 'Inactive'"
                  :severity="statusSeverity(data.isActive)"
                />
              </template>
            </Column>

            <Column header="Actions" style="min-width: 9rem">
              <template #body="{ data }">
                <div class="flex gap-2">
                  <Button
                    v-if="canUpdate"
                    icon="pi pi-pencil"
                    severity="secondary"
                    text
                    rounded
                    @click="openEditDialog(data)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogVisible"
      :header="dialogMode === 'create' ? 'Create Shift' : 'Edit Shift'"
      modal
      :style="{ width: '52rem', maxWidth: '95vw' }"
      :draggable="false"
    >
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Shift Code</label>
          <InputText v-model="form.code" placeholder="OFFICE" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Shift Name</label>
          <InputText v-model="form.name" placeholder="Office Shift" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Shift Type</label>
          <Dropdown
            v-model="form.type"
            :options="shiftTypeOptions"
            option-label="label"
            option-value="value"
            placeholder="Select type"
          />
        </div>

        <div class="flex items-end gap-3 rounded-2xl border border-surface-200 px-4 py-3 dark:border-surface-700">
          <InputSwitch v-model="form.isActive" />
          <span class="text-sm font-medium">Active</span>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Start Time</label>
          <InputText v-model="form.startTime" placeholder="08:00" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Break Start</label>
          <InputText v-model="form.breakStartTime" placeholder="12:00" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Break End</label>
          <InputText v-model="form.breakEndTime" placeholder="13:00" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">End Time</label>
          <InputText v-model="form.endTime" placeholder="17:00" />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            label="Cancel"
            severity="secondary"
            outlined
            @click="dialogVisible = false"
          />
          <Button
            :label="dialogMode === 'create' ? 'Create' : 'Update'"
            :loading="submitting"
            @click="submitForm"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>