<script setup lang="ts">
import type { ToastType } from '~/composables/useToast'

const { toasts, dismiss } = useToast()

const icons: Record<ToastType, string> = {
  success: 'mdi-check-circle',
  error: 'mdi-alert-circle',
  info: 'mdi-information',
}
</script>

<template>
  <div class="app-toast" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="app-toast">
      <button
        v-for="toast in toasts"
        :key="toast.id"
        type="button"
        class="app-toast__item"
        :class="`app-toast__item--${toast.type}`"
        @click="dismiss(toast.id)"
      >
        <v-icon size="16">{{ icons[toast.type] }}</v-icon>
        <span class="app-toast__text">{{ toast.text }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.app-toast {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 300; /* au-dessus des modales (.gl-modal backdrop = 200) */
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(360px, calc(100vw - 2rem));
}

.app-toast__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  text-align: left;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(58, 26, 10, 0.18);
}

/* Memes teintes que les messages inline du game-list, plus une variante info. */
.app-toast__item--success { background: #d4edda; color: #1a5c2a; }
.app-toast__item--error { background: #fdebc8; color: #7a4a00; }
.app-toast__item--info { background: #d6ecff; color: #0a4a8c; }

.app-toast__text { line-height: 1.35; }

.app-toast-enter-active,
.app-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
