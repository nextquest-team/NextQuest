<script setup lang="ts">
import type { CollectionListResponse } from '~/types/game'
import { toUserGame } from '~/types/game'

defineProps<{
  username: string
}>()

defineEmits<{
  logout: []
}>()

const { t } = useI18n()
const { authFetch, apiBase } = useAuthFetch()

// 8 derniers jeux ajoutés (le 9e slot est réservé au bouton +)
const bagGames = ref<{ id: string; title: string; coverUrl: string | null }[]>([])
const bagLoading = ref(false)

async function fetchBagGames() {
  bagLoading.value = true
  try {
    const res = await authFetch<CollectionListResponse>(`${apiBase}/api/collection`, {
      query: { limit: 8, offset: 0 },
    })
    bagGames.value = res.items.map(item => toUserGame(item))
  } catch { /* liste vide si erreur */ }
  finally { bagLoading.value = false }
}

onMounted(fetchBagGames)
</script>

<template>
  <div class="dd">

    <!-- Colonne gauche : sac à dos -->
    <div class="dd__bag" data-onb-target="bag">
      <img
        src="/images/dashboard/sac-a-dos.png"
        alt=""
        class="dd__bag-img"
      />
      <NuxtLink to="/game-list" class="dd__bag-btn">
        {{ t('dashboard.sacoche.gameList') }}
      </NuxtLink>
      <!-- Grille 3×3 des derniers jeux ajoutés + encart ajout -->
      <div class="dd__bag-grid">
        <NuxtLink
          v-for="game in bagGames"
          :key="game.id"
          :to="`/games/${game.id}`"
          class="dd__bag-thumb"
          :title="game.title"
        >
          <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" />
          <v-icon v-else size="28" color="rgba(122,62,42,0.4)">mdi-gamepad-variant-outline</v-icon>
        </NuxtLink>
        <NuxtLink to="/game-list" class="dd__bag-thumb dd__bag-thumb--add" :title="t('dashboard.sacoche.addGame')">
          <v-icon size="28" color="#7a3e2a">mdi-plus</v-icon>
        </NuxtLink>
      </div>
    </div>

    <!-- Colonne centrale : profil + boussole -->
    <div class="dd__center">
      <DashboardDbProfileCard :username="username" :horizontal="true" data-onb-target="profile" />
      <div data-onb-target="wheel">
        <DashboardDbWheel />
      </div>
    </div>

    <!-- Colonne droite : parchemin -->
    <div class="dd__parchemin" data-onb-target="parchemin">
      <img
        src="/images/dashboard/parchemin-ouvert.png"
        alt=""
        class="dd__parchemin-img"
      />
      <div class="dd__parchemin-scroll">
        <div
          v-for="game in bagGames"
          :key="game.id"
          class="dd__game-slot"
          :title="game.title"
        >
          <!-- TODO: image couverture depuis API -->
        </div>
      </div>
      <NuxtLink to="/actualites" class="dd__parchemin-voir-tout">
        {{ t('dashboard.parchemin.voirTout') }}
      </NuxtLink>
    </div>

    <!-- Ligne basse : sorties de jeux (pleine largeur) -->
    <div class="dd__cardmap" data-onb-target="timeline">
      <DashboardDbGameCards>
        <template #header>
          <NuxtLink to="/timeline" class="dd__timeline-link">
            {{ t('nav.timeline') }}
            <v-icon size="14">mdi-chevron-right</v-icon>
          </NuxtLink>
        </template>
      </DashboardDbGameCards>
    </div>

  </div>
</template>

<style scoped>
/*
 * Grille principale — fidèle au wireframe :
 *
 * | sac       | profil/boussole | parchemin |
 * | sortie de jeux (pleine largeur)           |
 */
.dd {
  width: 100%;
  height: 100dvh;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: 66% 34%;
  grid-template-areas:
    "bag    center   parchemin"
    "cardmap cardmap cardmap";
  overflow: hidden;
  background: transparent;
}

/* ── Sac à dos ─────────────────────────────────────────────────── */
.dd__bag {
  grid-area: bag;
  position: relative;
  overflow: hidden;
}

.dd__bag-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  pointer-events: none;
}

.dd__bag-btn {
  position: absolute;
  top: 30%;           /* % de la hauteur de cellule → vraiment responsive */
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  display: inline-flex;
  align-items: center;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1vw, 1rem);
  color: #edc78e;
  text-decoration: none;
  background: #7a3e2a;
  padding: 7px 18px;
  border-radius: 5px;
  white-space: nowrap;
  min-height: 44px;
}

.dd__bag-grid {
  position: absolute;
  bottom: 6%;
  left: 50%;
  transform: translateX(-50%);
  width: 52%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4%;
  z-index: 1;
}

.dd__bag-thumb {
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid #7a3e2a;
  background: rgba(245, 237, 223, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dd__bag-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dd__bag-thumb--add {
  border-style: dashed;
  background: rgba(245, 237, 223, 0.2);
  transition: background 0.15s;
}

.dd__bag-thumb--add:hover {
  background: rgba(122, 62, 42, 0.12);
}

/* ── Centre : profil + boussole ─────────────────────────────────── */
.dd__center {
  grid-area: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  padding-top: 5%;
  gap: 48px;
}

/* ── Parchemin ──────────────────────────────────────────────────── */
.dd__parchemin {
  grid-area: parchemin;
  position: relative;
  margin-top: -1%;
}

.dd__parchemin-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
}

.dd__parchemin-scroll {
  position: absolute;
  top: 14%;
  bottom: 13%;
  left: 9%;
  right: 9%;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  display: flex;
  flex-direction: column;
  gap: 6%;
  padding: 4% 0;
}

.dd__parchemin-scroll::-webkit-scrollbar {
  display: none;
}

.dd__game-slot {
  flex-shrink: 0;
  width: 82%;
  margin: 0 auto;
  aspect-ratio: 5 / 2;
  border: 1.5px solid #7a3e2a;
  border-radius: 6px;
  background: rgba(245, 237, 223, 0.55);
}

.dd__parchemin-voir-tout {
  position: absolute;
  bottom: 5%;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1vw, 1rem);
  color: #edc78e;
  text-decoration: none;
  background: #7a3e2a;
  padding: 7px 18px;
  border-radius: 5px;
  white-space: nowrap;
  min-height: 44px;
}

/* ── Cardmap (pleine largeur) ───────────────────────────────────── */
.dd__cardmap {
  grid-area: cardmap;
  display: flex;
  justify-content: center;
  align-items: stretch;
}

.dd__timeline-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--nq-font);
  font-size: clamp(0.875rem, 1vw, 1rem);
  color: #edc78e;
  text-decoration: none;
  background: #7a3e2a;
  padding: 7px 18px;
  border-radius: 5px;
  border: none;
  white-space: nowrap;
  min-height: 44px;
}
</style>
