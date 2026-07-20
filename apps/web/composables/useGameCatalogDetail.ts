import type { RecoGame } from '~/types/recommendations'
import type { IgdbGameDetail } from '~/types/game'

export function useGameCatalogDetail() {
  const route = useRoute()
  const { authFetch, apiBase } = useAuthFetch()

  const preview = useState<RecoGame | null>('catalog-preview', () => null)
  const game = ref<RecoGame | null>(null)
  const loading = ref(false)

  async function load() {
    const gameId = String(route.params.gameId)

    // Le preview en cache (posé par RecoCard) n'est valide que pour la fiche qu'il décrit :
    // sans ce contrôle, naviguer d'un jeu A vers un jeu B réutilise les données de A.
    if (preview.value?.id === gameId) {
      game.value = preview.value
      return
    }

    game.value = null
    loading.value = true
    try {
      const detail = await authFetch<IgdbGameDetail>(
        `${apiBase}/api/games/igdb/${gameId}`,
      )
      game.value = {
        id: String(detail.igdbId),
        title: detail.title,
        slug: detail.igdbId.toString(),
        coverUrl: detail.coverUrl,
        releaseDate: detail.releaseDate,
        releaseStatus: detail.releaseStatus,
        igdbRating: detail.rating,
        genres: detail.genres.map(g => ({ id: String(g.igdbId), name: g.name, slug: g.slug })),
      }
    } catch { /* game reste null → affiche not-found */ }
    finally { loading.value = false }
  }

  // La page catalog/[gameId] réutilise la même instance de composant entre deux
  // navigations (même route dynamique) : il faut réagir aux changements de gameId.
  watch(() => route.params.gameId, load, { immediate: true })

  return { game, loading, load }
}
