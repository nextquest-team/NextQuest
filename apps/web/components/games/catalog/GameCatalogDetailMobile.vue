<script setup lang="ts">
const { t } = useI18n()

const { game, loading } = useGameCatalogDetail()

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function ratingStars(rating: number | null): string {
  if (rating === null) return ''
  const r = Math.round(rating / 20)
  return '★'.repeat(Math.min(r, 5)) + '☆'.repeat(Math.max(0, 5 - r))
}
</script>

<template>
  <div class="cdm">

    <!-- ── Header fixe ── -->
    <div class="cdm__head">
      <UiPageHeader />
    </div>

    <!-- ── Zone scrollable ── -->
    <div class="cdm__body">

      <div v-if="loading" class="cdm__not-found">
        <v-progress-circular :aria-label="t('common.loading')" indeterminate size="32" color="primary" />
      </div>

      <div v-else-if="!game" class="cdm__not-found">
        <v-icon size="52" color="primary-light">mdi-help-circle-outline</v-icon>
        <h1 class="cdm__nf-title">{{ t('gameDetail.notFound') }}</h1>
        <p class="cdm__nf-hint">{{ t('gameDetail.notFoundHint') }}</p>
      </div>

      <template v-else-if="game">
        <!-- Cover pleine largeur -->
        <div class="cdm__cover">
          <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" class="cdm__cover-img" />
          <div v-else class="cdm__cover-ph">
            <v-icon size="48" color="primary-light">mdi-gamepad-variant</v-icon>
          </div>
        </div>

        <div class="cdm__hero-info">
          <h1 class="cdm__title">{{ game.title }}</h1>

          <!-- Note IGDB -->
          <div v-if="game.rating !== null" class="cdm__rating">
            <span class="cdm__rating-stars">{{ ratingStars(game.rating) }}</span>
            <span class="cdm__rating-num">{{ (game.rating / 10).toFixed(1) }}/10</span>
            <span v-if="game.ratingCount" class="cdm__rating-count">({{ game.ratingCount }})</span>
          </div>

          <p v-if="game.hypes" class="cdm__hype">
            <v-icon size="15">mdi-fire</v-icon>
            {{ game.hypes }}
          </p>
        </div>

        <!-- Synopsis -->
        <section v-if="game.summary" class="cdm__section">
          <h2 class="cdm__section-title">{{ t('gameDetail.summary') }}</h2>
          <p class="cdm__summary">{{ game.summary }}</p>
        </section>

        <!-- Storyline -->
        <section v-if="game.storyline && game.storyline !== game.summary" class="cdm__section">
          <h2 class="cdm__section-title">{{ t('gameDetail.storyline') }}</h2>
          <p class="cdm__summary">{{ game.storyline }}</p>
        </section>

        <!-- Screenshots -->
        <section v-if="game.screenshots.length" class="cdm__section">
          <h2 class="cdm__section-title">{{ t('gameDetail.screenshots') }}</h2>
          <div class="cdm__screenshots">
            <img
              v-for="(url, i) in game.screenshots.slice(0, 6)"
              :key="i"
              :src="url"
              :alt="`${game.title} screenshot ${i + 1}`"
              class="cdm__screenshot"
            />
          </div>
        </section>

        <!-- Infos meta -->
        <section class="cdm__section">
          <dl class="cdm__meta">
            <template v-if="game.releaseDate">
              <dt class="cdm__dt">{{ t('gameDetail.releaseDate') }}</dt>
              <dd class="cdm__dd">{{ formatDate(game.releaseDate) }}</dd>
            </template>
            <template v-if="game.developer">
              <dt class="cdm__dt">{{ t('gameDetail.developer') }}</dt>
              <dd class="cdm__dd">{{ game.developer }}</dd>
            </template>
            <template v-if="game.publisher && game.publisher !== game.developer">
              <dt class="cdm__dt">{{ t('gameDetail.publisher') }}</dt>
              <dd class="cdm__dd">{{ game.publisher }}</dd>
            </template>
            <template v-if="game.genres.length">
              <dt class="cdm__dt">{{ t('gameDetail.genres') }}</dt>
              <dd class="cdm__dd">
                <span v-for="g in game.genres" :key="g.igdbId" class="cdm__chip">{{ g.name }}</span>
              </dd>
            </template>
            <template v-if="game.themes.length">
              <dt class="cdm__dt">{{ t('gameDetail.tags') }}</dt>
              <dd class="cdm__dd">
                <span v-for="th in game.themes" :key="th.igdbId" class="cdm__chip cdm__chip--tag">{{ th.name }}</span>
              </dd>
            </template>
            <template v-if="game.platforms.length">
              <dt class="cdm__dt">{{ t('gameDetail.platforms') }}</dt>
              <dd class="cdm__dd">
                <span v-for="p in game.platforms" :key="p.igdbId" class="cdm__chip cdm__chip--platform">
                  {{ p.abbreviation ?? p.name }}
                </span>
              </dd>
            </template>
            <template v-if="game.gameModes.length">
              <dt class="cdm__dt">{{ t('gameDetail.gameModes') }}</dt>
              <dd class="cdm__dd">
                <span v-for="m in game.gameModes" :key="m.igdbId" class="cdm__chip cdm__chip--tag">{{ m.name }}</span>
              </dd>
            </template>
          </dl>
        </section>

        <!-- Jeux similaires -->
        <section v-if="game.similarGames.length" class="cdm__section">
          <h2 class="cdm__section-title">{{ t('gameDetail.similarGames') }}</h2>
          <div class="cdm__similar">
            <div v-for="sim in game.similarGames" :key="sim.igdbId" class="cdm__similar-item">
              <div class="cdm__similar-cover">
                <img v-if="sim.coverUrl" :src="sim.coverUrl" :alt="sim.title" />
                <v-icon v-else size="20" color="primary-light">mdi-gamepad-variant</v-icon>
              </div>
              <span class="cdm__similar-title">{{ sim.title }}</span>
            </div>
          </div>
        </section>
      </template>

    </div>
  </div>
