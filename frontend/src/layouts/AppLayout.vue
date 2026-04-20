<!-- frontend/src/layouts/AppLayout.vue -->
<script setup>
import { computed, ref } from 'vue'
import { RouterView } from 'vue-router'

import AppSidebar from './components/AppSidebar.vue'
import AppTopbar from './components/AppTopbar.vue'

const isMobileSidebarOpen = ref(false)
const isDesktopSidebarCollapsed = ref(false)

const desktopSidebarWidth = computed(() =>
  isDesktopSidebarCollapsed.value ? '5.5rem' : '17rem',
)
</script>

<template>
  <div
    class="min-h-screen bg-[color:var(--ot-bg)] text-[color:var(--ot-text)] transition-colors duration-200"
  >
    <AppSidebar
      v-model:mobileVisible="isMobileSidebarOpen"
      v-model:desktopCollapsed="isDesktopSidebarCollapsed"
    />

    <div
      class="min-h-screen transition-[padding-left] duration-200 ease-out lg:pl-[var(--ot-sidebar-width)]"
      :style="{ '--ot-sidebar-width': desktopSidebarWidth }"
    >
      <AppTopbar
        :desktopCollapsed="isDesktopSidebarCollapsed"
        @toggle-sidebar="isMobileSidebarOpen = true"
        @toggle-desktop-sidebar="isDesktopSidebarCollapsed = !isDesktopSidebarCollapsed"
      />

      <main class="px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        <div class="mx-auto w-full max-w-[1600px] min-w-0">
          <RouterView v-slot="{ Component }">
            <transition name="page-fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>