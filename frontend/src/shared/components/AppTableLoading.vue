<!-- frontend/src/shared/components/AppTableLoading.vue -->
<script setup>
defineProps({
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
})

function cellWidth(index) {
  const widths = ['90px', '150px', '120px', '80px', '110px', '95px', '130px', '75px']
  return widths[(index - 1) % widths.length]
}
</script>

<template>
  <div class="app-table-loading">
    <div class="app-table-loading__top">
      <div class="min-w-0">
        <div class="app-table-loading__title">
          {{ title }}
        </div>
        <div class="app-table-loading__text">
          {{ message }}
        </div>
      </div>

      <div class="app-table-loading__spinner" />
    </div>

    <div class="app-table-loading__rows">
      <div
        v-for="row in rows"
        :key="row"
        class="app-table-loading__row"
      >
        <div
          v-for="col in columns"
          :key="col"
          class="app-table-loading__cell"
          :style="{ width: cellWidth(col) }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-table-loading {
  padding: 1rem;
  background: var(--ot-surface, #ffffff);
}

.app-table-loading__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.app-table-loading__title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ot-text, #111827);
}

.app-table-loading__text {
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--ot-text-muted, #6b7280);
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

.app-table-loading__rows {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.app-table-loading__row {
  display: flex;
  min-height: 2.8rem;
  align-items: center;
  gap: 0.7rem;
  overflow: hidden;
  border-bottom: 1px solid var(--ot-border, #e5e7eb);
}

.app-table-loading__cell {
  height: 0.78rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ot-border, #e5e7eb) 70%, transparent),
    color-mix(in srgb, var(--ot-border, #e5e7eb) 35%, transparent),
    color-mix(in srgb, var(--ot-border, #e5e7eb) 70%, transparent)
  );
  background-size: 200% 100%;
  animation: app-skeleton 1.15s ease-in-out infinite;
}

@keyframes app-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes app-skeleton {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}
</style>