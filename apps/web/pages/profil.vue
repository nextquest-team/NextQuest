<script setup lang="ts">
import { $fetch } from 'ofetch'

definePageMeta({ ssr: false })

const { t } = useI18n()
const { user, logout, fetchProfile } = useAuth()
const store = useAuthStore()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const BIO_MAX = 500

type Visibility = 'private' | 'friends_only' | 'public'
const VISIBILITY_OPTIONS: Visibility[] = ['private', 'friends_only', 'public']

const isLoggingOut = ref(false)

const isEditingBio = ref(false)
const bioInput = ref('')
const isSavingBio = ref(false)
const bioError = ref<string | null>(null)

const isEditingVisibility = ref(false)
const isSavingVisibility = ref(false)
const visibilityError = ref<string | null>(null)

onMounted(() => {
  fetchProfile()
})

// Mock avatar DiceBear tant qu'aucune image n'est en base
const avatarSrc = computed(() => {
  if (user.value?.avatarUrl) return user.value.avatarUrl
  const seed = encodeURIComponent(user.value?.username ?? 'user')
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${seed}&backgroundColor=5C3317&backgroundType=solid`
})


const displayName = computed(() => user.value?.displayName ?? user.value?.username ?? '')

const memberSince = computed(() => {
  if (!user.value?.createdAt) return ''
  return new Date(user.value.createdAt).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
  })
})

const visibilityKey = computed(() => {
  const v = user.value?.visibility
  if (v === 'private') return 'profil.visibility.private'
  if (v === 'friends_only') return 'profil.visibility.friends_only'
  return 'profil.visibility.public'
})

function startEditBio() {
  bioInput.value = user.value?.bio ?? ''
  bioError.value = null
  isEditingBio.value = true
}

function cancelEditBio() {
  isEditingBio.value = false
  bioError.value = null
}

async function saveBio() {
  if (bioInput.value.length > BIO_MAX) return
  isSavingBio.value = true
  bioError.value = null
  try {
    const updated = await $fetch<{ bio: string | null }>(`${apiBase}/api/users/me`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { Authorization: `Bearer ${store.accessToken}` },
      body: { bio: bioInput.value || null },
    })
    if (user.value) {
      store.setAuth({ ...user.value, bio: updated.bio ?? null }, store.accessToken!)
    }
    isEditingBio.value = false
  } catch {
    bioError.value = t('profil.bioSaveError')
  } finally {
    isSavingBio.value = false
  }
}

async function saveVisibility(v: Visibility) {
  if (v === user.value?.visibility) { isEditingVisibility.value = false; return }
  isSavingVisibility.value = true
  visibilityError.value = null
  try {
    await $fetch(`${apiBase}/api/users/me`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { Authorization: `Bearer ${store.accessToken}` },
      body: { visibility: v },
    })
    if (user.value) {
      store.setAuth({ ...user.value, visibility: v }, store.accessToken!)
    }
    isEditingVisibility.value = false
  } catch {
    visibilityError.value = t('profil.visibilitySaveError')
  } finally {
    isSavingVisibility.value = false
  }
}

async function handleLogout() {
  isLoggingOut.value = true
  await logout()
}
</script>

<template>
  <div class="profil">
    <UiBackButton to="/dashboard" class="profil__back" />

    <ClientOnly>
    <div class="profil__card">
      <!-- Avatar -->
      <div class="profil__avatar-wrap">
        <img
          :src="avatarSrc"
          :alt="displayName"
          class="profil__avatar-img"
          @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
        />
      </div>

      <!-- Nom + username -->
      <h1 class="profil__name">{{ displayName }}</h1>
      <p v-if="user?.displayName" class="profil__username">@{{ user.username }}</p>

      <!-- Badges état -->
      <div class="profil__badges">
        <span
          class="profil__badge"
          :class="user?.emailVerified ? 'profil__badge--ok' : 'profil__badge--warn'"
        >
          <v-icon size="14">{{ user?.emailVerified ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
          {{ user?.emailVerified ? t('profil.emailVerified') : t('profil.emailNotVerified') }}
        </span>
        <span
          class="profil__badge"
          :class="user?.onboardingCompleted ? 'profil__badge--ok' : 'profil__badge--warn'"
        >
          <v-icon size="14">{{ user?.onboardingCompleted ? 'mdi-shield-check' : 'mdi-shield-alert' }}</v-icon>
          {{ user?.onboardingCompleted ? t('profil.onboarding.completed') : t('profil.onboarding.pending') }}
        </span>
      </div>

      <hr class="profil__divider" />

      <!-- Informations -->
      <ul class="profil__info-list">
        <li class="profil__info-row">
          <v-icon size="18" class="profil__info-icon">mdi-email-outline</v-icon>
          <span>{{ user?.email }}</span>
        </li>
        <li class="profil__info-row profil__info-row--visibility">
          <v-icon size="18" class="profil__info-icon">mdi-eye-outline</v-icon>
          <template v-if="!isEditingVisibility">
            <span>{{ t('profil.visibility.label') }} : {{ t(visibilityKey) }}</span>
            <button class="profil__edit-btn" @click="isEditingVisibility = true" :aria-label="t('profil.visibility.edit')">
              <v-icon size="16">mdi-pencil-outline</v-icon>
            </button>
          </template>
          <template v-else>
            <div class="profil__visibility-picker">
              <button
                v-for="opt in VISIBILITY_OPTIONS"
                :key="opt"
                class="profil__visibility-opt"
                :class="{ 'profil__visibility-opt--active': user?.visibility === opt }"
                :disabled="isSavingVisibility"
                @click="saveVisibility(opt)"
              >
                {{ t(`profil.visibility.${opt}`) }}
              </button>
              <button class="profil__edit-btn" @click="isEditingVisibility = false" :aria-label="t('profil.cancel')">
                <v-icon size="16">mdi-close</v-icon>
              </button>
            </div>
            <p v-if="visibilityError" class="profil__bio-error">{{ visibilityError }}</p>
          </template>
        </li>
        <li class="profil__info-row">
          <v-icon size="18" class="profil__info-icon">mdi-calendar-outline</v-icon>
          <span>{{ t('profil.memberSince') }} {{ memberSince }}</span>
        </li>
      </ul>

      <hr class="profil__divider" />

      <!-- Bio -->
      <div class="profil__section">
        <div class="profil__section-header">
          <p class="profil__section-label">{{ t('profil.bio') }}</p>
          <button v-if="!isEditingBio" class="profil__edit-btn" @click="startEditBio" :aria-label="t('profil.editBio')">
            <v-icon size="16">mdi-pencil-outline</v-icon>
          </button>
        </div>

        <template v-if="isEditingBio">
          <textarea
            v-model="bioInput"
            class="profil__bio-textarea"
            :maxlength="BIO_MAX"
            :placeholder="t('profil.noBio')"
            rows="4"
            autofocus
          />
          <div class="profil__bio-footer">
            <span class="profil__bio-count" :class="{ 'profil__bio-count--warn': bioInput.length >= BIO_MAX }">
              {{ bioInput.length }}/{{ BIO_MAX }}
            </span>
            <div class="profil__bio-actions">
              <button class="profil__action-btn profil__action-btn--cancel" @click="cancelEditBio">
                {{ t('profil.cancel') }}
              </button>
              <button
                class="profil__action-btn profil__action-btn--save"
                :disabled="isSavingBio || bioInput.length > BIO_MAX"
                @click="saveBio"
              >
                {{ isSavingBio ? '…' : t('profil.save') }}
              </button>
            </div>
          </div>
          <p v-if="bioError" class="profil__bio-error">{{ bioError }}</p>
        </template>

        <p v-else class="profil__bio">{{ user?.bio ?? t('profil.noBio') }}</p>
      </div>

      <!-- Déconnexion -->
      <button
        class="profil__logout"
        :disabled="isLoggingOut"
        @click="handleLogout"
      >
        <v-icon size="18">mdi-logout</v-icon>
        {{ t('auth.logout') }}
      </button>
    </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.profil {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 2rem 1rem 3rem;
  background: transparent;
  font-family: var(--nq-font);
}

.profil__back {
  align-self: flex-start;
  color: var(--nq-brown-dark);
  margin-bottom: 1.5rem;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-decoration: none;
}

.profil__card {
  width: 100%;
  max-width: 480px;
  background: var(--nq-cream);
  border-radius: 16px;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 16px rgba(58, 26, 10, 0.10);
}

/* Avatar */
.profil__avatar-wrap {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: var(--nq-brown);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.profil__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}


/* Nom */
.profil__name {
  font-size: 1.4rem;
  font-weight: bold;
  color: var(--nq-brown-dark);
  text-align: center;
  margin: 0;
}

.profil__username {
  font-size: 0.9rem;
  color: var(--nq-brown);
  margin: -0.5rem 0 0;
}

/* Badges */
.profil__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.profil__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 999px;
  font-family: var(--nq-font);
}

.profil__badge--ok {
  background: #d4edda;
  color: #1a5c2a;
}

.profil__badge--warn {
  background: #fdebc8;
  color: #7a4a00;
}

/* Séparateur */
.profil__divider {
  width: 100%;
  border: none;
  border-top: 1px solid rgba(92, 51, 23, 0.15);
  margin: 0.25rem 0;
}

/* Liste d'infos */
.profil__info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.profil__info-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: var(--nq-brown-dark);
}

.profil__info-icon {
  color: var(--nq-brown);
  flex-shrink: 0;
}

/* Bio */
.profil__section {
  width: 100%;
}

.profil__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}

.profil__section-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--nq-brown);
  margin: 0;
}

.profil__edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--nq-brown);
  padding: 2px;
  display: inline-flex;
  align-items: center;
  opacity: 0.7;
}

.profil__edit-btn:hover {
  opacity: 1;
}

.profil__info-row--visibility {
  flex-wrap: wrap;
  gap: 8px;
}

.profil__visibility-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.profil__visibility-opt {
  padding: 4px 12px;
  border-radius: 999px;
  font-family: var(--nq-font);
  font-size: 0.8rem;
  border: 1px solid rgba(92, 51, 23, 0.3);
  background: transparent;
  color: var(--nq-brown-dark);
  cursor: pointer;
  min-height: 32px;
  transition: background 0.1s, border-color 0.1s;
}

.profil__visibility-opt:hover:not(:disabled) {
  background: rgba(92, 51, 23, 0.08);
}

.profil__visibility-opt--active {
  background: var(--nq-brown);
  color: #edc78e;
  border-color: var(--nq-brown);
}

.profil__visibility-opt:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profil__bio {
  font-size: 0.9rem;
  color: var(--nq-brown-dark);
  line-height: 1.5;
  margin: 0;
  font-style: italic;
  opacity: 0.8;
}

.profil__bio-textarea {
  width: 100%;
  background: var(--nq-beige);
  border: 1px solid rgba(92, 51, 23, 0.3);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: var(--nq-brown-dark);
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.profil__bio-textarea:focus {
  outline: none;
  border-color: var(--nq-brown);
}

.profil__bio-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.profil__bio-count {
  font-size: 0.75rem;
  color: var(--nq-brown);
  opacity: 0.7;
}

.profil__bio-count--warn {
  color: var(--nq-red);
  opacity: 1;
  font-weight: bold;
}

.profil__bio-actions {
  display: flex;
  gap: 8px;
}

.profil__action-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  cursor: pointer;
  border: none;
  min-height: 36px;
}

.profil__action-btn--cancel {
  background: transparent;
  color: var(--nq-brown);
  border: 1px solid rgba(92, 51, 23, 0.3);
}

.profil__action-btn--cancel:hover {
  background: rgba(92, 51, 23, 0.08);
}

.profil__action-btn--save {
  background: var(--nq-brown);
  color: #edc78e;
}

.profil__action-btn--save:hover:not(:disabled) {
  background: var(--nq-brown-dark);
}

.profil__action-btn--save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.profil__bio-error {
  font-size: 0.8rem;
  color: var(--nq-red);
  margin: 4px 0 0;
}

/* Bouton déconnexion */
.profil__logout {
  margin-top: 0.5rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--nq-brown);
  color: #edc78e;
  border: none;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 1rem;
  cursor: pointer;
  min-height: 48px;
  transition: background 0.15s;
}

.profil__logout:hover:not(:disabled) {
  background: var(--nq-brown-dark);
}

.profil__logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
