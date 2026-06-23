import type { RecoGame } from '~/types/recommendations'
import type { IgdbGameDetail } from '~/types/game'

export function useGameCatalogDetail() {
  const route = useRoute()
  const { authFetch, apiBase } = useAuthFetch()

  const preview = useState<RecoGame | null>('catalog-preview', () => null)
  const game = ref<RecoGame | null>(preview.value)
  const loading = ref(false)

  async function load() {
    if (game.value) return

    loading.value = true
    try {
      const detail = await authFetch<IgdbGameDetail>(
        `${apiBase}/api/games/igdb/${route.params.gameId}`,
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

  return { game, loading, load }
}
