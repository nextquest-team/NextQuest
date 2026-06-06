// Implementation maison de "Sign in through Steam" (OpenID 2.0).
// Steam ne propose pas d'OAuth : OpenID est le seul mecanisme d'identite.
// La verification se fait par "direct verification" (check_authentication) :
// on renvoie l'assertion a Steam qui repond is_valid:true/false. Pas de calcul
// de signature de notre cote, donc surface d'erreur minimale.

// Surchargeable via .env (mock en test d'integration), defaut = URL officielle.
const STEAM_OPENID_ENDPOINT =
  process.env.STEAM_OPENID_ENDPOINT ?? "https://steamcommunity.com/openid/login";

// Identifiants du protocole OpenID 2.0 (jamais appeles comme URLs) :
// definis par la spec, ils ne doivent jamais changer. Restent en dur.
const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";

// Steam renvoie toujours un claimed_id de cette forme exacte (https + chiffres).
const CLAIMED_ID_RE =
  /^https:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/;

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ text(): Promise<string> }>;

// URL de redirection vers la page de login OpenID de Steam.
export function buildSteamLoginUrl(params: {
  realm: string;
  returnTo: string;
}): string {
  const query = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": params.returnTo,
    "openid.realm": params.realm,
    // identifier_select : on laisse Steam nous dire de quel compte il s'agit.
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID_ENDPOINT}?${query.toString()}`;
}

// Extrait le SteamID64 d'un claimed_id. null si la forme n'est pas celle de Steam.
export function extractSteamId(claimedId: string): string | null {
  const match = CLAIMED_ID_RE.exec(claimedId);
  return match ? match[1] : null;
}

// Verifie l'assertion recue sur le callback aupres de Steam.
// Renvoie le SteamID64 si valide, null sinon.
export async function verifySteamAssertion(
  params: Record<string, string>,
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  const body = new URLSearchParams({
    ...params,
    "openid.mode": "check_authentication",
  });

  const res = await fetchImpl(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();

  if (!/is_valid:true/.test(text)) return null;

  const claimedId = params["openid.claimed_id"];
  return claimedId ? extractSteamId(claimedId) : null;
}
