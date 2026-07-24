import type { CatalogPreview, IgdbGameDetail } from '~/types/game'

function previewToGame(p: CatalogPreview): IgdbGameDetail {
  return {
    igdbId: p.igdbId,
    title: p.title ?? '',
    summary: p.summary ?? null,
    storyline: p.storyline ?? null,
    releaseDate: p.releaseDate ?? null,
    releaseStatus: p.releaseStatus ?? 'released',
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
  // true tant que `game` ne contient que le preview (titre/jaquette) et que le
  // fetch complet est encore en vol : sert a afficher des skeletons sur les
  // blocs pas encore charges plutot que les quelques champs epars du preview.
  const previewOnly = ref(false)

  async function load() {
    const gameIdParam = String(route.params.gameId)
    const igdbId = Number(gameIdParam)

    // Le preview en cache (posé par RecoCard / TimelineGameCard) n'est valide que pour
    // la fiche qu'il décrit : sans ce contrôle, naviguer d'un jeu A vers un jeu B
    // réutilise les données de A le temps du fetch.
    const hasPreview = preview.value?.igdbId === igdbId
    game.value = hasPreview ? previewToGame(preview.value!) : null
    loading.value = !game.value
    previewOnly.value = hasPreview

    try {
      game.value = await authFetch<IgdbGameDetail>(`${apiBase}/api/games/igdb/${gameIdParam}`)
    } catch { /* si un preview existait déjà il reste affiché, sinon → not-found */ }
    finally {
      loading.value = false
      previewOnly.value = false
    }
  }

  // La page catalog/[gameId] réutilise la même instance de composant entre deux
  // navigations (même route dynamique) : il faut réagir aux changements de gameId.
  watch(() => route.params.gameId, load, { immediate: true })

  return { game, loading, previewOnly, load }
}
