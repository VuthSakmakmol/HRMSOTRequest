<!-- frontend/src/shared/components/AppTableLoading.vue -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: 'Loading data',
  },
  message: {
    type: String,
    default: 'Fetching records from the server.',
  },
  rows: {
    type: Number,
    default: 7,
  },
  columns: {
    type: Number,
    default: 8,
  },
  icon: {
    type: String,
    default: 'pi pi-database',
  },
  compact: {
    type: Boolean,
    default: false,
  },
})

const safeRows = computed(() => Math.max(1, Number(props.rows || 7)))
const safeColumns = computed(() => Math.max(1, Number(props.columns || 8)))

function cellWidth(index) {
  const widths = [
    '92px',
    '160px',
    '128px',
    '88px',
    '118px',
    '104px',
    '138px',
    '82px',
    '150px',
    '110px',
  ]

  return widths[(index - 1) % widths.length]
}

function mobileLineWidth(index) {
  const widths = ['72%', '48%', '88%', '60%', '42%', '78%']
  return widths[(index - 1) % widths.length]
}
</script>

<template>
  <div
    class="app-table-loading"
    :class="{ 'app-table-loading--compact': compact }"
  >
    <div class="app-table-loading__top">
      <div class="app-table-loading__heading">
        <div class="app-table-loading__icon">
          <i :class="icon" />
        </div>

        <div class="min-w-0">
          <div class="app-table-loading__title">
            {{ title }}
          </div>

          <div class="app-table-loading__text">
            {{ message }}
          </div>
        </div>
      </div>

      <div class="app-table-loading__spinner" />
    </div>

    <!-- Desktop / tablet table skeleton -->
    <div class="app-table-loading__desktop">
      <div class="app-table-loading__header-row">
        <div
          v-for="col in safeColumns"
          :key="`head-${col}`"
          class="app-table-loading__head-cell"
          :style="{ width: cellWidth(col) }"
        />
      </div>

      <div class="app-table-loading__rows">
        <div
          v-for="row in safeRows"
          :key="`row-${row}`"
          class="app-table-loading__row"
        >
          <div
            v-for="col in safeColumns"
            :key="`row-${row}-col-${col}`"
            class="app-table-loading__cell"
            :style="{ width: cellWidth(col) }"
          />
        </div>
      </div>
    </div>

    <!-- Mobile card skeleton -->
    <div class="app-table-loading__mobile">
      <div
        v-for="row in Math.min(safeRows, 5)"
        :key="`mobile-${row}`"
        class="app-table-loading__mobile-card"
      >
        <div class="app-table-loading__mobile-head">
          <div class="app-table-loading__avatar" />

          <div class="app-table-loading__mobile-title-wrap">
            <div
              class="app-table-loading__mobile-line app-table-loading__mobile-line--title"
              :style="{ width: mobileLineWidth(row) }"
            />
            <div
              class="app-table-loading__mobile-line"
              :style="{ width: mobileLineWidth(row + 1) }"
            />
          </div>
        </div>

        <div class="app-table-loading__mobile-grid">
          <div
            v-for="item in Math.min(safeColumns, 6)"
            :key="`mobile-${row}-item-${item}`"
            class="app-table-loading__mobile-field"
          >
            <div class="app-table-loading__mobile-label" />
            <div
              class="app-table-loading__mobile-line"
              :style="{ width: mobileLineWidth(item + row) }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-table-loading {
  width: 100%;
  padding: 1rem;
  background:
    radial-gradient(circle at top left, rgba(170, 205, 220, 0.16), transparent 32%),
    linear-gradient(180deg, var(--ot-surface, #ffffff), var(--ot-surface-2, #f8fafc));
}

.app-table-loading--compact {
  padding: 0.85rem;
}

.app-table-loading__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.app-table-loading__heading {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.75rem;
}

.app-table-loading__icon {
  display: inline-flex;
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ot-border, #e5e7eb);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ot-blue, #81a6c6) 16%, transparent);
  color: var(--ot-blue, #81a6c6);
}

.app-table-loading__title {
  overflow: hidden;
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--ot-text, #111827);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-table-loading__text {
  margin-top: 0.15rem;
  overflow: hidden;
  font-size: 0.78rem;
  color: var(--ot-text-muted, #6b7280);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-table-loading__spinner {
  width: 1.55rem;
  height: 1.55rem;
  flex: 0 0 auto;
  border-radius: 999px;
  border: 2px solid color-mix(in srgb, var(--ot-border, #e5e7eb) 80%, transparent);
  border-top-color: var(--ot-blue, #81a6c6);
  animation: app-spin 0.75s linear infinite;
}

.app-table-loading__desktop {
  display: block;
  width: 100%;
  overflow: hidden;
}

.app-table-loading__header-row,
.app-table-loading__row {
  display: flex;
  min-width: max-content;
  align-items: center;
  gap: 0.72rem;
}

.app-table-loading__header-row {
  min-height: 2.35rem;
  border-bottom: 1px solid var(--ot-border, #e5e7eb);
}

.app-table-loading__row {
  min-height: 3rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ot-border, #e5e7eb) 78%, transparent);
}

.app-table-loading__rows {
  display: flex;
  flex-direction: column;
}

.app-table-loading__head-cell,
.app-table-loading__cell,
.app-table-loading__mobile-line,
.app-table-loading__mobile-label,
.app-table-loading__avatar {
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ot-border, #e5e7eb) 76%, transparent),
    color-mix(in srgb, var(--ot-border, #e5e7eb) 36%, transparent),
    color-mix(in srgb, var(--ot-border, #e5e7eb) 76%, transparent)
  );
  background-size: 220% 100%;
  animation: app-skeleton 1.15s ease-in-out infinite;
}

.app-table-loading__head-cell {
  height: 0.62rem;
  opacity: 0.86;
}

.app-table-loading__cell {
  height: 0.78rem;
}

.app-table-loading__mobile {
  display: none;
}

.app-table-loading__mobile-card {
  border: 1px solid var(--ot-border, #e5e7eb);
  border-radius: var(--ot-radius-lg, 18px);
  background: color-mix(in srgb, var(--ot-surface, #ffffff) 92%, transparent);
  padding: 0.85rem;
  box-shadow: var(--ot-shadow-sm, 0 2px 10px rgba(15, 23, 42, 0.05));
}

.app-table-loading__mobile-head {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.app-table-loading__avatar {
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 auto;
}

.app-table-loading__mobile-title-wrap {
  display: grid;
  flex: 1;
  gap: 0.45rem;
}

.app-table-loading__mobile-line {
  height: 0.72rem;
}

.app-table-loading__mobile-line--title {
  height: 0.86rem;
}

.app-table-loading__mobile-grid {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 0.8rem;
}

.app-table-loading__mobile-field {
  min-width: 0;
  border-radius: 12px;
  background: var(--ot-surface-2, #f8fafc);
  padding: 0.55rem 0.65rem;
}

.app-table-loading__mobile-label {
  width: 42%;
  height: 0.48rem;
  margin-bottom: 0.45rem;
  opacity: 0.72;
}

@media (max-width: 640px) {
  .app-table-loading {
    padding: 0.85rem;
  }

  .app-table-loading__top {
    align-items: flex-start;
  }

  .app-table-loading__icon {
    width: 2.15rem;
    height: 2.15rem;
  }

  .app-table-loading__title,
  .app-table-loading__text {
    white-space: normal;
  }

  .app-table-loading__desktop {
    display: none;
  }

  .app-table-loading__mobile {
    display: grid;
    gap: 0.75rem;
  }

  .app-table-loading__mobile-grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 641px) {
  .app-table-loading__desktop {
    overflow-x: auto;
    padding-bottom: 0.15rem;
  }
}

@keyframes app-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes app-skeleton {
  0% {
    background-position: 220% 0;
  }

  100% {
    background-position: -220% 0;
  }
}
</style>