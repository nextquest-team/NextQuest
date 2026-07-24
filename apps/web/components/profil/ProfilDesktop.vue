<script setup lang="ts">
import {
  BIO_MAX, VISIBILITY_OPTIONS,
  COUNTRIES, FAVORITE_PLATFORMS, FAVORITE_PLATFORM_ICONS,
  SOCIAL_LINK_KEYS,
} from '~/composables/useProfil'

const { t } = useI18n()

const {
  user,
  isLoggingOut,
  isEditingBio, bioInput, isSavingBio, bioError,
  isEditingVisibility, isSavingVisibility, visibilityError,
  isUploadingAvatar, avatarError,
  isEditingCountry, countryInput, isSavingCountry, countryError,
  isEditingBirthdate, birthdateInput, isSavingBirthdate, birthdateError,
  isEditingFavoritePlatform, isSavingFavoritePlatform, favoritePlatformError,
  isEditingSocialLinks, socialLinksInput, isSavingSocialLinks, socialLinksError,
  avatarSrc, displayName, memberSince, visibilityKey, socialLinksList,
  startEditBio, cancelEditBio, saveBio,
  saveVisibility,
  uploadAvatar, removeAvatar,
  startEditCountry, cancelEditCountry, saveCountry,
  startEditBirthdate, cancelEditBirthdate, saveBirthdate,
  saveFavoritePlatform,
  startEditSocialLinks, cancelEditSocialLinks, saveSocialLinks,
  handleLogout,
  init,
} = useProfil()

const avatarInputRef = ref<HTMLInputElement | null>(null)

function triggerAvatarInput() {
  avatarInputRef.value?.click()
}

function onAvatarChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) uploadAvatar(file)
  input.value = ''
}

onMounted(init)
</script>

