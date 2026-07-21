<script setup lang="ts">
import type { GameStatus, UserGame } from '~/types/game'

const props = withDefaults(
  defineProps<{ game: UserGame; view?: 'library' | 'ignored' }>(),
  { view: 'library' },
)
const emit = defineEmits<{
  statusChange: [id: string, status: GameStatus]
  ignore: [id: string]
  restore: [id: string]
  click: [userGameId: string]
}>()

const { t } = useI18n()

const STATUSES: { key: GameStatus; icon: string }[] = [
  { key: 'backlog',   icon: 'mdi-bookmark-outline' },
  { key: 'playing',  icon: 'mdi-play-circle-outline' },
  { key: 'completed', icon: 'mdi-check-circle-outline' },
  { key: 'abandoned', icon: 'mdi-close-circle-outline' },
]

function onStatusClick(e: Event, status: GameStatus) {
  e.stopPropagation()
  if (status !== props.game.status) {
    emit('statusChange', props.game.id, status)
  }
}

function onIgnore(e: Event) {
  e.stopPropagation()
  emit('ignore', props.game.id)
}

function onRestore(e: Event) {
  e.stopPropagation()
  emit('restore', props.game.id)
}
</script>

<template>
  <div class="gl-card">

    <!-- Cover : cliquable mais masquée des AT (le titre est le point d'entrée navigation) -->
    <button
      class="gl-card__cover"
      tabindex="-1"
      aria-hidden="true"
      @click="emit('click', game.id)"
    >
      <img
        v-if="game.coverUrl"
        :src="game.coverUrl"
        :alt="game.title"
        class="gl-card__cover-img"
      />
      <div v-else class="gl-card__cover-placeholder">
        <v-icon size="40" color="#a07850">mdi-gamepad-variant</v-icon>
      </div>
    </button>

    <!-- Infos -->
    <div class="gl-card__body">
      <!-- Titre → navigation -->
      <button class="gl-card__title" :title="game.title" @click="emit('click', game.id)">
        {{ game.title }}
      </button>

      <!-- Statuts — boutons (desktop) -->
      <div class="gl-card__statuses">
        <button
          v-for="s in STATUSES"
          :key="s.key"
          class="gl-card__status-btn"
          :class="{ 'gl-card__status-btn--active': game.status === s.key }"
          :title="t(`gameList.status.${s.key}`)"
          :aria-label="t(`gameList.status.${s.key}`)"
          :aria-pressed="game.status === s.key"
          @click="onStatusClick($event, s.key)"
        >
          <v-icon size="16">{{ s.icon }}</v-icon>
          <span class="gl-card__status-label">{{ t(`gameList.status.${s.key}`) }}</span>
        </button>
      </div>

      <!-- Statut — select (mobile) -->
      <div class="gl-card__status-select-wrap" @click.stop>
        <select
          class="gl-card__status-select"
          :value="game.status"
          :aria-label="t('gameList.status.label')"
          @change="emit('statusChange', game.id, ($event.target as HTMLSelectElement).value as GameStatus)"
        >
          <option v-for="s in STATUSES" :key="s.key" :value="s.key">
            {{ t(`gameList.status.${s.key}`) }}
          </option>
        </select>
      </div>
    </div>

    <!-- Action : ignorer (bibliotheque) ou remettre (ignores) -->
    <button
      v-if="view === 'ignored'"
      class="gl-card__action gl-card__action--restore"
      :aria-label="t('gameList.restore')"
      :title="t('gameList.restore')"
      @click="onRestore"
    >
      <v-icon size="18">mdi-backup-restore</v-icon>
    </button>
    <button
      v-else
      class="gl-card__action gl-card__action--ignore"
      :aria-label="t('gameList.ignore')"
      :title="t('gameList.ignore')"
      @click="onIgnore"
    >
      <v-icon size="18">mdi-eye-off-outline</v-icon>
    </button>

  </div>
</template>

<style scoped>
.gl-card {
  display: flex;
  align-items: stretch;
  background: var(--nq-cream, #F8F4EA);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(58, 26, 10, 0.08);
  overflow: hidden;
  transition: box-shadow 0.15s, transform 0.15s;
  position: relative;
  min-height: 110px;
}

.gl-card:hover {
  box-shadow: 0 4px 16px rgba(58, 26, 10, 0.16);
  transform: translateY(-2px);
}

.gl-card__cover:focus-visible,
.gl-card__title:focus-visible {
  outline: 2px solid var(--nq-brown, #5C3317);
  outline-offset: 2px;
}

/* ── Cover (button reset) ── */
.gl-card__cover {
  flex-shrink: 0;
  width: 88px;
  background: rgba(92, 51, 23, 0.08);
  border: none;
  padding: 0;
  cursor: pointer;
  display: block;
}

.gl-card__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gl-card__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Body ── */
.gl-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 12px 8px 12px 12px;
  min-width: 0;
}

.gl-card__title {
  font-family: var(--nq-font);
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* button reset */
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  width: 100%;
  display: block;
}

/* ── Statuts ── */
.gl-card__statuses {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.gl-card__status-select-wrap { display: none; }

.gl-card__status-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid rgba(92, 51, 23, 0.25);
  background: transparent;
  color: rgba(58, 26, 10, 0.6);
  font-family: var(--nq-font);
  font-size: 0.65rem;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  min-height: 26px;
}

.gl-card__status-btn:hover:not(.gl-card__status-btn--active) {
  background: rgba(92, 51, 23, 0.08);
  color: var(--nq-brown-dark, #3A1A0A);
}

.gl-card__status-btn--active {
  background: var(--nq-brown, #5C3317);
  color: #edc78e;
  border-color: var(--nq-brown, #5C3317);
}

/* ── Select mobile ── */
.gl-card__status-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  padding: 5px 28px 5px 10px;
  border-radius: 8px;
  border: 1px solid rgba(92, 51, 23, 0.3);
  background: rgba(92, 51, 23, 0.06) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235C3317' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 9px center;
  color: var(--nq-brown-dark, #3A1A0A);
  font-family: var(--nq-font);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  min-height: 30px;
}

.gl-card__status-select:focus {
  outline: 2px solid var(--nq-brown, #5C3317);
  outline-offset: 1px;
}

@media (max-width: 480px) {
  .gl-card__statuses { display: none; }
  .gl-card__status-select-wrap { display: block; }
}

/* ── Action (ignorer / remettre) ── */
.gl-card__action {
  flex-shrink: 0;
  align-self: flex-start;
  margin: 10px 10px 0 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.1s, background 0.1s;
}

.gl-card__action--ignore { color: rgba(92, 51, 23, 0.45); }
.gl-card__action--ignore:hover { color: var(--nq-brown, #5C3317); background: rgba(92, 51, 23, 0.1); }
.gl-card__action--restore { color: var(--nq-brown, #5C3317); }
.gl-card__action--restore:hover { color: var(--nq-brown-dark, #3A1A0A); background: rgba(92, 51, 23, 0.12); }
</style>
