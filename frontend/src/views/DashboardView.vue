<template>
  <div class="flex flex-col gap-8 p-4 md:p-8 bg-[#f2f7ff] dark:bg-[#1a1a2e] min-h-screen">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[#25396f] dark:text-white">Profile Statistics</h1>
        <p class="text-sm text-[#7c8db5]">Check your latest social engagement metrics</p>
      </div>
      <button class="flex items-center gap-2 rounded-lg bg-[#435ebe] px-4 py-2 text-sm font-medium text-white shadow-lg transition-transform hover:scale-105 active:scale-95">
        <i class="pi pi-plus text-xs" />
        <span>Update Data</span>
      </button>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <div 
        v-for="(stat, idx) in stats" 
        :key="idx" 
        class="group flex items-center gap-5 rounded-2xl bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:bg-[#252542]"
      >
        <div :class="`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl text-white shadow-inner transition-transform group-hover:rotate-6 ${stat.colorClass}`">
          <i :class="stat.icon" />
        </div>
        <div>
          <div class="text-sm font-medium text-[#7c8db5]">{{ stat.label }}</div>
          <div class="mt-1 text-2xl font-black text-[#25396f] dark:text-white">{{ stat.value }}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      
      <div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-[#252542] lg:col-span-8">
        <div class="mb-8 flex items-center justify-between">
          <h2 class="text-lg font-bold text-[#25396f] dark:text-white">Profile Visit Trends</h2>
          <div class="flex items-center gap-2 rounded-md bg-[#f2f7ff] px-2 py-1 dark:bg-[#1a1a2e]">
            <span class="text-xs font-semibold text-[#435ebe]">2024</span>
            <i class="pi pi-chevron-down text-[10px] text-[#7c8db5]" />
          </div>
        </div>
        
        <div class="relative mt-4 h-64 w-full">
          <div class="absolute inset-0 flex flex-col justify-between py-2">
            <div v-for="i in 5" :key="i" class="w-full border-b border-dashed border-[#e5e9f2] dark:border-[#333355]"></div>
          </div>
          
          <div class="absolute bottom-0 left-0 flex h-full w-full items-end justify-between px-2">
            <div v-for="(h, i) in [45, 75, 55, 90, 65, 40, 85, 100, 70, 50, 60, 80]" :key="i" 
                 class="group relative w-[6%] cursor-pointer">
              <div class="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-[#25396f] px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {{ h }}k
              </div>
              <div class="w-full rounded-t-lg bg-[#435ebe] opacity-90 transition-all group-hover:bg-[#57caeb] group-hover:opacity-100"
                   :style="`height: ${h}%`" />
            </div>
          </div>
        </div>

        <div class="mt-4 flex justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-[#7c8db5]">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
          <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
        </div>
      </div>

      <div class="flex flex-col gap-6 lg:col-span-4">
        
        <div class="rounded-2xl bg-white p-6 shadow-sm transition-all hover:shadow-md dark:bg-[#252542] flex items-center gap-4">
          <div class="relative">
            <Avatar image="https://i.pravatar.cc/150?u=a" size="xlarge" shape="circle" class="border-2 border-[#435ebe]" />
            <div class="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-green-500"></div>
          </div>
          <div>
            <div class="text-lg font-bold text-[#25396f] dark:text-white">John Duck</div>
            <div class="text-sm font-medium text-[#7c8db5]">@johnducky</div>
          </div>
        </div>

        <div class="flex-1 rounded-2xl bg-white p-6 shadow-sm dark:bg-[#252542]">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-lg font-bold text-[#25396f] dark:text-white">Recent Messages</h2>
            <span class="rounded-full bg-[#ebf3ff] px-2 py-1 text-[10px] font-bold text-[#435ebe]">3 NEW</span>
          </div>
          
          <div class="flex flex-col gap-5">
            <div v-for="(msg, i) in messages" :key="i" class="group flex cursor-pointer items-center gap-4">
              <Avatar :image="msg.avatar" size="large" shape="circle" />
              <div class="flex-1 border-b border-gray-50 pb-2 transition-colors group-hover:border-[#435ebe] dark:border-gray-800">
                <div class="font-bold text-[#25396f] dark:text-white">{{ msg.name }}</div>
                <div class="text-xs text-[#7c8db5] dark:text-[#8a98bd]">{{ msg.handle }}</div>
              </div>
              <i class="pi pi-chevron-right text-[10px] text-[#7c8db5]" />
            </div>
          </div>
          
          <button class="mt-8 w-full rounded-xl bg-[#ebf3ff] py-3 text-sm font-bold text-[#435ebe] transition-all hover:bg-[#435ebe] hover:text-white dark:bg-[#435ebe]/10 dark:text-[#bfc8e2] dark:hover:bg-[#435ebe]">
            View All Messages
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import Avatar from 'primevue/avatar'

const stats = [
  { label: 'Profile Views', value: '112,000', icon: 'pi pi-eye', colorClass: 'bg-[#9694ff]' },
  { label: 'Followers', value: '183,000', icon: 'pi pi-user', colorClass: 'bg-[#57caeb]' },
  { label: 'Following', value: '80,000', icon: 'pi pi-user-plus', colorClass: 'bg-[#5ddab4]' },
  { label: 'Saved Post', value: '112', icon: 'pi pi-bookmark', colorClass: 'bg-[#ff7976]' },
]

const messages = [
  { name: 'Hank Schrader', handle: 'Sent you a photo', avatar: 'https://i.pravatar.cc/150?u=b' },
  { name: 'Dean Winchester', handle: 'Are we hunting tonight?', avatar: 'https://i.pravatar.cc/150?u=c' },
  { name: 'John Dodol', handle: 'The project is ready!', avatar: 'https://i.pravatar.cc/150?u=d' },
]
</script>

<style scoped>
/* Smooth transitions for hover effects */
.ui-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>