import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Piege le focus dans une modale tant qu'elle est ouverte (WCAG 2.4.3) :
// - Tab/Shift+Tab bouclent entre le premier et le dernier element focusable
// - focus pose sur le premier element a l'ouverture, sauf si un element du
//   conteneur a deja le focus (ex: input avec autofocus natif)
// - focus restaure sur l'element qui l'avait avant l'ouverture (typiquement
//   le bouton qui a declenche la modale) a la fermeture
// - Echap declenche le callback fourni (fermeture ou mise en arriere-plan
//   selon la modale, cf GameListAddModal / GameListImportProgressModal)
export function useFocusTrap(
  containerRef: Ref<HTMLElement | null | undefined>,
  isOpen: () => boolean,
  onEscape: () => void,
) {
  let previouslyFocused: HTMLElement | null = null

  function focusableElements(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onEscape()
      return
    }
    if (e.key !== 'Tab') return
    const items = focusableElements()
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  watch(
    isOpen,
    async (open) => {
      if (open) {
        previouslyFocused = document.activeElement as HTMLElement | null
        document.addEventListener('keydown', onKeydown)
        await nextTick()
        const container = containerRef.value
        if (container && !container.contains(document.activeElement)) {
          focusableElements()[0]?.focus()
        }
      } else {
        document.removeEventListener('keydown', onKeydown)
        previouslyFocused?.focus()
        previouslyFocused = null
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}
