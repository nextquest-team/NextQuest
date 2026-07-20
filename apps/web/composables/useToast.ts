import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  type: ToastType
  text: string
}

// File de toasts partagee au niveau module : n'importe quel composable ou
// composant peut pousser un message, un unique <AppToast> les affiche.
const toasts = ref<Toast[]>([])
let nextId = 0

const DEFAULT_TIMEOUT = 4000

export function useToast() {
  function push(t: { type: ToastType; text: string; timeout?: number }): number {
    const id = ++nextId
    toasts.value = [...toasts.value, { id, type: t.type, text: t.text }]
    const timeout = t.timeout ?? DEFAULT_TIMEOUT
    // timeout <= 0 : toast persistant (l'utilisateur le ferme au clic).
    if (timeout > 0) {
      setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  return { toasts, push, dismiss }
}

// Reinitialise la file (tests).
export function __resetToasts() {
  toasts.value = []
  nextId = 0
}
