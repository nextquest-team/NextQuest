<script setup lang="ts">
import type { RecoGame } from '~/types/recommendations'

definePageMeta({ ssr: false })

const { t } = useI18n()

const game = useState<RecoGame | null>('catalog-preview', () => null)

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
}

function ratingStars(rating: number | null): string {
  if (rating === null) return ''
  const r = Math.round(rating / 2)
  return '★'.repeat(Math.min(r, 5)) + '☆'.repeat(Math.max(0, 5 - r))
}
</script>

<template>
  <div class="cd">
    <UiPageHeader />

    <div v-if="!game" class="cd__not-found">
      <v-icon size="56" color="#a07850">mdi-help-circle-outline</v-icon>
      <p class="cd__nf-title">{{ t('gameDetail.notFound') }}</p>
      <p class="cd__nf-hint">{{ t('gameDetail.notFoundHint') }}</p>
    </div>

    <template v-else>
      <!-- Hero : cover + titre -->
      <div class="cd__hero">
        <div class="cd__cover">
          <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" class="cd__cover-img" />
          <div v-else class="cd__cover-ph">
            <v-icon size="56" color="#a07850">mdi-gamepad-variant</v-icon>
          </div>
        </div>

        <div class="cd__hero-info">
          <h1 class="cd__title">{{ game.title }}</h1>

          <!-- Note IGDB -->
          <div v-if="game.igdbRating !== null" class="cd__rating">
            <span class="cd__rating-stars">{{ ratingStars(game.igdbRating) }}</span>
            <span class="cd__rating-num">{{ (game.igdbRating / 10).toFixed(1) }}/10</span>
          </div>

          <!-- Date de sortie -->
          <dl v-if="game.releaseDate || game.genres.length" class="cd__meta">
            <template v-if="game.releaseDate">
              <dt class="cd__dt">{{ t('gameDetail.releaseDate') }}</dt>
              <dd class="cd__dd">{{ formatDate(game.releaseDate) }}</dd>
            </template>
            <template v-if="game.genres.length">
              <dt class="cd__dt">{{ t('gameDetail.genres') }}</dt>
              <dd class="cd__dd">
                <span v-for="g in game.genres" :key="g.id" class="cd__chip">{{ g.name }}</span>
              </dd>
            </template>
          </dl>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cd {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1rem 3rem;
  font-family: var(--nq-font);
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.cd__not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  padding: 3rem 1rem;
}

.cd__nf-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.cd__nf-hint {
  font-size: 0.9rem;
  color: rgba(58, 26, 10, 0.6);
  margin: 0;
}

/* ── Hero ── */
.cd__hero {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
  margin-bottom: 1.75rem;
}

.cd__cover {
  flex-shrink: 0;
  width: 140px;
  min-height: 190px;
  background: rgba(92, 51, 23, 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cd__cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cd__cover-ph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 190px;
}

.cd__hero-info {
  flex: 1;
  min-width: 0;
}

.cd__title {
  font-size: clamp(1.2rem, 3.5vw, 1.6rem);
  font-weight: bold;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0 0 0.75rem;
  line-height: 1.25;
}

.cd__rating {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 1rem;
}

.cd__rating-stars {
  color: #c8860a;
  font-size: 0.9rem;
}

.cd__rating-num {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--nq-brown-dark, #3A1A0A);
}

/* ── Meta DL ── */
.cd__meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 16px;
  margin: 0;
}

.cd__dt {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(58, 26, 10, 0.5);
  white-space: nowrap;
  align-self: start;
  padding-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cd__dd {
  font-size: 0.875rem;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.cd__chip {
  display: inline-block;
  background: rgba(92, 51, 23, 0.08);
  color: var(--nq-brown, #5C3317);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.78rem;
  font-weight: 600;
}

@media (max-width: 480px) {
  .cd__hero { flex-direction: column; }
  .cd__cover { width: 100%; min-height: 220px; }
}
</style>
