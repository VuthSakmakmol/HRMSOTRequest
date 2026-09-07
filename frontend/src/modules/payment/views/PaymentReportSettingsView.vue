<!-- frontend/src/modules/payment/views/PaymentReportSettingsView.vue -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'primevue/usetoast'

import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Tag from 'primevue/tag'

import { useAuthStore } from '@/modules/auth/auth.store'
import {
  createPaymentReportSetting,
  deletePaymentReportSetting,
  getPaymentReportSettings,
  updatePaymentReportSetting,
} from '@/modules/payment/payment.api'
import { getApiErrorMessage } from '@/shared/utils/apiError'

const toast = useToast()
const auth = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)

const rows = ref([])
const positionOptions = ref([])
const updatedBy = ref('')
const updatedAt = ref(null)

const formDialogVisible = ref(false)
const deleteDialogVisible = ref(false)
const editingPositionId = ref('')
const selectedPositionId = ref('')
const deleteTarget = ref(null)

const canView = computed(() => auth.hasAnyPermission(['PAYMENT_REPORT_SETTING_VIEW']))
const canCreate = computed(() => auth.hasAnyPermission(['PAYMENT_REPORT_SETTING_CREATE']))
const canUpdate = computed(() => auth.hasAnyPermission(['PAYMENT_REPORT_SETTING_UPDATE']))
const canDelete = computed(() => auth.hasAnyPermission(['PAYMENT_REPORT_SETTING_DELETE']))

const isEditMode = computed(() => Boolean(editingPositionId.value))
const dialogTitle = computed(() =>
  isEditMode.value ? 'Edit separated position' : 'Add separated position',
)
const saveLabel = computed(() => (isEditMode.value ? 'Save change' : 'Add position'))

const availablePositionOptions = computed(() => {
  const configuredIds = new Set(rows.value.map((row) => s(row.id)))
  const currentId = s(editingPositionId.value)

  return positionOptions.value.filter((option) => {
    const id = s(option.id)
    return id === currentId || !configuredIds.has(id)
  })
})

function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function normalizePayload(res) {
  return res?.data?.data || res?.data || {}
}

function normalizePosition(position = {}) {
  const id = s(position.id || position._id || position.value)
  const code = upper(position.code)
  const name = s(position.name)

  return {
    ...position,
    id,
    code,
    name,
    label: s(position.label) || [code, name].filter(Boolean).join(' - '),
  }
}

function applySettings(item = {}) {
  rows.value = Array.isArray(item.separatePositions)
    ? item.separatePositions.map(normalizePosition)
    : []

  positionOptions.value = Array.isArray(item.positionOptions)
    ? item.positionOptions.map(normalizePosition)
    : []

  updatedBy.value = s(item.updatedBy)
  updatedAt.value = item.updatedAt || null
}

function showToast(severity, summary, detail, life = 3000) {
  toast.add({ severity, summary, detail, life })
}

function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