<template>
  <div class="pd">
    <UiPageHeader to="/dashboard">
      <h1 class="pd__title">{{ t('profil.title') }}</h1>
    </UiPageHeader>

    <ClientOnly>
      <div class="pd__card">

        <!-- Avatar -->
        <div class="pd__avatar-wrap">
          <img
            :src="avatarSrc"
            :alt="displayName"
            class="pd__avatar-img"
            @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
          />
          <div v-if="isUploadingAvatar" class="pd__avatar-loading">
            <v-progress-circular indeterminate size="24" width="2" color="#edc78e" />
          </div>
          <button
            type="button"
            class="pd__avatar-edit-btn"
            :aria-label="t('profil.avatar.change')"
            :disabled="isUploadingAvatar"
            @click="triggerAvatarInput"
          >
            <v-icon size="16">mdi-camera-outline</v-icon>
          </button>
          <button
            v-if="user?.avatarUrl"
            type="button"
            class="pd__avatar-remove-btn"
            :aria-label="t('profil.avatar.remove')"
            :disabled="isUploadingAvatar"
            @click="removeAvatar"
          >
            <v-icon size="14">mdi-trash-can-outline</v-icon>
          </button>
          <input
            ref="avatarInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="pd__avatar-input"
            @change="onAvatarChange"
          />
        </div>
        <p v-if="avatarError" class="pd__error">{{ avatarError }}</p>

        <!-- Nom + username -->
        <h2 class="pd__name">{{ displayName }}</h2>
        <p v-if="user?.displayName" class="pd__username">@{{ user.username }}</p>

        <!-- Badges -->
        <div class="pd__badges">
          <span class="pd__badge" :class="user?.emailVerified ? 'pd__badge--ok' : 'pd__badge--warn'">
            <v-icon size="14">{{ user?.emailVerified ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
            {{ user?.emailVerified ? t('profil.emailVerified') : t('profil.emailNotVerified') }}
          </span>
          <span class="pd__badge" :class="user?.onboardingCompleted ? 'pd__badge--ok' : 'pd__badge--warn'">
            <v-icon size="14">{{ user?.onboardingCompleted ? 'mdi-shield-check' : 'mdi-shield-alert' }}</v-icon>
            {{ user?.onboardingCompleted ? t('profil.onboarding.completed') : t('profil.onboarding.pending') }}
          </span>
        </div>

        <hr class="pd__divider" />

        <!-- Informations -->
        <ul class="pd__info-list">
          <li class="pd__info-row">
            <v-icon size="18" class="pd__info-icon">mdi-email-outline</v-icon>
            <span>{{ user?.email }}</span>
          </li>
          <li class="pd__info-row pd__info-row--visibility">
            <v-icon size="18" class="pd__info-icon">mdi-eye-outline</v-icon>
            <template v-if="!isEditingVisibility">
              <span>{{ t('profil.visibility.label') }} : {{ t(visibilityKey) }}</span>
              <button class="pd__edit-btn" :aria-label="t('profil.visibility.edit')" @click="isEditingVisibility = true">
                <v-icon size="16">mdi-pencil-outline</v-icon>
              </button>
            </template>
            <template v-else>
              <div class="pd__visibility-picker">
                <button
                  v-for="opt in VISIBILITY_OPTIONS"
                  :key="opt"
                  class="pd__visibility-opt"
                  :class="{ 'pd__visibility-opt--active': user?.visibility === opt }"
                  :disabled="isSavingVisibility"
                  @click="saveVisibility(opt)"
                >
                  {{ t(`profil.visibility.${opt}`) }}
                </button>
                <button class="pd__edit-btn" :aria-label="t('profil.cancel')" @click="isEditingVisibility = false">
                  <v-icon size="16">mdi-close</v-icon>
                </button>
              </div>
              <p v-if="visibilityError" class="pd__error">{{ visibilityError }}</p>
            </template>
          </li>
          <li class="pd__info-row">
            <v-icon size="18" class="pd__info-icon">mdi-calendar-outline</v-icon>
            <span>{{ t('profil.memberSince') }} {{ memberSince }}</span>
          </li>

          <!-- Pays -->
          <li class="pd__info-row pd__info-row--visibility">
            <v-icon size="18" class="pd__info-icon">mdi-earth</v-icon>
            <template v-if="!isEditingCountry">
              <span>{{ t('profil.country.label') }} : {{ user?.country ? t(`profil.country.${user.country}`) : t('profil.country.none') }}</span>
              <button class="pd__edit-btn" :aria-label="t('profil.country.edit')" @click="startEditCountry">
                <v-icon size="16">mdi-pencil-outline</v-icon>
              </button>
            </template>
            <template v-else>
              <select v-model="countryInput" class="pd__select" :disabled="isSavingCountry">
                <option value="">{{ t('profil.country.none') }}</option>
                <option v-for="code in COUNTRIES" :key="code" :value="code">{{ t(`profil.country.${code}`) }}</option>
              </select>
              <button class="pd__action-btn pd__action-btn--save" :disabled="isSavingCountry" @click="saveCountry">
                {{ isSavingCountry ? '…' : t('profil.save') }}
              </button>
              <button class="pd__edit-btn" :aria-label="t('profil.cancel')" @click="cancelEditCountry">
                <v-icon size="16">mdi-close</v-icon>
              </button>
              <p v-if="countryError" class="pd__error">{{ countryError }}</p>
            </template>
          </li>

          <!-- Date de naissance -->
          <li class="pd__info-row pd__info-row--visibility">
            <v-icon size="18" class="pd__info-icon">mdi-cake-variant-outline</v-icon>
            <template v-if="!isEditingBirthdate">
              <span>{{ t('profil.birthdate.label') }} : {{ user?.birthdate ?? t('profil.birthdate.none') }}</span>
              <button class="pd__edit-btn" :aria-label="t('profil.birthdate.edit')" @click="startEditBirthdate">
                <v-icon size="16">mdi-pencil-outline</v-icon>
              </button>
            </template>
            <template v-else>
              <input v-model="birthdateInput" type="date" class="pd__select" :disabled="isSavingBirthdate" />
              <button class="pd__action-btn pd__action-btn--save" :disabled="isSavingBirthdate" @click="saveBirthdate">
                {{ isSavingBirthdate ? '…' : t('profil.save') }}
              </button>
              <button class="pd__edit-btn" :aria-label="t('profil.cancel')" @click="cancelEditBirthdate">
                <v-icon size="16">mdi-close</v-icon>
              </button>
              <p v-if="birthdateError" class="pd__error">{{ birthdateError }}</p>
            </template>
          </li>

          <!-- Plateforme favorite -->
          <li class="pd__info-row pd__info-row--visibility">
            <v-icon size="18" class="pd__info-icon">mdi-controller-classic-outline</v-icon>
            <template v-if="!isEditingFavoritePlatform">
              <span>{{ t('profil.platform.label') }} : {{ user?.favoritePlatform ? t(`profil.platform.${user.favoritePlatform}`) : t('profil.platform.none') }}</span>
              <button class="pd__edit-btn" :aria-label="t('profil.platform.edit')" @click="isEditingFavoritePlatform = true">
                <v-icon size="16">mdi-pencil-outline</v-icon>
              </button>
            </template>
            <template v-else>
              <div class="pd__visibility-picker">
                <button
                  v-for="opt in FAVORITE_PLATFORMS"
                  :key="opt"
                  class="pd__visibility-opt"
                  :class="{ 'pd__visibility-opt--active': user?.favoritePlatform === opt }"
                  :disabled="isSavingFavoritePlatform"
                  @click="saveFavoritePlatform(opt)"
                >
                  <v-icon size="14">{{ FAVORITE_PLATFORM_ICONS[opt] }}</v-icon>
                  {{ t(`profil.platform.${opt}`) }}
                </button>
                <button
                  class="pd__visibility-opt"
                  :class="{ 'pd__visibility-opt--active': !user?.favoritePlatform }"
                  :disabled="isSavingFavoritePlatform"
                  @click="saveFavoritePlatform(null)"
                >
                  {{ t('profil.platform.none') }}
                </button>
                <button class="pd__edit-btn" :aria-label="t('profil.cancel')" @click="isEditingFavoritePlatform = false">
                  <v-icon size="16">mdi-close</v-icon>
                </button>
              </div>
              <p v-if="favoritePlatformError" class="pd__error">{{ favoritePlatformError }}</p>
            </template>
          </li>
        </ul>

        <hr class="pd__divider" />

        <!-- Bio -->
        <div class="pd__section">
          <div class="pd__section-header">
            <p class="pd__section-label">{{ t('profil.bio') }}</p>
            <button v-if="!isEditingBio" class="pd__edit-btn" :aria-label="t('profil.editBio')" @click="startEditBio">
              <v-icon size="16">mdi-pencil-outline</v-icon>
            </button>
          </div>

          <template v-if="isEditingBio">
            <textarea
              v-model="bioInput"
              class="pd__bio-textarea"
              :maxlength="BIO_MAX"
              :placeholder="t('profil.noBio')"
              rows="4"
              autofocus
            />
            <div class="pd__bio-footer">
              <span class="pd__bio-count" :class="{ 'pd__bio-count--warn': bioInput.length >= BIO_MAX }">
                {{ bioInput.length }}/{{ BIO_MAX }}
              </span>
              <div class="pd__bio-actions">
                <button class="pd__action-btn pd__action-btn--cancel" @click="cancelEditBio">
                  {{ t('profil.cancel') }}
                </button>
                <button
                  class="pd__action-btn pd__action-btn--save"
                  :disabled="isSavingBio || bioInput.length > BIO_MAX"
                  @click="saveBio"
                >
                  {{ isSavingBio ? '…' : t('profil.save') }}
                </button>
              </div>
            </div>
            <p v-if="bioError" class="pd__error">{{ bioError }}</p>
          </template>

          <p v-else class="pd__bio">{{ user?.bio ?? t('profil.noBio') }}</p>
        </div>

        <!-- Réseaux sociaux -->
        <div class="pd__section">
          <div class="pd__section-header">
            <p class="pd__section-label">{{ t('profil.socialLinks.label') }}</p>
            <button v-if="!isEditingSocialLinks" class="pd__edit-btn" :aria-label="t('profil.socialLinks.edit')" @click="startEditSocialLinks">
              <v-icon size="16">mdi-pencil-outline</v-icon>
            </button>
          </div>

          <template v-if="isEditingSocialLinks">
            <div class="pd__social-form">
              <div v-for="key in SOCIAL_LINK_KEYS" :key="key" class="pd__social-field">
                <ProfilSocialLinkIcon :platform="key" :size="18" class="pd__info-icon" />
                <input
                  v-model="socialLinksInput[key]"
                  type="url"
                  class="pd__select pd__social-input"
                  :placeholder="t('profil.socialLinks.placeholder')"
                  :disabled="isSavingSocialLinks"
                />
              </div>
            </div>
            <div class="pd__bio-footer">
              <div class="pd__bio-actions">
                <button class="pd__action-btn pd__action-btn--cancel" @click="cancelEditSocialLinks">
                  {{ t('profil.cancel') }}
                </button>
                <button class="pd__action-btn pd__action-btn--save" :disabled="isSavingSocialLinks" @click="saveSocialLinks">
                  {{ isSavingSocialLinks ? '…' : t('profil.save') }}
                </button>
              </div>
            </div>
            <p v-if="socialLinksError" class="pd__error">{{ socialLinksError }}</p>
          </template>

          <div v-else-if="socialLinksList.length > 0" class="pd__social-list">
            <a
              v-for="entry in socialLinksList"
              :key="entry.key"
              :href="entry.url"
              target="_blank"
              rel="noopener noreferrer"
              class="pd__social-link"
              :aria-label="entry.key"
            >
              <ProfilSocialLinkIcon :platform="entry.key" :size="20" />
            </a>
          </div>
          <p v-else class="pd__bio">{{ t('profil.socialLinks.none') }}</p>
        </div>

        <!-- Déconnexion -->
        <button class="pd__logout" :disabled="isLoggingOut" @click="handleLogout">
          <v-icon size="18">mdi-logout</v-icon>
          {{ t('auth.logout') }}
        </button>

      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.pd {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 2rem 3rem;
  font-family: var(--nq-font);
}

.pd__title {
  font-family: var(--nq-font);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.pd__card {
  width: 100%;
  max-width: 520px;
  background: var(--nq-cream);
  border-radius: 16px;
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 16px rgba(var(--nq-brown-dark-rgb), 0.10);
}

/* Avatar */
.pd__avatar-wrap {
  position: relative;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: var(--nq-brown);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  flex-shrink: 0;
}

.pd__avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

.pd__avatar-loading {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pd__avatar-edit-btn,
.pd__avatar-remove-btn {
  position: absolute;
  bottom: -2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--nq-cream);
  background: var(--nq-brown);
  color: #edc78e;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pd__avatar-edit-btn { right: -2px; }
.pd__avatar-remove-btn { left: -2px; background: var(--nq-red); }
.pd__avatar-edit-btn:disabled,
.pd__avatar-remove-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.pd__avatar-input { display: none; }

/* Selects (pays, date de naissance) */
.pd__select {
  padding: 4px 10px;
  border-radius: 999px;
  font-family: var(--nq-font);
  font-size: 0.8rem;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  background: var(--nq-beige);
  color: var(--nq-brown-dark);
  min-height: 32px;
}

/* Réseaux sociaux */
.pd__social-form { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.pd__social-field { display: flex; align-items: center; gap: 8px; }
.pd__social-input { flex: 1; border-radius: 8px; font-size: 0.85rem; }

.pd__social-list { display: flex; flex-wrap: wrap; gap: 10px; }

.pd__social-link {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--nq-beige);
  color: var(--nq-brown-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
}

.pd__social-link:hover { background: rgba(var(--nq-brown-rgb), 0.2); }

.pd__name { font-size: 1.4rem; font-weight: bold; color: var(--nq-brown-dark); text-align: center; margin: 0; }
.pd__username { font-size: 0.9rem; color: var(--nq-brown); margin: -0.5rem 0 0; }

/* Badges */
.pd__badges { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }

.pd__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 999px;
}

.pd__badge--ok { background: var(--nq-success-bg); color: var(--nq-success-text); }
.pd__badge--warn { background: var(--nq-warning-bg); color: var(--nq-warning-text); }

.pd__divider { width: 100%; border: none; border-top: 1px solid rgba(var(--nq-brown-rgb), 0.15); margin: 0.25rem 0; }

/* Infos */
.pd__info-list { list-style: none; padding: 0; margin: 0; width: 100%; display: flex; flex-direction: column; gap: 0.6rem; }

.pd__info-row { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: var(--nq-brown-dark); }
.pd__info-icon { color: var(--nq-brown); flex-shrink: 0; }
.pd__info-row--visibility { flex-wrap: wrap; gap: 8px; }

.pd__visibility-picker { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }

.pd__visibility-opt {
  padding: 4px 12px;
  border-radius: 999px;
  font-family: var(--nq-font);
  font-size: 0.8rem;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  background: transparent;
  color: var(--nq-brown-dark);
  cursor: pointer;
  min-height: 32px;
  transition: background 0.1s;
}

.pd__visibility-opt:hover:not(:disabled) { background: rgba(var(--nq-brown-rgb), 0.08); }
.pd__visibility-opt--active { background: var(--nq-brown); color: #edc78e; border-color: var(--nq-brown); }
.pd__visibility-opt:disabled { opacity: 0.5; cursor: not-allowed; }

.pd__edit-btn { background: none; border: none; cursor: pointer; color: var(--nq-brown); padding: 2px; display: inline-flex; opacity: 0.7; }
.pd__edit-btn:hover { opacity: 1; }

/* Bio */
.pd__section { width: 100%; }
.pd__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.pd__section-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--nq-brown); margin: 0; }
.pd__bio { font-size: 0.9rem; color: var(--nq-brown-dark); line-height: 1.5; margin: 0; font-style: italic; opacity: 0.8; }

.pd__bio-textarea {
  width: 100%;
  background: var(--nq-beige);
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: var(--nq-font);
  font-size: 0.9rem;
  color: var(--nq-brown-dark);
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.pd__bio-textarea:focus { outline: none; border-color: var(--nq-brown); }
.pd__bio-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; }
.pd__bio-count { font-size: 0.75rem; color: var(--nq-brown); opacity: 0.7; }
.pd__bio-count--warn { color: var(--nq-red); opacity: 1; font-weight: bold; }
.pd__bio-actions { display: flex; gap: 8px; }

.pd__action-btn {
  padding: 6px 16px;
  border-radius: 6px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  cursor: pointer;
  border: none;
  min-height: 36px;
}

.pd__action-btn--cancel { background: transparent; color: var(--nq-brown); border: 1px solid rgba(var(--nq-brown-rgb), 0.3); }
.pd__action-btn--cancel:hover { background: rgba(var(--nq-brown-rgb), 0.08); }
.pd__action-btn--save { background: var(--nq-brown); color: #edc78e; }
.pd__action-btn--save:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pd__action-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }

.pd__error { font-size: 0.8rem; color: var(--nq-red); margin: 4px 0 0; }

/* Déconnexion */
.pd__logout {
  margin-top: 0.5rem;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--nq-brown);
  color: var(--nq-cream-light);
  border: none;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 1rem;
  cursor: pointer;
  min-height: 48px;
  transition: background 0.15s;
}

.pd__logout:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pd__logout:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