</template>

<style scoped>
.cdm {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px);
  overflow: hidden;
  font-family: var(--nq-font);
}

.cdm__head { flex-shrink: 0; padding: 0 1rem; }

.cdm__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 1rem 1.5rem;
}

.cdm__not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.cdm__nf-title { font-size: 1rem; font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; }
.cdm__nf-hint  { font-size: 0.85rem; color: rgba(var(--nq-brown-dark-rgb), 0.6); margin: 0; }

/* Cover pleine largeur */
.cdm__cover {
  width: calc(100% + 2rem);
  margin-left: -1rem;
  margin-right: -1rem;
  height: 220px;
  background: rgba(var(--nq-brown-rgb), 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.cdm__cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cdm__cover-ph  { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }

.cdm__hero-info { padding-bottom: 1rem; }

.cdm__title { font-size: clamp(1.2rem, 5vw, 1.5rem); font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0 0 0.5rem; line-height: 1.25; }

.cdm__rating { display: flex; align-items: center; gap: 6px; margin-bottom: 0.5rem; }
.cdm__rating-stars { color: var(--nq-gold-dark); font-size: 0.85rem; }
.cdm__rating-num { font-weight: 700; font-size: 0.9rem; color: var(--nq-brown-dark); }
.cdm__rating-count { font-size: 0.75rem; color: rgba(var(--nq-brown-dark-rgb), 0.55); }

.cdm__hype {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin: 0 0 0.85rem;
}

.cdm__meta { display: grid; grid-template-columns: auto 1fr; gap: 7px 14px; margin: 0; }

.cdm__dt {
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  white-space: nowrap;
  align-self: start;
  padding-top: 2px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cdm__dd { font-size: 0.82rem; color: var(--nq-brown-dark); margin: 0; display: flex; flex-wrap: wrap; gap: 4px; }

.cdm__chip {
  display: inline-block;
  background: rgba(var(--nq-brown-rgb), 0.08);
  color: var(--nq-brown, #5C3317);
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.72rem;
  font-weight: 600;
}
.cdm__chip--tag      { background: rgba(var(--nq-brown-rgb), 0.04); font-weight: 400; color: rgba(var(--nq-brown-dark-rgb), 0.6); }
.cdm__chip--platform { background: rgba(26, 47, 72, 0.07); color: var(--nq-navy); font-weight: 500; }

/* ── Sections ── */
.cdm__section { margin-bottom: 1.5rem; }

.cdm__section-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--nq-brown-dark-rgb), 0.75);
  margin: 0 0 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.1);
}

.cdm__summary { font-size: 0.875rem; line-height: 1.65; color: rgba(var(--nq-brown-dark-rgb), 0.85); margin: 0; }

/* ── Screenshots ── */
.cdm__screenshots {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 4px;
  margin-left: -1rem;
  margin-right: -1rem;
  padding-left: 1rem;
  padding-right: 1rem;
}
.cdm__screenshots::-webkit-scrollbar { display: none; }

.cdm__screenshot { flex-shrink: 0; width: 200px; height: 113px; border-radius: 8px; object-fit: cover; background: rgba(var(--nq-brown-rgb), 0.08); }

/* ── Similaires ── */
.cdm__similar { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
.cdm__similar::-webkit-scrollbar { display: none; }

.cdm__similar-item { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 70px; flex-shrink: 0; }

.cdm__similar-cover {
  width: 70px;
  height: 93px;
  border-radius: 7px;
  background: rgba(var(--nq-brown-rgb), 0.08);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cdm__similar-cover img { width: 100%; height: 100%; object-fit: cover; }

.cdm__similar-title {
  font-size: 0.65rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  text-align: center;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
