<script setup lang="ts">
const scrollEl = ref<HTMLElement | null>(null)
const globeRotation = ref(0)

// TODO: remplacer par les jeux de l'utilisateur depuis l'API
const games = [
  { id: 1, title: 'Hollow Knight' },
  { id: 2, title: 'Zelda BOTW' },
  { id: 3, title: 'Binding of Isaac' },
  { id: 4, title: "Yoshi's Woolly World" },
  { id: 5, title: 'Resident Evil' },
  { id: 6, title: 'Portal' },
]

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

    <!-- Globe décoratif — caché aux lecteurs d'écran -->
    <img
      src="/images/dashboard/card-map-bg.png"
      class="game-cards__globe"
      :style="{ transform: `translateX(-50%) rotate(${globeRotation}deg)` }"
      alt=""
      aria-hidden="true"
    />

    <!-- Scroll horizontal des cartes -->
    <div
      class="game-cards__scroll"
      ref="scrollEl"
      role="list"
      tabindex="0"
      aria-label="Liste de jeux, défiler horizontalement"
      @scroll="onScroll"
      @keydown="onKeydown"
    >
      <div class="game-cards__track">
        <div
          v-for="game in games"
          :key="game.id"
          class="game-card"
          role="listitem"
          :aria-label="game.title"
        >
          <!-- TODO: image couverture depuis API (IGDB ou autre) -->
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.game-cards {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
}

.game-cards__globe {
  position: absolute;
  bottom: -530%;
  left: 50%;
  width: 85vw;
  height: auto;
  transform: translateX(-50%);
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
  outline: 3px solid #264a2e;
  outline-offset: 4px;
  border-radius: 8px;
}

.game-cards__track {
  display: flex;
  gap: 4vw;
  padding: 0 6vw;
  width: max-content;
}

.game-card {
  flex-shrink: 0;
  width: min(22vw, 105px);
  aspect-ratio: 2 / 3;
  border-radius: 10px;
  border: 3px solid #7a3e2a;
  background: #3a2e28;
  scroll-snap-align: center;
}
</style>
