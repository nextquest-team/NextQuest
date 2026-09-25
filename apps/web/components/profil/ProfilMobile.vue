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
  avatarSrc, avatarInitial, displayName, memberSince, visibilityKey, socialLinksList,
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
  <div class="pm">

    <!-- ── Header fixe ── -->
    <div class="pm__head">
      <UiPageHeader to="/dashboard">
        <h1 class="pm__title">{{ t('profil.title') }}</h1>
      </UiPageHeader>
    </div>

    <!-- ── Zone scrollable ── -->
    <div class="pm__body">
      <ClientOnly>
        <div class="pm__book">

          <!-- Page profil -->
          <div class="pm__section--profil">

          <!-- Avatar -->
          <div class="pm__avatar-wrap">
            <img
              v-if="avatarSrc"
              :src="avatarSrc"
              :alt="displayName"
              class="pm__avatar-img"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <span v-else class="pm__avatar-initial">{{ avatarInitial }}</span>
            <div v-if="isUploadingAvatar" class="pm__avatar-loading">
              <v-progress-circular indeterminate size="22" width="2" color="#edc78e" />
            </div>
            <button
              type="button"
              class="pm__avatar-edit-btn"
              :aria-label="t('profil.avatar.change')"
              :disabled="isUploadingAvatar"
              @click="triggerAvatarInput"
            >
              <v-icon size="15">mdi-camera-outline</v-icon>
            </button>
            <button
              v-if="user?.avatarUrl"
              type="button"
              class="pm__avatar-remove-btn"
              :aria-label="t('profil.avatar.remove')"
              :disabled="isUploadingAvatar"
              @click="removeAvatar"
            >
              <v-icon size="13">mdi-trash-can-outline</v-icon>
            </button>
            <input
              ref="avatarInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="pm__avatar-input"
              @change="onAvatarChange"
            />
          </div>
          <p v-if="avatarError" class="pm__error">{{ avatarError }}</p>

          <!-- Nom + username -->
          <h2 class="pm__name">{{ displayName }}</h2>
          <p v-if="user?.displayName" class="pm__username">@{{ user.username }}</p>

          <!-- Badges -->
          <div class="pm__badges">
            <span class="pm__badge" :class="user?.emailVerified ? 'pm__badge--ok' : 'pm__badge--warn'">
              <v-icon size="13">{{ user?.emailVerified ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
              {{ user?.emailVerified ? t('profil.emailVerified') : t('profil.emailNotVerified') }}
            </span>
            <span class="pm__badge" :class="user?.onboardingCompleted ? 'pm__badge--ok' : 'pm__badge--warn'">
              <v-icon size="13">{{ user?.onboardingCompleted ? 'mdi-shield-check' : 'mdi-shield-alert' }}</v-icon>
              {{ user?.onboardingCompleted ? t('profil.onboarding.completed') : t('profil.onboarding.pending') }}
            </span>
          </div>

          <hr class="pm__divider" />

          <!-- Informations -->
          <ul class="pm__info-list">
            <li class="pm__info-row">
              <v-icon size="16" class="pm__info-icon">mdi-email-outline</v-icon>
              <span>{{ user?.email }}</span>
            </li>
            <li class="pm__info-row pm__info-row--visibility">
              <v-icon size="16" class="pm__info-icon">mdi-eye-outline</v-icon>
              <template v-if="!isEditingVisibility">
                <span>{{ t('profil.visibility.label') }} : {{ t(visibilityKey) }}</span>
                <button class="pm__edit-btn" :aria-label="t('profil.visibility.edit')" @click="isEditingVisibility = true">
                  <v-icon size="15">mdi-pencil-outline</v-icon>
                </button>
              </template>
              <template v-else>
                <div class="pm__visibility-picker">
                  <button
                    v-for="opt in VISIBILITY_OPTIONS"
                    :key="opt"
                    class="pm__visibility-opt"
                    :class="{ 'pm__visibility-opt--active': user?.visibility === opt }"
                    :disabled="isSavingVisibility"
                    @click="saveVisibility(opt)"
                  >
                    {{ t(`profil.visibility.${opt}`) }}
                  </button>
                  <button class="pm__edit-btn" :aria-label="t('profil.cancel')" @click="isEditingVisibility = false">
                    <v-icon size="15">mdi-close</v-icon>
                  </button>
                </div>
                <p v-if="visibilityError" class="pm__error">{{ visibilityError }}</p>
              </template>
            </li>
            <li class="pm__info-row">
              <v-icon size="16" class="pm__info-icon">mdi-calendar-outline</v-icon>
              <span>{{ t('profil.memberSince') }} {{ memberSince }}</span>
            </li>

            <!-- Pays -->
            <li class="pm__info-row pm__info-row--visibility">
              <v-icon size="16" class="pm__info-icon">mdi-earth</v-icon>
              <template v-if="!isEditingCountry">
                <span>{{ t('profil.country.label') }} : {{ user?.country ? t(`profil.country.${user.country}`) : t('profil.country.none') }}</span>
                <button class="pm__edit-btn" :aria-label="t('profil.country.edit')" @click="startEditCountry">
                  <v-icon size="15">mdi-pencil-outline</v-icon>
                </button>
              </template>
              <template v-else>
                <select v-model="countryInput" class="pm__select" :disabled="isSavingCountry">
                  <option value="">{{ t('profil.country.none') }}</option>
                  <option v-for="code in COUNTRIES" :key="code" :value="code">{{ t(`profil.country.${code}`) }}</option>
                </select>
                <button class="pm__action-btn pm__action-btn--save" :disabled="isSavingCountry" @click="saveCountry">
                  {{ isSavingCountry ? '…' : t('profil.save') }}
                </button>
                <button class="pm__edit-btn" :aria-label="t('profil.cancel')" @click="cancelEditCountry">
                  <v-icon size="15">mdi-close</v-icon>
                </button>
                <p v-if="countryError" class="pm__error">{{ countryError }}</p>
              </template>
            </li>

            <!-- Date de naissance -->
            <li class="pm__info-row pm__info-row--visibility">
              <v-icon size="16" class="pm__info-icon">mdi-cake-variant-outline</v-icon>
              <template v-if="!isEditingBirthdate">
                <span>{{ t('profil.birthdate.label') }} : {{ user?.birthdate ?? t('profil.birthdate.none') }}</span>
                <button class="pm__edit-btn" :aria-label="t('profil.birthdate.edit')" @click="startEditBirthdate">
                  <v-icon size="15">mdi-pencil-outline</v-icon>
                </button>
              </template>
              <template v-else>
                <input v-model="birthdateInput" type="date" class="pm__select" :disabled="isSavingBirthdate" />
                <button class="pm__action-btn pm__action-btn--save" :disabled="isSavingBirthdate" @click="saveBirthdate">
                  {{ isSavingBirthdate ? '…' : t('profil.save') }}
                </button>
                <button class="pm__edit-btn" :aria-label="t('profil.cancel')" @click="cancelEditBirthdate">
                  <v-icon size="15">mdi-close</v-icon>
                </button>
                <p v-if="birthdateError" class="pm__error">{{ birthdateError }}</p>
              </template>
            </li>

            <!-- Plateforme favorite -->
            <li class="pm__info-row pm__info-row--visibility">
              <v-icon size="16" class="pm__info-icon">mdi-controller-classic-outline</v-icon>
              <template v-if="!isEditingFavoritePlatform">
                <span>{{ t('profil.platform.label') }} : {{ user?.favoritePlatform ? t(`profil.platform.${user.favoritePlatform}`) : t('profil.platform.none') }}</span>
                <button class="pm__edit-btn" :aria-label="t('profil.platform.edit')" @click="isEditingFavoritePlatform = true">
                  <v-icon size="15">mdi-pencil-outline</v-icon>
                </button>
              </template>
              <template v-else>
                <div class="pm__visibility-picker">
                  <button
                    v-for="opt in FAVORITE_PLATFORMS"
                    :key="opt"
                    class="pm__visibility-opt"
                    :class="{ 'pm__visibility-opt--active': user?.favoritePlatform === opt }"
                    :disabled="isSavingFavoritePlatform"
                    @click="saveFavoritePlatform(opt)"
                  >
                    <v-icon size="13">{{ FAVORITE_PLATFORM_ICONS[opt] }}</v-icon>
                    {{ t(`profil.platform.${opt}`) }}
                  </button>
                  <button
                    class="pm__visibility-opt"
                    :class="{ 'pm__visibility-opt--active': !user?.favoritePlatform }"
                    :disabled="isSavingFavoritePlatform"
                    @click="saveFavoritePlatform(null)"
                  >
                    {{ t('profil.platform.none') }}
                  </button>
                  <button class="pm__edit-btn" :aria-label="t('profil.cancel')" @click="isEditingFavoritePlatform = false">
                    <v-icon size="15">mdi-close</v-icon>
                  </button>
                </div>
                <p v-if="favoritePlatformError" class="pm__error">{{ favoritePlatformError }}</p>
              </template>
            </li>
          </ul>

          <hr class="pm__divider" />

          <!-- Bio -->
          <div class="pm__section">
            <div class="pm__section-header">
              <p class="pm__section-label">{{ t('profil.bio') }}</p>
              <button v-if="!isEditingBio" class="pm__edit-btn" :aria-label="t('profil.editBio')" @click="startEditBio">
                <v-icon size="15">mdi-pencil-outline</v-icon>
              </button>
            </div>

            <template v-if="isEditingBio">
              <textarea
                v-model="bioInput"
                class="pm__bio-textarea"
                :maxlength="BIO_MAX"
                :placeholder="t('profil.noBio')"
                rows="4"
                autofocus
              />
              <div class="pm__bio-footer">
                <span class="pm__bio-count" :class="{ 'pm__bio-count--warn': bioInput.length >= BIO_MAX }">
                  {{ bioInput.length }}/{{ BIO_MAX }}
                </span>
                <div class="pm__bio-actions">
                  <button class="pm__action-btn pm__action-btn--cancel" @click="cancelEditBio">
                    {{ t('profil.cancel') }}
                  </button>
                  <button
                    class="pm__action-btn pm__action-btn--save"
                    :disabled="isSavingBio || bioInput.length > BIO_MAX"
                    @click="saveBio"
                  >
                    {{ isSavingBio ? '…' : t('profil.save') }}
                  </button>
                </div>
              </div>
              <p v-if="bioError" class="pm__error">{{ bioError }}</p>
            </template>

            <p v-else class="pm__bio">{{ user?.bio ?? t('profil.noBio') }}</p>
          </div>

          </div>

          <hr class="pm__page-divider" />

          <!-- Page réseaux sociaux -->
          <div class="pm__section pm__section--social">
            <div class="pm__section-header">
              <p class="pm__section-label">{{ t('profil.socialLinks.label') }}</p>
              <button v-if="!isEditingSocialLinks" class="pm__edit-btn" :aria-label="t('profil.socialLinks.edit')" @click="startEditSocialLinks">
                <v-icon size="15">mdi-pencil-outline</v-icon>
              </button>
            </div>

            <template v-if="isEditingSocialLinks">
              <div class="pm__social-form">
                <div v-for="key in SOCIAL_LINK_KEYS" :key="key" class="pm__social-field">
                  <ProfilSocialLinkIcon :platform="key" :size="16" class="pm__info-icon" />
                  <input
                    v-model="socialLinksInput[key]"
                    type="url"
                    class="pm__select pm__social-input"
                    :placeholder="t('profil.socialLinks.placeholder')"
                    :disabled="isSavingSocialLinks"
                  />
                </div>
              </div>
              <div class="pm__bio-footer">
                <div class="pm__bio-actions">
                  <button class="pm__action-btn pm__action-btn--cancel" @click="cancelEditSocialLinks">
                    {{ t('profil.cancel') }}
                  </button>
                  <button class="pm__action-btn pm__action-btn--save" :disabled="isSavingSocialLinks" @click="saveSocialLinks">
                    {{ isSavingSocialLinks ? '…' : t('profil.save') }}
                  </button>
                </div>
              </div>
              <p v-if="socialLinksError" class="pm__error">{{ socialLinksError }}</p>
            </template>

            <div v-else-if="socialLinksList.length > 0" class="pm__social-list">
              <a
                v-for="entry in socialLinksList"
                :key="entry.key"
                :href="entry.url"
                target="_blank"
                rel="noopener noreferrer"
                class="pm__social-link"
                :aria-label="entry.key"
              >
                <ProfilSocialLinkIcon :platform="entry.key" :size="18" />
              </a>
            </div>
            <p v-else class="pm__bio">{{ t('profil.socialLinks.none') }}</p>
          </div>

        </div>

        <!-- Déconnexion -->
        <button class="pm__logout" :disabled="isLoggingOut" @click="handleLogout">
          <v-icon size="18">mdi-logout</v-icon>
          {{ t('auth.logout') }}
        </button>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
/* ── Conteneur mobile : header fixe + corps scrollable ── */
.pm {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px); /* 64px = bottom nav */
  overflow: hidden;
  font-family: var(--nq-font);
}

.pm__head {
  flex-shrink: 0;
  padding: 0 1rem;
}

.pm__title {
  font-family: var(--nq-font);
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--nq-brown-dark, #3A1A0A);
  margin: 0;
}

.pm__body {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0.5rem 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Page carnet (fond) ── */
.pm__book {
  width: 100%;
  max-width: 440px;
  background-image: url('/images/backgrounds/carnet-page-unique.png');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  padding: 2.5rem 2rem 2rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pm__section--profil,
.pm__section--social {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
}

.pm__page-divider {
  width: 70%;
  border: none;
  border-top: 1px dashed rgba(var(--nq-brown-rgb), 0.35);
  margin: 1.5rem 0;
}

/* Avatar */
.pm__avatar-wrap {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--nq-brown);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  flex-shrink: 0;
}

.pm__avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

.pm__avatar-initial {
  font-family: var(--nq-font);
  font-size: 1.6rem;
  font-weight: bold;
  color: #edc78e;
  user-select: none;
}

.pm__avatar-loading {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pm__avatar-edit-btn,
.pm__avatar-remove-btn {
  position: absolute;
  bottom: -2px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--nq-cream);
  background: var(--nq-brown);
  color: #edc78e;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.pm__avatar-edit-btn { right: -2px; }
.pm__avatar-remove-btn { left: -2px; background: var(--nq-red); }
.pm__avatar-edit-btn:disabled,
.pm__avatar-remove-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.pm__avatar-input { display: none; }

/* Selects (pays, date de naissance) */
.pm__select {
  padding: 3px 9px;
  border-radius: 999px;
  font-family: var(--nq-font);
  font-size: 0.75rem;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  background: var(--nq-beige);
  color: var(--nq-brown-dark);
  min-height: 30px;
}

/* Réseaux sociaux */
.pm__social-form { width: 100%; display: flex; flex-direction: column; gap: 7px; }
.pm__social-field { display: flex; align-items: center; gap: 7px; }
.pm__social-input { flex: 1; border-radius: 8px; font-size: 0.8rem; }

.pm__social-list { display: flex; flex-wrap: wrap; gap: 9px; }

.pm__social-link {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--nq-beige);
  color: var(--nq-brown-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s;
}

.pm__social-link:hover { background: rgba(var(--nq-brown-rgb), 0.2); }

.pm__name { font-size: 1.25rem; font-weight: bold; color: var(--nq-brown-dark); text-align: center; margin: 0; }
.pm__username { font-size: 0.85rem; color: var(--nq-brown); margin: -0.35rem 0 0; }

/* Badges */
.pm__badges { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }

.pm__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  padding: 3px 9px;
  border-radius: 999px;
}

.pm__badge--ok { background: var(--nq-success-bg); color: var(--nq-success-text); }
.pm__badge--warn { background: var(--nq-warning-bg); color: var(--nq-warning-text); }

.pm__divider { width: 100%; border: none; border-top: 1px solid rgba(var(--nq-brown-rgb), 0.15); margin: 0.1rem 0; }

/* Infos */
.pm__info-list { list-style: none; padding: 0; margin: 0; width: 100%; display: flex; flex-direction: column; gap: 0.55rem; }

.pm__info-row {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 0.85rem;
  color: var(--nq-brown-dark);
}

.pm__info-icon { color: var(--nq-brown); flex-shrink: 0; }

.pm__info-row--visibility { flex-wrap: wrap; gap: 6px; }

.pm__visibility-picker { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }

.pm__visibility-opt {
  padding: 3px 10px;
  border-radius: 999px;
  font-family: var(--nq-font);
  font-size: 0.75rem;
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  background: transparent;
  color: var(--nq-brown-dark);
  cursor: pointer;
  min-height: 30px;
  transition: background 0.1s;
}

.pm__visibility-opt:hover:not(:disabled) { background: rgba(var(--nq-brown-rgb), 0.08); }
.pm__visibility-opt--active { background: var(--nq-brown); color: #edc78e; border-color: var(--nq-brown); }
.pm__visibility-opt:disabled { opacity: 0.5; cursor: not-allowed; }

.pm__edit-btn { background: none; border: none; cursor: pointer; color: var(--nq-brown); padding: 2px; display: inline-flex; opacity: 0.7; }
.pm__edit-btn:hover { opacity: 1; }

/* Bio */
.pm__section { width: 100%; }

.pm__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem; }

.pm__section-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--nq-brown); margin: 0; }