async function loadSettings() {
  if (!canView.value) return

  loading.value = true

  try {
    const response = await getPaymentReportSettings()
    applySettings(normalizePayload(response)?.item || {})
  } catch (error) {
    showToast(
      'error',
      'Load failed',
      getApiErrorMessage(error, 'Failed to load payment report separation settings'),
      4000,
    )
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  editingPositionId.value = ''
  selectedPositionId.value = ''
  formDialogVisible.value = true
}

function openEditDialog(row) {
  editingPositionId.value = s(row?.id)
  selectedPositionId.value = s(row?.id)
  formDialogVisible.value = true
}

function closeFormDialog() {
  if (saving.value) return
  formDialogVisible.value = false
  editingPositionId.value = ''
  selectedPositionId.value = ''
}

async function saveSetting() {
  const positionId = s(selectedPositionId.value)
  const wasEdit = isEditMode.value
  const originalPositionId = s(editingPositionId.value)

  if (!positionId) {
    showToast('warn', 'Position required', 'Please select a position.')
    return
  }

  saving.value = true

  try {
    const response = wasEdit
      ? await updatePaymentReportSetting(originalPositionId, { positionId })
      : await createPaymentReportSetting({ positionId })

    applySettings(normalizePayload(response)?.item || {})
    formDialogVisible.value = false
    editingPositionId.value = ''
    selectedPositionId.value = ''

    showToast(
      'success',
      wasEdit ? 'Setting updated' : 'Position added',
      'Payment calculation is unchanged. This position will be exported in the separate payment report.',
    )
  } catch (error) {
    showToast(
      'error',
      'Save failed',
      getApiErrorMessage(error, 'Failed to save payment report separation setting'),
      4000,
    )
  } finally {
    saving.value = false
  }
}

function openDeleteDialog(row) {
  deleteTarget.value = row || null
  deleteDialogVisible.value = true
}

function closeDeleteDialog() {
  if (deleting.value) return
  deleteDialogVisible.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  const positionId = s(deleteTarget.value?.id)
  if (!positionId) return

  deleting.value = true

  try {
    const response = await deletePaymentReportSetting(positionId)
    applySettings(normalizePayload(response)?.item || {})
    deleteDialogVisible.value = false
    deleteTarget.value = null

    showToast(
      'success',
      'Setting deleted',
      'This position will return to the normal payment Excel report.',
    )
  } catch (error) {
    showToast(
      'error',
      'Delete failed',
      getApiErrorMessage(error, 'Failed to delete payment report separation setting'),
      4000,
    )
  } finally {
    deleting.value = false
    if (!deleteDialogVisible.value) deleteTarget.value = null
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="ot-page-shell payment-report-settings-page">
    <section class="payment-report-settings-info">
      <div class="payment-report-settings-info__icon">
        <i class="pi pi-file-export" />
      </div>

      <div class="payment-report-settings-info__copy">
        <strong>Payment Report Separation</strong>
        <span>
          Configure positions that must be exported into a separate payment Excel file.
          Payment calculation, formula, approval, and amount stay exactly the same.
        </span>
      </div>

      <Tag
        :value="`${rows.length} separated position${rows.length === 1 ? '' : 's'}`"
        class="payment-report-settings-count"
      />
    </section>

    <section class="ot-table-card">
      <div class="payment-report-settings-toolbar">
        <div>
          <h2>Separated positions</h2>
          <p>
            These positions are excluded from the main payment workbook and placed in the second workbook during Generate.
          </p>
        </div>

        <Button
          v-if="canCreate"
          label="Add Position"
          icon="pi pi-plus"
          size="small"
          @click="openCreateDialog"
        />
      </div>

      <DataTable
        :value="rows"
        data-key="id"
        :loading="loading"
        responsive-layout="scroll"
        striped-rows
        class="payment-report-settings-table"
      >
        <template #empty>
          <div class="payment-report-settings-empty">
            No separated position configured. Payment Generate will create one normal Excel report.
          </div>
        </template>

        <Column
          header="#"
          style="width: 4rem"
        >
          <template #body="slotProps">
            {{ slotProps.index + 1 }}
          </template>
        </Column>

        <Column
          field="code"
          header="Position Code"
          style="min-width: 10rem"
        />

        <Column
          field="name"
          header="Position Name"
          style="min-width: 16rem"
        />

        <Column
          v-if="canUpdate || canDelete"
          header="Action"
          frozen
          align-frozen="right"
          style="width: 10rem"
        >
          <template #body="slotProps">
            <div class="payment-report-settings-actions">
              <Button
                v-if="canUpdate"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                size="small"
                aria-label="Edit"
                title="Edit"
                @click="openEditDialog(slotProps.data)"
              />

              <Button
                v-if="canDelete"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                aria-label="Delete"
                title="Delete"
                @click="openDeleteDialog(slotProps.data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>

      <div class="payment-report-settings-footer">
        <span>Last updated: {{ formatDateTime(updatedAt) }}</span>
        <span v-if="updatedBy">By: {{ updatedBy }}</span>
      </div>
    </section>

    <Dialog
      v-model:visible="formDialogVisible"
      modal
      :header="dialogTitle"
      :style="{ width: 'min(560px, 94vw)' }"
      :closable="!saving"
    >
      <div class="payment-report-settings-form">
        <label for="payment-report-position">Position <span>*</span></label>
        <Select
          id="payment-report-position"
          v-model="selectedPositionId"
          :options="availablePositionOptions"
          option-label="label"
          option-value="id"
          filter
          show-clear
          placeholder="Example: Truck Loading"
          class="w-full"
        />

        <small>
          Selected employees will still be paid normally. Only the generated Excel report is separated.
        </small>
      </div>

      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          :disabled="saving"
          @click="closeFormDialog"
        />
        <Button
          :label="saveLabel"
          icon="pi pi-save"
          :loading="saving"
          :disabled="!selectedPositionId"
          @click="saveSetting"
        />
      </template>
    </Dialog>

    <Dialog
      v-model:visible="deleteDialogVisible"
      modal
      header="Delete separated position"
      :style="{ width: 'min(500px, 94vw)' }"
      :closable="!deleting"
    >
      <div class="payment-report-settings-delete">
        <i class="pi pi-exclamation-triangle" />
        <p>
          Remove <strong>{{ deleteTarget?.label || deleteTarget?.name }}</strong> from the separate payment report?
          Its employees will go back into the normal payment Excel on the next Generate.
        </p>
      </div>

      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          :disabled="deleting"
          @click="closeDeleteDialog"
        />
        <Button
          label="Delete"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="confirmDelete"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.payment-report-settings-page {
  display: grid;
  gap: 0.85rem;
}

.payment-report-settings-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--ot-border);
  border-radius: 0.8rem;
  background: var(--ot-surface);
  padding: 0.8rem 0.9rem;
}

.payment-report-settings-info__icon {
  display: inline-flex;
  width: 2.15rem;
  height: 2.15rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 0.55rem;
  background: rgba(16, 185, 129, 0.12);
  color: rgb(4, 120, 87);
}

.payment-report-settings-info__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.payment-report-settings-info__copy strong {
  font-size: 0.86rem;
}

.payment-report-settings-info__copy span {
  color: var(--ot-text-muted);
  font-size: 0.74rem;
  line-height: 1.4;
}

.payment-report-settings-count {
  flex: 0 0 auto;
}

.payment-report-settings-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ot-border);
  padding: 0.8rem 0.9rem;
}

