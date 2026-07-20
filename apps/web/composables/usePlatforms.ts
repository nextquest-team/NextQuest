import { ref } from 'vue'
import type { Platform } from '~/types/game'

// Le referentiel des plateformes change tres rarement : on le charge une fois
// et on partage le resultat entre tous les composants via un cache module.
const platforms = ref<Platform[]>([])
const loading = ref(false)
let loaded = false

export function usePlatforms() {
  const { authFetch, apiBase } = useAuthFetch()

  async function fetchPlatforms() {
    if (loaded || loading.value) return
    loading.value = true
    try {
      const res = await authFetch<{ items: Platform[] }>(`${apiBase}/api/platforms`)
      platforms.value = res.items
      loaded = true
    } finally {
      loading.value = false
    }
  }

  return { platforms, loading, fetchPlatforms }
}

// Reinitialise le cache module (utilise par les tests pour isoler les cas).
export function __resetPlatformsCache() {
  platforms.value = []
  loading.value = false
  loaded = false
}
