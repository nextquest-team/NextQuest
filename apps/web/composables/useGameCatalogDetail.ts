import type { CatalogPreview, IgdbGameDetail } from '~/types/game'

function previewToGame(p: CatalogPreview): IgdbGameDetail {
  return {
    igdbId: p.igdbId,
    title: p.title ?? '',
    summary: p.summary ?? null,
    storyline: p.storyline ?? null,
    releaseDate: p.releaseDate ?? null,
    releaseStatus: p.releaseStatus ?? 'upcoming',
    coverUrl: p.coverUrl ?? null,
    artworkUrl: p.artworkUrl ?? null,
    screenshots: p.screenshots ?? [],
    videos: p.videos ?? [],
    rating: p.rating ?? null,
    ratingCount: p.ratingCount ?? null,
    hypes: p.hypes ?? null,
    developer: p.developer ?? null,
    publisher: p.publisher ?? null,
    genres: p.genres ?? [],
    themes: p.themes ?? [],
    gameModes: p.gameModes ?? [],
    playerPerspectives: p.playerPerspectives ?? [],
    platforms: p.platforms ?? [],
    similarGames: p.similarGames ?? [],
  }
}

export function useGameCatalogDetail() {
  const route = useRoute()
  const { authFetch, apiBase } = useAuthFetch()

  const preview = useState<CatalogPreview | null>('catalog-preview', () => null)
  const game = ref<IgdbGameDetail | null>(null)
  const loading = ref(false)

  async function load() {
    const gameIdParam = String(route.params.gameId)
    const igdbId = Number(gameIdParam)

    // Le preview en cache (posé par RecoCard / TimelineGameCard) n'est valide que pour
    // la fiche qu'il décrit : sans ce contrôle, naviguer d'un jeu A vers un jeu B
    // réutilise les données de A le temps du fetch.
    game.value = preview.value?.igdbId === igdbId ? previewToGame(preview.value) : null
    loading.value = !game.value

    try {
      game.value = await authFetch<IgdbGameDetail>(`${apiBase}/api/games/igdb/${gameIdParam}`)
    } catch { /* si un preview existait déjà il reste affiché, sinon → not-found */ }
    finally { loading.value = false }
  }

  // La page catalog/[gameId] réutilise la même instance de composant entre deux
  // navigations (même route dynamique) : il faut réagir aux changements de gameId.
  watch(() => route.params.gameId, load, { immediate: true })

  return { game, loading, load }
}
