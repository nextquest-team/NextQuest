<script setup lang="ts">
const { t } = useI18n()

const { game, loading } = useGameCatalogDetail()

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
  <div class="cdd">
    <UiPageHeader />

    <div v-if="loading" class="cdd__not-found">
      <v-progress-circular indeterminate size="32" color="primary" />
    </div>

    <div v-else-if="!game" class="cdd__not-found">
      <v-icon size="56" color="primary-light">mdi-help-circle-outline</v-icon>
      <p class="cdd__nf-title">{{ t('gameDetail.notFound') }}</p>
      <p class="cdd__nf-hint">{{ t('gameDetail.notFoundHint') }}</p>
    </div>

    <template v-else-if="game">
      <div class="cdd__hero">
        <div class="cdd__cover">
          <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" class="cdd__cover-img" />
          <div v-else class="cdd__cover-ph">
            <v-icon size="56" color="primary-light">mdi-gamepad-variant</v-icon>
          </div>
        </div>

        <div class="cdd__hero-info">
          <h1 class="cdd__title">{{ game.title }}</h1>

          <div v-if="game.igdbRating !== null" class="cdd__rating">
            <span class="cdd__rating-stars">{{ ratingStars(game.igdbRating) }}</span>
            <span class="cdd__rating-num">{{ (game.igdbRating / 10).toFixed(1) }}/10</span>
          </div>

          <dl v-if="game.releaseDate || game.genres.length" class="cdd__meta">
            <template v-if="game.releaseDate">
              <dt class="cdd__dt">{{ t('gameDetail.releaseDate') }}</dt>
              <dd class="cdd__dd">{{ formatDate(game.releaseDate) }}</dd>
            </template>
            <template v-if="game.genres.length">
              <dt class="cdd__dt">{{ t('gameDetail.genres') }}</dt>
              <dd class="cdd__dd">
                <span v-for="g in game.genres" :key="g.id" class="cdd__chip">{{ g.name }}</span>
              </dd>
            </template>
          </dl>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cdd {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1rem 3rem;
  font-family: var(--nq-font);
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
}

.cdd__not-found {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  padding: 3rem 1rem;
}

.cdd__nf-title { font-size: 1.1rem; font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; }
.cdd__nf-hint  { font-size: 0.9rem; color: rgba(var(--nq-brown-dark-rgb), 0.6); margin: 0; }

.cdd__hero { display: flex; gap: 1.25rem; align-items: flex-start; margin-bottom: 1.75rem; }

.cdd__cover {
  flex-shrink: 0;
  width: 140px;
  min-height: 190px;
  background: rgba(var(--nq-brown-rgb), 0.08);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cdd__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cdd__cover-ph  { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 190px; }

.cdd__hero-info { flex: 1; min-width: 0; }

.cdd__title { font-size: clamp(1.2rem, 3.5vw, 1.6rem); font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0 0 0.75rem; line-height: 1.25; }

.cdd__rating { display: flex; align-items: center; gap: 6px; margin-bottom: 1rem; }
.cdd__rating-stars { color: var(--nq-gold-dark); font-size: 0.9rem; }
.cdd__rating-num { font-weight: 700; font-size: 0.95rem; color: var(--nq-brown-dark); }

.cdd__meta { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 0; }

.cdd__dt {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  white-space: nowrap;
  align-self: start;
  padding-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cdd__dd { font-size: 0.875rem; color: var(--nq-brown-dark); margin: 0; display: flex; flex-wrap: wrap; gap: 4px; }

.cdd__chip {
  display: inline-block;
  background: rgba(var(--nq-brown-rgb), 0.08);
  color: var(--nq-brown, #5C3317);
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.78rem;
  font-weight: 600;
}
</style>
