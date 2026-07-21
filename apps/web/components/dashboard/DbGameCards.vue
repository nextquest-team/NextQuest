<script setup lang="ts">
import type { UpcomingGameDTO } from '~/types/game'

const { authFetch, apiBase } = useAuthFetch()
const scrollEl = ref<HTMLElement | null>(null)
const globeRotation = ref(0)
const games = ref<UpcomingGameDTO[]>([])

async function fetchUpcoming() {
  try {
    const res = await authFetch<{ items: UpcomingGameDTO[] }>(`${apiBase}/api/games/upcoming`, {
      query: { limit: 20, offset: 0, sort: 'hype' },
    })
    games.value = res.items
  } catch (e) {
    console.error('[DbGameCards] fetchUpcoming', e)
  }
}

onMounted(fetchUpcoming)

function onScroll() {
  if (!scrollEl.value) return
  globeRotation.value = scrollEl.value.scrollLeft * -0.12
}

function onKeydown(e: KeyboardEvent) {
  if (!scrollEl.value) return
  const step = 120
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    scrollEl.value.scrollBy({ left: step, behavior: 'smooth' })
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    scrollEl.value.scrollBy({ left: -step, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="game-cards" role="region" aria-label="Ma liste de jeux">

    <!-- Slot optionnel pour un label/bouton en overlay haut-droit -->
    <div v-if="$slots.header" class="game-cards__header">
      <slot name="header" />
    </div>

    <!-- Globe décoratif — caché aux lecteurs d'écran -->
    <img
      src="/images/dashboard/card-map-bg.png"
      class="game-cards__globe"
      :style="{ transform: `translateX(-50%) translateY(70%) rotate(${globeRotation}deg)` }"
      alt=""
      aria-hidden="true"
    />

    <!-- Scroll horizontal des cartes -->
    <div
      class="game-cards__scroll"
      ref="scrollEl"
      role="group"
      tabindex="0"
      aria-label="Liste de jeux, défiler horizontalement"
      @scroll="onScroll"
      @keydown="onKeydown"
    >
      <ul class="game-cards__track">
        <li v-for="game in games" :key="game.igdbId">
          <NuxtLink
            :to="`/games/catalog/${game.igdbId}`"
            class="game-card"
            :aria-label="game.title"
          >
            <img v-if="game.coverUrl" :src="game.coverUrl" :alt="game.title" class="game-card__cover" />
            <v-icon v-else class="game-card__placeholder" size="32" color="rgba(var(--nq-cream-light-rgb), 0.3)">mdi-gamepad-variant-outline</v-icon>
          </NuxtLink>
        </li>
      </ul>
    </div>

  </div>
</template>

<style scoped>
.game-cards {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
}

.game-cards__header {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
}

.game-cards__globe {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 85vw;
  height: auto;
  /* translateY(%) = % de la hauteur propre de l'image. Le contenu visible du globe
     commence à y≈132px (display), soit 22% depuis le haut — d'où T < 78% */
  transform: translateX(-50%) translateY(65%);
  transform-origin: center center;
  pointer-events: none;
  z-index: 0;
}

.game-cards__scroll {
  position: relative;
  z-index: 1;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  outline: none;
}

.game-cards__scroll::-webkit-scrollbar {
  display: none;
}

/* Focus clavier sur le conteneur scroll */
.game-cards__scroll:focus-visible {
  outline: 3px solid var(--nq-focus);
  outline-offset: 4px;
  border-radius: 8px;
}

.game-cards__track {
  display: flex;
  gap: 4vw;
  padding: 0 6vw;
  width: max-content;
  list-style: none;
  margin: 0;
}

.game-card {
  flex-shrink: 0;
  width: min(22vw, 105px);
  aspect-ratio: 2 / 3;
  border-radius: 10px;
  border: 3px solid var(--nq-brown-mid);
  background: #3a2e28;
  scroll-snap-align: center;
  cursor: pointer;
  text-decoration: none;
  display: block;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s, border-color 0.15s;
}

.game-card:hover {
  transform: translateY(-3px) scale(1.03);
  border-color: #c47a3a;
}

.game-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 7px;
}

.game-card__placeholder {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
