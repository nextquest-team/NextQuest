<script setup lang="ts">
import type { TimelineGameDTO } from '~/types/timeline'

const { t } = useI18n()

const { game, loading } = useGameCatalogDetail()
const followedStore = useFollowedGamesStore()

const lightboxIndex = ref<number | null>(null)

const isUpcoming = computed(() => game.value?.releaseStatus === 'upcoming')
const isFollowed = computed(() => game.value != null && followedStore.isFollowed(game.value.igdbId))

function onToggleFollow() {
  if (!game.value) return
  const g = game.value
  const dto: TimelineGameDTO = {
    igdbId: g.igdbId,
    title: g.title,
    releaseDate: g.releaseDate,
    coverUrl: g.coverUrl,
    hypes: g.hypes,
    genres: g.genres,
    platforms: g.platforms,
  }
  followedStore.toggleFollow(dto)
}

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
  <div class="cdd">
    <UiPageHeader />

    <div v-if="loading" class="cdd__not-found">
      <v-progress-circular :aria-label="t('common.loading')" indeterminate size="32" color="primary" />
    </div>

    <div v-else-if="!game" class="cdd__not-found">
      <v-icon size="56" color="primary-light">mdi-help-circle-outline</v-icon>
      <h1 class="cdd__nf-title">{{ t('gameDetail.notFound') }}</h1>
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
          <div class="cdd__title-row">
            <h1 class="cdd__title">{{ game.title }}</h1>
            <button
              v-if="isUpcoming"
              class="cdd__follow"
              :class="{ 'cdd__follow--active': isFollowed }"
              :aria-pressed="isFollowed"
              :aria-label="isFollowed ? t('timeline.unfollow') : t('timeline.follow')"
              :title="isFollowed ? t('timeline.unfollow') : t('timeline.follow')"
              @click="onToggleFollow"
            >
              <v-icon size="24">{{ isFollowed ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
            </button>
          </div>

          <div v-if="game.rating !== null" class="cdd__rating">
            <span class="cdd__rating-stars">{{ ratingStars(game.rating) }}</span>
            <span class="cdd__rating-num">{{ (game.rating / 10).toFixed(1) }}/10</span>
            <span v-if="game.ratingCount" class="cdd__rating-count">({{ game.ratingCount }})</span>
          </div>

          <p v-if="game.hypes" class="cdd__hype">
            <v-icon size="16">mdi-fire</v-icon>
            {{ game.hypes }}
          </p>
        </div>
      </div>

      <section v-if="game.summary" class="cdd__section">
        <h2 class="cdd__section-title">{{ t('gameDetail.summary') }}</h2>
        <p class="cdd__summary nq-felt-panel">{{ game.summary }}</p>
      </section>

      <section v-if="game.storyline && game.storyline !== game.summary" class="cdd__section">
        <h2 class="cdd__section-title">{{ t('gameDetail.storyline') }}</h2>
        <p class="cdd__summary nq-felt-panel">{{ game.storyline }}</p>
      </section>

      <section v-if="game.screenshots.length" class="cdd__section">
        <h2 class="cdd__section-title">{{ t('gameDetail.screenshots') }}</h2>
        <div class="cdd__screenshots">
          <img
            v-for="(url, i) in game.screenshots.slice(0, 6)"
            :key="i"
            :src="url"
            :alt="`${game.title} screenshot ${i + 1}`"
            class="cdd__screenshot"
            role="button"
            tabindex="0"
            :aria-label="t('gameDetail.screenshotOpen')"
            @click="lightboxIndex = i"
            @keydown.enter="lightboxIndex = i"
          />
        </div>
      </section>

      <section class="cdd__section">
        <dl class="cdd__meta nq-felt-panel">
          <template v-if="game.releaseDate">
            <dt class="cdd__dt">{{ t('gameDetail.releaseDate') }}</dt>
            <dd class="cdd__dd">{{ formatDate(game.releaseDate) }}</dd>
          </template>
          <template v-if="game.developer">
            <dt class="cdd__dt">{{ t('gameDetail.developer') }}</dt>
            <dd class="cdd__dd">{{ game.developer }}</dd>
          </template>
          <template v-if="game.publisher && game.publisher !== game.developer">
            <dt class="cdd__dt">{{ t('gameDetail.publisher') }}</dt>
            <dd class="cdd__dd">{{ game.publisher }}</dd>
          </template>
          <template v-if="game.genres.length">
            <dt class="cdd__dt">{{ t('gameDetail.genres') }}</dt>
            <dd class="cdd__dd">
              <span v-for="g in game.genres" :key="g.igdbId" class="cdd__chip">{{ g.name }}</span>
            </dd>
          </template>
          <template v-if="game.themes.length">
            <dt class="cdd__dt">{{ t('gameDetail.tags') }}</dt>
            <dd class="cdd__dd">
              <span v-for="th in game.themes" :key="th.igdbId" class="cdd__chip cdd__chip--tag">{{ th.name }}</span>
            </dd>
          </template>
          <template v-if="game.platforms.length">
            <dt class="cdd__dt">{{ t('gameDetail.platforms') }}</dt>
            <dd class="cdd__dd">
              <span v-for="p in game.platforms" :key="p.igdbId" class="cdd__chip cdd__chip--platform">
                {{ p.abbreviation ?? p.name }}
              </span>
            </dd>
          </template>
          <template v-if="game.gameModes.length">
            <dt class="cdd__dt">{{ t('gameDetail.gameModes') }}</dt>
            <dd class="cdd__dd">
              <span v-for="m in game.gameModes" :key="m.igdbId" class="cdd__chip cdd__chip--tag">{{ m.name }}</span>
            </dd>
          </template>
        </dl>
      </section>

      <section v-if="game.similarGames.length" class="cdd__section">
        <h2 class="cdd__section-title">{{ t('gameDetail.similarGames') }}</h2>
        <div class="cdd__similar">
          <NuxtLink
            v-for="sim in game.similarGames"
            :key="sim.igdbId"
            :to="`/games/catalog/${sim.igdbId}`"
            class="cdd__similar-item"
          >
            <div class="cdd__similar-cover">
              <img v-if="sim.coverUrl" :src="sim.coverUrl" :alt="sim.title" />
              <v-icon v-else size="24" color="primary-light">mdi-gamepad-variant</v-icon>
            </div>
            <div class="cdd__similar-title nq-felt-panel">
              <span class="cdd__similar-title-text">{{ sim.title }}</span>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>

    <UiScreenshotModal
      v-if="game"
      :screenshots="game.screenshots"
      :index="lightboxIndex"
      :alt="game.title"
      @update:index="lightboxIndex = $event"
    />
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
.cdd__nf-hint  { font-size: 0.9rem; color: rgba(var(--nq-brown-dark-rgb), 0.65); margin: 0; }

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

.cdd__title-row { display: flex; align-items: flex-start; gap: 0.5rem; margin: 0 0 0.75rem; }

.cdd__title { font-size: clamp(1.2rem, 3.5vw, 1.6rem); font-weight: bold; color: var(--nq-brown-dark, #3A1A0A); margin: 0; line-height: 1.25; }

.cdd__follow {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 6px;
  color: rgba(var(--nq-brown-rgb), 0.45);
  transition: color 0.1s, background 0.1s;
}
.cdd__follow:hover { color: var(--nq-brown); background: rgba(var(--nq-brown-rgb), 0.1); }
.cdd__follow--active { color: var(--nq-gold-dark, #C8860A); }

.cdd__rating { display: flex; align-items: center; gap: 6px; margin-bottom: 0.5rem; }
.cdd__rating-stars { color: var(--nq-gold-dark); font-size: 0.9rem; }
.cdd__rating-num { font-weight: 700; font-size: 0.95rem; color: var(--nq-brown-dark); }
.cdd__rating-count { font-size: 0.8rem; color: rgba(var(--nq-brown-dark-rgb), 0.72); }

.cdd__hype {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  margin: 0 0 1rem;
}

.cdd__section { margin-bottom: 1.75rem; }

.cdd__section-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(var(--nq-brown-dark-rgb), 0.75);
  margin: 0 0 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid rgba(var(--nq-brown-rgb), 0.1);
}

.cdd__summary { font-size: 0.9rem; line-height: 1.65; color: rgba(var(--nq-brown-dark-rgb), 0.85); margin: 0; }

.cdd__meta { display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; margin: 0; }

.cdd__dt {
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(var(--nq-brown-dark-rgb), 0.72);
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
.cdd__chip--tag      { background: rgba(var(--nq-brown-rgb), 0.04); font-weight: 400; color: rgba(var(--nq-brown-dark-rgb), 0.72); }
.cdd__chip--platform { background: rgba(26, 47, 72, 0.07); color: var(--nq-navy); font-weight: 500; }

.cdd__screenshots { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
.cdd__screenshots::-webkit-scrollbar { display: none; }

.cdd__screenshot { flex-shrink: 0; width: 220px; height: 124px; border-radius: 8px; object-fit: cover; background: rgba(var(--nq-brown-rgb), 0.08); cursor: pointer; }
.cdd__screenshot:hover { filter: brightness(0.92); }

.cdd__similar { display: flex; gap: 12px; flex-wrap: wrap; align-items: stretch; }

.cdd__similar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 80px;
  text-decoration: none;
  cursor: pointer;
}
.cdd__similar-item:hover .cdd__similar-title-text { color: var(--nq-brown-dark); }
.cdd__similar-item:hover .cdd__similar-cover { box-shadow: 0 0 0 2px rgba(var(--nq-brown-rgb), 0.3); }

.cdd__similar-cover { width: 80px; height: 106px; flex-shrink: 0; border-radius: 8px; background: rgba(var(--nq-brown-rgb), 0.08); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.cdd__similar-cover img { width: 100%; height: 100%; object-fit: cover; }

/* flex:1 + align-items:stretch sur .cdd__similar font que chaque tuile occupe
   toute la hauteur de sa rangee (calee sur le titre le plus long) */
.cdd__similar-title {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background-size: auto, 90px 90px;
  padding: 4px 6px;
}

.cdd__similar-title-text {
  font-size: 0.7rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.7);
  text-align: center;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
