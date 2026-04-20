<!-- frontend/src/modules/errors/views/ForbiddenView.vue -->
<script setup>
import Button from 'primevue/button'
import Card from 'primevue/card'
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="flex min-h-[70vh] items-center justify-center px-4 py-8 sm:px-6">
    <Card class="w-full max-w-2xl shadow-sm">
      <template #content>
        <div class="flex flex-col items-center text-center">
          <div
            class="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-300"
          >
            <i class="pi pi-lock text-3xl" />
          </div>

          <div class="mb-2 text-4xl font-bold text-surface-900 dark:text-surface-0">
            403
          </div>

          <div class="mb-3 text-xl font-semibold text-surface-900 dark:text-surface-0">
            Access denied
          </div>

          <p class="mb-6 max-w-xl text-surface-600 dark:text-surface-300">
            You do not have permission to access this page.
          </p>

          <div class="flex flex-wrap items-center justify-center gap-3">
            <Button label="Go Home" icon="pi pi-home" @click="goHome" />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>