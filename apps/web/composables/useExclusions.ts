import { ref, computed } from 'vue'
import type { ExclusionItem } from '~/types/game'

// Jeux exclus (supprimes de la collection) : partages au niveau module pour que
// le compteur du header et la modale de gestion voient le meme etat.
const exclusions = ref<ExclusionItem[]>([])
const loading = ref(false)

export function useExclusions() {
  const { authFetch, apiBase } = useAuthFetch()

  const count = computed(() => exclusions.value.length)

  async function fetchExclusions() {
    loading.value = true
    try {
      const res = await authFetch<{ items: ExclusionItem[] }>(
        `${apiBase}/api/collection/exclusions`,
      )
      exclusions.value = res.items ?? []
    } catch {
      // conserve l'etat courant en cas d'erreur reseau
    } finally {
      loading.value = false
    }
  }

  // Reintegre un jeu exclu dans la collection. POST sans body (ofetch n'ajoute
  // pas de content-type, ce qui evite un 400 sur body JSON vide cote Fastify).
  async function restore(gameId: string): Promise<boolean> {
    try {
      await authFetch(`${apiBase}/api/collection/exclusions/${gameId}/restore`, {
        method: 'POST',
      })
      exclusions.value = exclusions.value.filter((e) => e.gameId !== gameId)
      return true
    } catch {
      return false
    }
  }

  return { exclusions, count, loading, fetchExclusions, restore }
}

export function __resetExclusions() {
  exclusions.value = []
  loading.value = false
}