.pm__bio { font-size: 0.85rem; color: var(--nq-brown-dark); line-height: 1.5; margin: 0; font-style: italic; opacity: 0.8; }

.pm__bio-textarea {
  width: 100%;
  background: var(--nq-beige);
  border: 1px solid rgba(var(--nq-brown-rgb), 0.3);
  border-radius: 8px;
  padding: 9px 11px;
  font-family: var(--nq-font);
  font-size: 0.85rem;
  color: var(--nq-brown-dark);
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.pm__bio-textarea:focus { outline: none; border-color: var(--nq-brown); }

.pm__bio-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; }

.pm__bio-count { font-size: 0.7rem; color: var(--nq-brown); opacity: 0.7; }
.pm__bio-count--warn { color: var(--nq-red); opacity: 1; font-weight: bold; }

.pm__bio-actions { display: flex; gap: 7px; }

.pm__action-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-family: var(--nq-font);
  font-size: 0.82rem;
  cursor: pointer;
  border: none;
  min-height: 34px;
}

.pm__action-btn--cancel { background: transparent; color: var(--nq-brown); border: 1px solid rgba(var(--nq-brown-rgb), 0.3); }
.pm__action-btn--cancel:hover { background: rgba(var(--nq-brown-rgb), 0.08); }
.pm__action-btn--save { background: var(--nq-brown); color: #edc78e; }
.pm__action-btn--save:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pm__action-btn--save:disabled { opacity: 0.5; cursor: not-allowed; }

.pm__error { font-size: 0.78rem; color: var(--nq-red); margin: 4px 0 0; }

/* Déconnexion */
.pm__logout {
  margin-top: 1.25rem;
  width: 100%;
  max-width: 440px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 20px;
  background: var(--nq-brown);
  color: var(--nq-cream-light);
  border: none;
  border-radius: 8px;
  font-family: var(--nq-font);
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 46px;
  transition: background 0.15s;
}

.pm__logout:hover:not(:disabled) { background: var(--nq-brown-dark); }
.pm__logout:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