.payment-report-settings-toolbar h2 {
  margin: 0;
  font-size: 0.88rem;
}

.payment-report-settings-toolbar p {
  margin: 0.18rem 0 0;
  color: var(--ot-text-muted);
  font-size: 0.72rem;
}

.payment-report-settings-table :deep(.p-datatable-thead > tr > th),
.payment-report-settings-table :deep(.p-datatable-tbody > tr > td) {
  text-align: center;
  vertical-align: middle;
}

.payment-report-settings-actions {
  display: flex;
  justify-content: center;
  gap: 0.15rem;
}

.payment-report-settings-empty {
  padding: 1.5rem;
  color: var(--ot-text-muted);
  text-align: center;
  font-size: 0.76rem;
}

.payment-report-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.9rem;
  border-top: 1px solid var(--ot-border);
  padding: 0.6rem 0.9rem;
  color: var(--ot-text-muted);
  font-size: 0.7rem;
}

.payment-report-settings-form {
  display: grid;
  gap: 0.55rem;
}

.payment-report-settings-form label {
  font-size: 0.76rem;
  font-weight: 700;
}

.payment-report-settings-form label span {
  color: var(--p-red-500, #ef4444);
}

.payment-report-settings-form small {
  color: var(--ot-text-muted);
  font-size: 0.71rem;
  line-height: 1.4;
}

.payment-report-settings-delete {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
}

.payment-report-settings-delete > i {
  margin-top: 0.1rem;
  color: var(--p-orange-500, #f97316);
  font-size: 1.25rem;
}

.payment-report-settings-delete p {
  margin: 0;
  color: var(--ot-text-muted);
  font-size: 0.76rem;
  line-height: 1.5;
}

@media (max-width: 680px) {
  .payment-report-settings-info,
  .payment-report-settings-toolbar,
  .payment-report-settings-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .payment-report-settings-toolbar :deep(.p-button) {
    width: 100%;
  }
}
</style>
