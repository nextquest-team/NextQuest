<script setup lang="ts">
import type { TimelineGameDTO } from '~/types/timeline'
import type { CatalogPreview } from '~/types/game'

const props = defineProps<{ game: TimelineGameDTO; followed: boolean }>()
const emit = defineEmits<{ toggleFollow: [game: TimelineGameDTO] }>()

const { t } = useI18n()

const releaseLabel = computed(() => {
  if (props.game.releaseDate) {
    return new Date(props.game.releaseDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  }
  if (props.game.releaseYear) return String(props.game.releaseYear)
  return t('timeline.releaseUnknown')
})

const genresLabel = computed(() => props.game.genres.slice(0, 2).map(g => g.name).join(' · '))

function onToggleFollow(e: Event) {
  e.stopPropagation()
  emit('toggleFollow', props.game)
}

const catalogPreview = useState<CatalogPreview | null>('catalog-preview', () => null)

function goToDetail() {
  catalogPreview.value = {
    igdbId: props.game.igdbId,
    title: props.game.title,
    coverUrl: props.game.coverUrl,
    releaseDate: props.game.releaseDate,
    releaseStatus: 'upcoming',
    hypes: props.game.hypes,
    genres: props.game.genres,
    platforms: props.game.platforms,
  }
  navigateTo(`/games/catalog/${props.game.igdbId}`)
}
</script>

<template>
  <div
    class="tlg-card"
    role="link"
    tabindex="0"
    :aria-label="game.title"
    @click="goToDetail"
    @keydown.enter.self="goToDetail"
  >
    <div class="tlg-card__cover">
      <img
        v-if="game.coverUrl"
        :src="game.coverUrl"
        :alt="game.title"
        class="tlg-card__cover-img"
      />
      <div v-else class="tlg-card__cover-placeholder">
        <v-icon size="40" color="primary-light">mdi-gamepad-variant</v-icon>
      </div>
    </div>

    <div class="tlg-card__body">
      <p class="tlg-card__title" :title="game.title">{{ game.title }}</p>

      <div class="tlg-card__meta">
        <span class="tlg-card__meta-item">
          <v-icon size="14">mdi-calendar-outline</v-icon>
          {{ releaseLabel }}
        </span>
        <span v-if="game.hypes" class="tlg-card__meta-item">
          <v-icon size="14">mdi-fire</v-icon>
          {{ game.hypes }}
        </span>
      </div>

      <p v-if="genresLabel" class="tlg-card__genres">{{ genresLabel }}</p>
    </div>

    <button
      class="tlg-card__follow"
      :class="{ 'tlg-card__follow--active': followed }"
      :aria-pressed="followed"
      :aria-label="followed ? t('timeline.unfollow') : t('timeline.follow')"
      :title="followed ? t('timeline.unfollow') : t('timeline.follow')"
      @click="onToggleFollow"
    >
      <v-icon size="20">{{ followed ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
    </button>
  </div>
</template>

<style scoped>
.tlg-card {
  display: flex;
  align-items: stretch;
  background: var(--nq-cream, #F8F4EA);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(var(--nq-brown-dark-rgb), 0.08);
  overflow: hidden;
  transition: box-shadow 0.15s, transform 0.15s;
  position: relative;
  min-height: 110px;
  cursor: pointer;
}

.tlg-card:hover {
  box-shadow: 0 4px 16px rgba(var(--nq-brown-dark-rgb), 0.16);
  transform: translateY(-2px);
}

.tlg-card:focus-visible {
  outline: 3px solid var(--nq-focus);
  outline-offset: 2px;
}

.tlg-card__cover {
  flex-shrink: 0;
  width: 88px;
  background: rgba(var(--nq-brown-rgb), 0.08);
}

.tlg-card__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tlg-card__cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tlg-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 12px 40px 12px 12px;
  min-width: 0;
}

.tlg-card__title {
  font-family: var(--nq-font);
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tlg-card__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.78rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
}

.tlg-card__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.tlg-card__genres {
  font-size: 0.78rem;
  font-style: italic;
  color: rgba(var(--nq-brown-dark-rgb), 0.55);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tlg-card__follow {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: rgba(var(--nq-brown-rgb), 0.45);
  transition: color 0.1s, background 0.1s;
}

.tlg-card__follow:hover { color: var(--nq-brown); background: rgba(var(--nq-brown-rgb), 0.1); }
.tlg-card__follow--active { color: var(--nq-gold-dark, #C8860A); }
</style>
