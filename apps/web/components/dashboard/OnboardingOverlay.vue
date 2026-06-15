<script setup lang="ts">
import { $fetch } from 'ofetch'
import type { driver as DriverFn } from 'driver.js'

const { t } = useI18n()
const { user } = useAuth()
const store = useAuthStore()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

async function complete() {
  try {
    await $fetch(`${apiBase}/api/users/me/onboarding/complete`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${store.accessToken}` },
    })
    if (store.user) {
      store.setAuth({ ...store.user, onboardingCompleted: true }, store.accessToken!)
    }
  } catch { /* idempotent — on ne marque pas localement si l'API a échoué */ }
}

let tourStarted = false
let driverObj: ReturnType<typeof DriverFn> | null = null

async function startTour() {
  if (tourStarted) return
  tourStarted = true

  // Import dynamique : driver.js n'est jamais chargé côté serveur (SSR),
  // ce qui évite le crash "currentRenderingInstance is null" au rendu SSR.
  const { driver } = await import('driver.js')
  await import('driver.js/dist/driver.css')

  const obj = driver({
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: t('dashboard.onboarding.next'),
    prevBtnText: '←',
    doneBtnText: t('dashboard.onboarding.finish'),
    allowClose: true,
    overlayColor: 'rgba(153, 144, 144, 0.64)',
    stagePadding: 8,
    stageRadius: 10,
    popoverClass: 'nq-popover',
    onDestroyStarted: () => {
      // Driver.js appelle onDestroyStarted avant la vraie destruction (Done, X, Échap).
      // Si on n'appelle pas destroy() ici, le tour reste ouvert.
      // obj.destroy() appelle g(false) qui bypasse onDestroyStarted et détruit vraiment.
      obj.destroy()
    },
    onDestroyed: () => {
      // Appelé après la destruction effective, quel que soit le déclencheur :
      // Done/X/Échap → onDestroyStarted → obj.destroy() → onDestroyed
      // Skip        → obj.destroy() directement → onDestroyed
      complete()
    },
    onPopoverRender: (popover) => {
      const btn = document.createElement('button')
      btn.innerText = t('dashboard.onboarding.skip')
      btn.className = 'nq-skip-btn'
      btn.onclick = () => obj.destroy()
      popover.footer.appendChild(btn)
    },
    steps: [
      {
        element: '[data-onb-target="wheel"]',
        popover: {
          title: t('dashboard.onboarding.title1'),
          description: t('dashboard.onboarding.step1'),
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '[data-onb-target="bag"]',
        popover: {
          title: t('dashboard.onboarding.title2'),
          description: t('dashboard.onboarding.step2'),
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '[data-onb-target="profile"]',
        popover: {
          title: t('dashboard.onboarding.title3'),
          description: t('dashboard.onboarding.step3'),
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-onb-target="parchemin"]',
        popover: {
          title: t('dashboard.onboarding.title4'),
          description: t('dashboard.onboarding.step4'),
          side: 'left',
          align: 'center',
        },
      },
      {
        element: '[data-onb-target="timeline"]',
        popover: {
          title: t('dashboard.onboarding.title5'),
          description: t('dashboard.onboarding.step5'),
          side: 'top',
          align: 'center',
        },
      },
    ],
  })
  driverObj = obj
  obj.drive()
}

onBeforeUnmount(() => {
  driverObj?.destroy()
})

const show = computed(() => user.value?.onboardingCompleted === false)

watch(show, (val) => {
  if (val) nextTick(startTour)
}, { immediate: true })
</script>

<template>
  <!-- Driver.js gère l'overlay et les tooltips directement dans le DOM -->
</template>

<style>
/* Popover Driver.js avec le style NQ */
.nq-popover .driver-popover-title {
  font-family: var(--nq-font);
  font-size: 1rem;
  color: #56311B;
}

.nq-popover .driver-popover-description {
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: #3A1A0A;
  line-height: 1.5;
}

.nq-popover.driver-popover {
  background: radial-gradient(circle at center, rgba(202, 164, 109, 1) 0%, rgba(158, 106, 30, 1) 100%);
  border: 4px solid #5B6A5B;
  border-radius: 10px;
  min-width: 280px;
  max-width: 360px;
}

.nq-popover .driver-popover-arrow-side-left.driver-popover-arrow { border-right-color: #5B6A5B; }
.nq-popover .driver-popover-arrow-side-right.driver-popover-arrow { border-left-color: #5B6A5B; }
.nq-popover .driver-popover-arrow-side-top.driver-popover-arrow { border-bottom-color: #5B6A5B; }
.nq-popover .driver-popover-arrow-side-bottom.driver-popover-arrow { border-top-color: #5B6A5B; }

.nq-popover .driver-popover-next-btn,
.nq-popover .driver-popover-prev-btn,
.nq-popover .driver-popover-done-btn {
  font-family: var(--nq-font);
  background: #56311B;
  color: #edc78e;
  border: none;
  border-radius: 5px;
  padding: 6px 16px;
  cursor: pointer;
  text-shadow: none;
}

.nq-popover .driver-popover-next-btn:hover,
.nq-popover .driver-popover-prev-btn:hover,
.nq-popover .driver-popover-done-btn:hover {
  background: #7a3e2a;
  color: #edc78e;
}

.nq-popover .driver-popover-close-btn {
  color: #56311B;
  font-size: 1.2rem;
}

.nq-popover .driver-popover-close-btn:hover {
  color: #3A1A0A;
  background: transparent;
}

.nq-popover .driver-popover-progress-text {
  font-family: var(--nq-font);
  color: #56311B;
  font-size: 0.8rem;
}

.nq-skip-btn {
  font-family: var(--nq-font);
  font-size: 0.8rem;
  background: transparent;
  border: none;
  color: #56311B;
  text-decoration: underline;
  cursor: pointer;
  padding: 4px 8px;
  margin-left: auto;
  opacity: 0.75;
}

.nq-skip-btn:hover {
  opacity: 1;
}
</style>
