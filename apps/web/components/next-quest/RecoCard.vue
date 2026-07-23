<script setup lang="ts">
import type { RecommendationDTO, FeedbackAction } from '~/types/recommendations'
import type { CatalogPreview } from '~/types/game'

const props = defineProps<{
  reco: RecommendationDTO | null
  bucket: 'discovery' | 'library_unplayed' | 'upcoming'
  feedbackPending: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  feedback: [reco: RecommendationDTO, action: FeedbackAction]
}>()

const { t } = useI18n()

const isMain = computed(() => props.bucket === 'discovery')

const catalogPreview = useState<CatalogPreview | null>('catalog-preview', () => null)

function goToGame() {
  if (!props.reco) return
  const g = props.reco.game
  catalogPreview.value = {
    igdbId: Number(g.id),
    title: g.title,
    coverUrl: g.coverUrl,
    releaseDate: g.releaseDate,
    releaseStatus: g.releaseStatus === 'upcoming' ? 'upcoming' : 'released',
    rating: g.igdbRating,
    genres: g.genres.map(genre => ({ igdbId: Number(genre.id), name: genre.name, slug: genre.slug })),
  }
  navigateTo(`/games/catalog/${g.id}`)
}

const badgeConfig = computed(() => ({
  discovery:       { icon: 'mdi-compass-rose',  labelKey: 'nextQuest.buckets.discovery',      cls: 'nq-card-badge--discovery' },
  library_unplayed: { icon: 'mdi-bookshelf',     labelKey: 'nextQuest.buckets.libraryUnplayed', cls: 'nq-card-badge--library'   },
  upcoming:        { icon: 'mdi-calendar-star',  labelKey: 'nextQuest.buckets.upcoming',        cls: 'nq-card-badge--upcoming'  },
}[props.bucket]))

const ctaConfig = computed(() => ({
  discovery:       { labelKey: 'nextQuest.actions.add',    icon: 'mdi-sword',        action: 'added'     as FeedbackAction },
  library_unplayed: { labelKey: 'nextQuest.actions.play',   icon: 'mdi-play',         action: 'liked'     as FeedbackAction },
  upcoming:        { labelKey: 'nextQuest.actions.remind', icon: 'mdi-bell-outline', action: 'liked'     as FeedbackAction },
}[props.bucket]))

const emptyIcon = computed(() => ({
  discovery:        'mdi-compass-rose',
  library_unplayed: 'mdi-bookshelf',
  upcoming:         'mdi-calendar-star',
}[props.bucket]))

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' })
}

function ratingStars(rating: number | null): string {
  if (rating === null) return ''
  const r = Math.round(rating / 20)
  return '★'.repeat(Math.min(r, 5)) + '☆'.repeat(Math.max(0, 5 - r))
}
</script>

