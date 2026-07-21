import { ref } from 'vue'
import type { ImportStatus } from '~/types/game'

// Suivi de l'import Steam / enrichissement IGDB, poll cote front.
// Etat au niveau module : useGameList declenche start(), la modale
// ImportProgressModal lit open/status, tout le monde partage la meme instance.
const POLL_MS = 500
const MAX_MS = 5 * 60 * 1000 // garde-fou : on ne poll jamais plus de 5 min

const open = ref(false)
const status = ref<ImportStatus | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null
let deadline = 0
let inBackground = false
let doneHandler: (() => void) | null = null
// Incrementee a chaque start()/close() : un tick() en vol dont la generation
// ne correspond plus a la generation courante voit sa reponse ignoree (evite
// un finish() en double ou une reprogrammation de polling si la modale a ete
// fermee pendant que la requete de status etait en l'air).
let generation = 0

export function useImportProgress() {
  const { authFetch, apiBase } = useAuthFetch()
  const { push } = useToast()
  const { t } = useI18n()

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function finish() {
    generation++
    clearTimer()
    const wasBackground = inBackground
    open.value = false
    inBackground = false
    doneHandler?.()
    // Si l'utilisateur avait ferme la modale (arriere-plan), on le previent par
    // un toast que les jaquettes sont a jour.
    if (wasBackground) {
      push({ type: 'success', text: t('gameList.enrichDone') })
    }
  }

  async function tick() {
    const gen = generation
    try {
      const res = await authFetch<ImportStatus>(
        `${apiBase}/api/platforms/steam/import/status`,
      )
      if (gen !== generation) return // modale fermee/relancee pendant la requete : reponse obsolete
      status.value = res
      if (res.status === 'done') {
        finish()
        return
      }
    } catch {
      if (gen !== generation) return
      // Erreur transitoire (reseau, refresh token) : on retente au prochain tick.
    }
    if (Date.now() >= deadline) {
      clearTimer()
      return
    }
    timer = setTimeout(tick, POLL_MS)
  }

  function start() {
    generation++
    clearTimer()
    inBackground = false
    status.value = null
    open.value = true
    deadline = Date.now() + MAX_MS
    void tick()
  }

  // L'utilisateur ferme la modale mais l'enrichissement continue en tache de fond :
  // on garde le polling actif pour finir proprement (re-fetch a la fin).
  function stopBackground() {
    open.value = false
    inBackground = true
    if (!timer) {
      deadline = Date.now() + MAX_MS
      void tick()
    }
  }

  // Fermeture explicite (croix) : stoppe tout.
  function close() {
    finish()
  }

  function onDone(cb: () => void) {
    doneHandler = cb
  }

  return { open, status, start, stopBackground, close, onDone }
}

export function __resetImportProgress() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  open.value = false
  status.value = null
  deadline = 0
  inBackground = false
  doneHandler = null
  generation++
}
