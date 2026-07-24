// Icone + couleur d'accent par plateforme (code du referentiel `platforms`),
// utilisees pour le badge plateforme affiche sur les cards de la collection.
// Le referentiel n'a pas encore de iconUrl renseigne en base : on retombe sur
// une icone mdi generique par plateforme en attendant.
export const PLATFORM_COLORS: Record<string, string> = {
  pc: '#4B5563',
  ps4: '#2E5AAC',
  ps5: '#0070D1',
  xbox_one: '#3A8E3A',
  xbox_series: '#107C10',
  switch: '#E60012',
  switch2: '#B3000C',
  steam_deck: '#1B2838',
}

export const PLATFORM_ICONS: Record<string, string> = {
  pc: 'mdi-desktop-tower-monitor',
  ps4: 'mdi-sony-playstation',
  ps5: 'mdi-sony-playstation',
  xbox_one: 'mdi-microsoft-xbox',
  xbox_series: 'mdi-microsoft-xbox',
  switch: 'mdi-nintendo-switch',
  switch2: 'mdi-nintendo-switch',
  steam_deck: 'mdi-steam',
}

export function getPlatformColor(code: string | null | undefined): string {
  if (!code) return 'transparent'
  return PLATFORM_COLORS[code] ?? '#8A8A8A'
}

export function getPlatformIcon(code: string | null | undefined): string {
  if (!code) return 'mdi-gamepad-variant'
  return PLATFORM_ICONS[code] ?? 'mdi-gamepad-variant'
}
