<!-- frontend/src/layouts/AppLayout.vue -->
<script setup>
// frontend/src/layouts/AppLayout.vue

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
  <div class="app-layout">
    <AppSidebar
      v-model:mobileVisible="isMobileSidebarOpen"
      v-model:desktopCollapsed="isDesktopSidebarCollapsed"
    />

    <div
      class="app-layout__content"
      :style="{ '--ot-sidebar-width': desktopSidebarWidth }"
    >
      <AppTopbar
        :desktopCollapsed="isDesktopSidebarCollapsed"
        @toggle-sidebar="isMobileSidebarOpen = true"
        @toggle-desktop-sidebar="
          isDesktopSidebarCollapsed = !isDesktopSidebarCollapsed
        "
      />

      <main class="app-layout__main">
        <div class="app-layout__page">
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
.app-layout {
  min-height: 100vh;
  background: var(--ot-bg);
  color: var(--ot-text);
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}

.app-layout__content {
  min-height: 100vh;
  transition: padding-left 0.2s ease-out;
}

.app-layout__main {
  padding: 0.75rem;
}

.app-layout__page {
  width: 100%;
  max-width: 1600px;
  min-width: 0;
  margin-inline: auto;
}

@media (min-width: 640px) {
  .app-layout__main {
    padding: 1rem;
  }
}

@media (min-width: 1024px) {
  .app-layout__content {
    padding-left: var(--ot-sidebar-width);
  }

  .app-layout__main {
    padding: 1.25rem;
  }
}

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