<template>
  <!-- Slot vide -->
  <div v-if="!reco" class="nq-slot-empty" :class="{ 'nq-slot-empty--main': isMain && !compact }">
    <div class="nq-slot-empty-inner">
      <v-icon :size="isMain ? 28 : 24" color="rgba(var(--nq-brown-rgb), 0.4)">{{ emptyIcon }}</v-icon>
      <p>{{ t('nextQuest.noReco') }}</p>
    </div>
  </div>

  <!-- ── Card HERO (Découverte) — colonne : info → image → boutons ── -->
  <div v-else-if="isMain && !compact" class="nq-quest-card nq-quest-card--main">
    <div class="nq-card-badge nq-card-badge--discovery">
      <v-icon size="13">{{ badgeConfig.icon }}</v-icon>
      {{ t(badgeConfig.labelKey) }}
    </div>

    <div class="nq-hero-col">
      <!-- 1. Titre + tags + meta + raison -->
      <div class="nq-hero-top">
        <span role="link" tabindex="0" class="nq-card-title nq-card-title--hero nq-card-title--link" @click="goToGame()" @keydown.enter="goToGame()">{{ reco.game.title }}</span>

        <div class="nq-hero-details nq-felt-panel">
          <div v-if="reco.game.genres.length" class="nq-tags">
            <span v-for="g in reco.game.genres.slice(0, 3)" :key="g.id" class="nq-tag">{{ g.name }}</span>
          </div>

          <div class="nq-card-meta">
            <span v-if="reco.game.igdbRating" class="nq-rating">
              {{ ratingStars(reco.game.igdbRating) }}
              <span class="nq-rating__num">{{ (reco.game.igdbRating / 10).toFixed(1) }}/10</span>
            </span>
            <span v-if="reco.game.releaseDate" class="nq-date">
              <v-icon size="12">mdi-calendar</v-icon>
              {{ formatDate(reco.game.releaseDate) }}
            </span>
          </div>

          <p class="nq-card-reason">
            <v-icon size="12" color="primary-light">mdi-lightning-bolt</v-icon>
            {{ reco.reason.text }}
          </p>
        </div>
      </div>

      <!-- 2. Image — prend l'espace restant, cliquable vers la fiche -->
      <span role="link" tabindex="0" class="nq-hero-img" @click="goToGame()" @keydown.enter="goToGame()">
        <img v-if="reco.game.coverUrl" :src="reco.game.coverUrl" :alt="reco.game.title" />
        <div v-else class="nq-card-cover-ph">
          <v-icon size="40" color="primary-light">mdi-gamepad-variant</v-icon>
        </div>
      </span>

      <!-- 3. Boutons -->
      <div class="nq-card-actions nq-hero-actions">
        <button class="nq-quest-cta" :disabled="feedbackPending" @click="emit('feedback', reco, ctaConfig.action)">
          <v-icon size="15">{{ ctaConfig.icon }}</v-icon>
          {{ t(ctaConfig.labelKey) }}
        </button>
        <button class="nq-quest-dismiss" :disabled="feedbackPending" @click="emit('feedback', reco, 'dismissed')">
          {{ t('nextQuest.actions.dismiss') }}
        </button>
      </div>
    </div>
  </div>

  <!-- ── Card COMPACTE (Bibliothèque / À venir) ─────────── -->
  <div v-else class="nq-quest-card">
    <div class="nq-card-badge" :class="badgeConfig.cls">
      <v-icon size="11">{{ badgeConfig.icon }}</v-icon>
      {{ t(badgeConfig.labelKey) }}
    </div>

    <div class="nq-card-body">
      <span role="link" tabindex="0" class="nq-card-cover nq-card-cover--sm" @click="goToGame()" @keydown.enter="goToGame()">
        <img v-if="reco.game.coverUrl" :src="reco.game.coverUrl" :alt="reco.game.title" />
        <div v-else class="nq-card-cover-ph">
          <v-icon size="22" color="primary-light">mdi-gamepad-variant</v-icon>
        </div>
      </span>

      <div class="nq-card-info nq-card-info--sm">
        <span role="link" tabindex="0" class="nq-card-title nq-card-title--link" @click="goToGame()" @keydown.enter="goToGame()">{{ reco.game.title }}</span>

        <div class="nq-card-details nq-felt-panel">
          <div v-if="bucket !== 'upcoming' && reco.game.genres.length" class="nq-tags">
            <span v-for="g in reco.game.genres.slice(0, 2)" :key="g.id" class="nq-tag">{{ g.name }}</span>
          </div>

          <p v-if="bucket === 'upcoming' && reco.game.releaseDate" class="nq-date">
            <v-icon size="12">mdi-calendar</v-icon>
            {{ t('nextQuest.release') }} : {{ formatDate(reco.game.releaseDate) }}
          </p>

          <p class="nq-card-reason nq-card-reason--sm">{{ reco.reason.text }}</p>
        </div>

        <div class="nq-card-actions">
          <button class="nq-quest-cta nq-quest-cta--sm" :disabled="feedbackPending" @click="emit('feedback', reco, ctaConfig.action)">
            <v-icon size="13">{{ ctaConfig.icon }}</v-icon>
            {{ t(ctaConfig.labelKey) }}
          </button>
          <button class="nq-quest-dismiss nq-quest-dismiss--sm" :disabled="feedbackPending" @click="emit('feedback', reco, 'dismissed')">
            {{ t('nextQuest.actions.dismiss') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════
   QUEST CARD — bordure laine (même principe que patch-btn)
═══════════════════════════════════════════════════════ */
.nq-quest-card {
  display: flex;
  flex-direction: column;
  border: 20px solid transparent;
  border-image: url('/images/buttons/wooly-btn-final.png') 350 fill round;
  background: transparent;
  overflow: hidden;
}

.nq-quest-card--main { border-width: 24px; }

@media (min-width: 960px) {
  .nq-quest-card       { border-width: 14px; width: 100%; flex: 1; min-height: 0; }
  .nq-quest-card--main { border-width: 20px; flex: 1; min-height: 0; overflow: hidden; }
}

/* ═══════════════════════════════════════════════════════
   BADGE BUCKET
═══════════════════════════════════════════════════════ */
.nq-card-badge {
  padding: 5px 10px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid transparent;
}

.nq-card-badge--discovery { background: rgba(var(--nq-brown-rgb), 0.10);  color: var(--nq-brown); border-bottom-color: rgba(var(--nq-brown-rgb), 0.14); }
.nq-card-badge--library   { background: rgba(26,47,72,0.09);  color: var(--nq-navy); border-bottom-color: rgba(26,47,72,0.12); }
.nq-card-badge--upcoming  { background: rgba(40,65,40,0.09);  color: #284128; border-bottom-color: rgba(40,65,40,0.12); }

/* ═══════════════════════════════════════════════════════
   CORPS
═══════════════════════════════════════════════════════ */
.nq-card-body {
  display: flex;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
}

.nq-card-cover {
  flex-shrink: 0;
  align-self: flex-start;
  width: auto;
  max-width: 140px;
  max-height: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(var(--nq-brown-rgb), 0.06);
}

.nq-card-cover--sm { max-width: 110px; }

.nq-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.nq-card-cover-ph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nq-card-info {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nq-card-info--sm { gap: 4px; }

.nq-card-title {
  font-family: var(--nq-font);
  font-size: 1.1rem;
  font-weight: 700;
  color: #111;
  line-height: 1.2;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  letter-spacing: 0.01em;
}

.nq-quest-card--main .nq-card-title { font-size: 1.15rem; }

.nq-card-title--link {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}
.nq-card-title--link:hover { text-decoration: underline; }

.nq-hero-img[role="link"],
.nq-card-cover[role="link"] {
  cursor: pointer;
}

/* ── Desktop compact (cards secondaires) ── */
@media (min-width: 960px) {
  .nq-card-info      { gap: 3px; }
  .nq-quest-cta      { padding: 5px 9px; font-size: 0.78rem; gap: 4px; }
  .nq-quest-cta--sm  { padding: 4px 7px; font-size: 0.72rem; }
  .nq-quest-dismiss  { font-size: 0.7rem; padding: 4px 5px; }
}

.nq-card-meta {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  flex-wrap: wrap;
}

.nq-card-reason {
  font-size: 0.85rem;
  color: rgba(var(--nq-black-rgb), 0.65);
  font-style: italic;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.nq-card-reason--sm { font-size: 0.78rem; }

@media (min-width: 960px) {
  .nq-card-body      { padding: 0.45rem 0.6rem; gap: 0.6rem; }
  .nq-card-title     { font-size: 1.05rem; }
  .nq-card-reason    { font-size: 0.82rem; }
  .nq-card-reason--sm { font-size: 0.76rem; }
}

/* ═══════════════════════════════════════════════════════
   HERO (Découverte) — colonne centrée : info → image → boutons
═══════════════════════════════════════════════════════ */

.nq-quest-card--main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Colonne centrée horizontalement */
.nq-hero-col {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.6rem 0.75rem;
  gap: 0.5rem;
  text-align: center;
}

/* Bloc texte */
.nq-hero-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  width: 100%;
  flex-shrink: 0;
}

/* Tags et meta : centrés */
.nq-hero-col .nq-tags       { justify-content: center; }
.nq-hero-col .nq-card-meta  { justify-content: center; }

/* Image : absorbe l'espace vertical restant de la colonne hero, garde ses
   proportions via aspect-ratio (object-fit: contain grandit proprement). */
.nq-hero-img {
  flex: 1;
  min-height: 0;
  width: 100%;
  border-radius: 5px;
  overflow: hidden;
  background: rgba(var(--nq-brown-rgb), 0.06);
  padding: 4px;
  box-sizing: border-box;
}

.nq-hero-img img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* Boutons centrés */
.nq-hero-actions {
  flex-shrink: 0;
  justify-content: center;
}

/* Titre hero */
.nq-card-title--hero {
  font-size: 1.05rem;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

@media (min-width: 960px) {
  .nq-hero-col  { padding: 0.5rem 0.65rem; gap: 0.4rem; }

  .nq-card-title--hero { font-size: 1rem; }

  .nq-quest-card--main .nq-card-reason {
    font-size: 0.68rem;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .nq-quest-card--main .nq-quest-cta {
    padding: 6px 10px;
    font-size: 0.74rem;
  }
}

/* ═══════════════════════════════════════════════════════
   CTAs inline (dans nq-card-info, sous la raison)
═══════════════════════════════════════════════════════ */
.nq-card-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: auto;
}

.nq-quest-cta {
  /* WCAG 1.4.3 : #A65D52 sur #F5EDDF ne faisait que 4.19:1 (< 4.5:1 requis) */
  background: var(--nq-brown-mid);
  color: var(--nq-cream-alt);
  border: none;
  border-radius: 4px;
  padding: 7px 11px;
  font-family: var(--nq-font);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: background 0.15s;
  white-space: nowrap;
}
.nq-quest-cta:hover:not(:disabled) { background: var(--nq-brown-dark); }
.nq-quest-cta:disabled             { opacity: 0.5; cursor: not-allowed; }
.nq-quest-cta--sm                  { padding: 5px 9px; font-size: 0.72rem; }

.nq-quest-dismiss {
  background: transparent;
  border: none;
  color: rgba(var(--nq-black-rgb), 0.45);
  font-family: var(--nq-font);
  font-size: 0.76rem;
  padding: 5px 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.12s;
}
.nq-quest-dismiss:hover:not(:disabled) { color: rgba(var(--nq-black-rgb), 0.7); }
.nq-quest-dismiss:disabled             { opacity: 0.35; cursor: not-allowed; }
.nq-quest-dismiss--sm                  { font-size: 0.62rem; }

/* ═══════════════════════════════════════════════════════
   SLOT VIDE
═══════════════════════════════════════════════════════ */
.nq-slot-empty {
  border: 20px solid transparent;
  border-image: url('/images/buttons/wooly-btn-final.png') 350 fill round;
  background: transparent;
  display: flex;
}

.nq-slot-empty-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  text-align: center;
}

.nq-slot-empty--main {
  border-width: 24px;
}

@media (min-width: 960px) {
  .nq-slot-empty       { border-width: 14px; width: 100%; flex: 1; min-height: 0; }
  .nq-slot-empty--main { border-width: 20px; flex: 1; min-height: 0; }
}

.nq-slot-empty .v-icon {
  opacity: 0.55;
}

.nq-slot-empty p {
  font-size: 0.72rem;
  color: rgba(var(--nq-brown-dark-rgb), 0.5);
  margin: 0;
  opacity: 0.55;
}

/* ═══════════════════════════════════════════════════════
   TAGS / RATING / DATE
═══════════════════════════════════════════════════════ */
.nq-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.nq-tag {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(202, 164, 109, 0.18);
  border: 1px solid rgba(202, 164, 109, 0.42);
  font-size: 0.72rem;
  color: #111;
  white-space: nowrap;
}

.nq-rating {
  color: var(--nq-gold-dark);
  font-size: 0.84rem;
  display: flex;
  align-items: center;
  gap: 4px;
}

.nq-rating__num {
  font-size: 0.75rem;
  color: rgba(var(--nq-black-rgb), 0.6);
}

.nq-date {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.75rem;
  color: rgba(var(--nq-black-rgb), 0.6);
  margin: 0;
}

/* ═══════════════════════════════════════════════════════
   PANNEAU FEUTRINE — sous le titre (tags / meta / raison)
═══════════════════════════════════════════════════════ */
.nq-hero-details.nq-felt-panel,
.nq-card-details.nq-felt-panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.6rem;
  background-size: auto, 140px 140px;
  width: 100%;
}

.nq-card-details.nq-felt-panel {
  gap: 0.3rem;
  padding: 0.4rem 0.55rem;
  flex: 1;
  min-height: 0;
  justify-content: center;
}
</style>
