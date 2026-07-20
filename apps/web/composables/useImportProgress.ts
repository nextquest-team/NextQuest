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

export function useImportProgress() {
  const { authFetch, apiBase } = useAuthFetch()

  function clearTimer() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  function finish() {
    clearTimer()
    open.value = false
    inBackground = false
    doneHandler?.()
  }

  async function tick() {
    try {
      const res = await authFetch<ImportStatus>(
        `${apiBase}/api/platforms/steam/import/status`,
      )
      status.value = res
      if (res.status === 'done') {
        finish()
        return
      }
    } catch {
      // Erreur transitoire (reseau, refresh token) : on retente au prochain tick.
    }
    if (Date.now() >= deadline) {
      clearTimer()
      return
    }
    timer = setTimeout(tick, POLL_MS)
  }

  function start() {
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
}
