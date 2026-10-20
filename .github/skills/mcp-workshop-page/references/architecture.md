# Architecture de la page

## Fichiers du modèle

| Fichier | Rôle |
| --- | --- |
| `presentation.html` | Contenu : barre du haut, menu de gauche (agenda), chapitres du cours, lab, chapitre sécurité, panneaux d'agenda, bibliothèque d'icônes SVG (`<symbol>`). |
| `presentation.css` | Thème clair (variables `--blue`, `--border`...), cartes, schémas, lab sombre, agenda, bandeau « Now », responsive, impression. Les surcharges mobiles sont à la fin. |
| `presentation.js` | Routage des chapitres par `location.hash`, animations (flux, intégration), lab, agenda, bandeau « Now », copie, partage, impression. |
| `presentation-lab.mjs` | Données et fonctions pures du lab : `labSteps`, `labCommand`, `parseCommandRequest`, `validateEndpoint`, `shareUrl`, `securityCode`. Testable sans navigateur. |
| `mcp-console.mjs` | `jsonTokens` (colorisation JSON sûre) et `callMcp` (une requête JSON-RPC en lecture seule, avec liste d'outils autorisés). |
| `tests/presentation.test.mjs` | Tests des fonctions pures et du HTML statique. |

## Modèle de données du lab

Chaque étape de `labSteps` décrit :

```js
{
  short: 'One ticket',            // libellé de l'onglet
  title: 'Read one ticket',       // titre de l'étape
  why: 'One or two short sentences explaining the step.',
  tool: 'get_ticket', args: { ticketId: 'CT-1001' },   // ou method: 'tools/list'
  changes: ['get_ticket', '{"ticketId":"CT-1001"}'],   // textes surlignés dans la commande
  focus: ['id', 'title', 'status'],                    // clés surlignées dans la réponse
  notice: 'what to look at in the response.',
}
```

- `labCommand(index, settings)` construit la requête JSON-RPC, la commande `curl` et les `segments` (texte, surligné ou non).
- `changes` doit contenir des chaînes qui apparaissent **une seule fois** dans la commande.
- `focus` surligne toute la ligne des clés listées, valeur comprise (`jsonTokens(value, focus)`).
- `parseCommandRequest(texte)` relit le JSON après `-d` (apostrophes ou guillemets) et lève une erreur claire si c'est invalide.

## Commande modifiable

- Le `<code>` du lab est `contenteditable="plaintext-only"`. Les modifications sont gardées **par étape** (`stepEdits`) et vidées quand l'adresse du serveur change.
- Tant que rien n'est modifié, la commande est affichée avec son surlignage. Après modification, le texte est brut et le bouton **Reset command** apparaît.
- **Copy command** copie le texte courant. **Run it from this page** exécute `parseCommandRequest(texte)` puis `callMcp(adresseConfigurée, requête)`.

## Contrat attendu du serveur

- Transport **JSON sans session** : `POST`, en-têtes `Content-Type: application/json` et `Accept: application/json, text/event-stream`, réponse JSON (pas de flux). Une requête `tools/list` ou `tools/call` suffit, sans `initialize`.
- **CORS** pour l'endpoint public : `Access-Control-Allow-Origin` = l'origine exacte de la page (pas `*`), méthode `POST`, en-têtes `Content-Type`, `Mcp-Protocol-Version`, `Mcp-Session-Id`, jamais de cookies, refus de toute requête de navigateur qui porte `Authorization`.
- Erreurs métier : résultat avec `isError: true` et un `structuredContent` qui contient un code et un message.
- Réponses limitées en débit, avec `429` et `Retry-After` (la page affiche le délai).

## Routage et chapitres

- Chaque `section.chapter` est un chapitre. Un seul est visible, choisi par le hash (`#why`, `#lab`, `#auth`).
- Les panneaux d'agenda sont des `section.chapter.agenda-panel` **exclus** de la pagination (`.chapter:not(.agenda-panel)`).
- Les liens de l'agenda vers une session avec contenu pointent vers son chapitre ; les autres ouvrent un panneau `#day-<clé>`.
- Sans JavaScript, tous les chapitres restent visibles.

## Agenda et bandeau « Now »

- Chaque `li` de l'agenda porte `data-key`, `data-short` (nom court pour le bandeau), `data-start` et `data-end` (`HH:MM`).
- `updateDayStrip()` calcule l'heure à Paris avec `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris' })`, trouve l'étape en cours, puis affiche l'étape d'avant et celle d'après en gris, avec l'horaire seulement. Mise à jour toutes les 30 s.
- `?time=HH:MM` fige l'heure (répétition). Avant la première étape : « Starts at ... ». Après la dernière : « The day is over ».
- Sur téléphone, seule l'étape en cours reste visible.
- Le menu de gauche suit le contenu à l'écran (`aria-current`), pas l'heure.

## Coloration JSON

`jsonTokens(valeur, focus)` découpe `JSON.stringify(valeur, null, 2)` en jetons (clé, chaîne, nombre, booléen, null) avec une expression régulière. L'affichage crée un `span` par jeton avec `textContent`. Couleurs sur fond `#0d1117` : clés bleu clair, chaînes orange, nombres vert, booléens bleu, null violet. Les jetons `focus` reçoivent un fond jaune translucide.

## Cache

Les fichiers sont chargés avec un suffixe `?v=...`. Le changer dans le HTML (CSS et script) **et** dans les `import` de `presentation.js` à chaque publication.

## Tests recommandés

- Fonctions pures : commande générée, segments surlignés, `parseCommandRequest`, `validateEndpoint`, `shareUrl`.
- Colorisation JSON : le texte reconstitué est identique à `JSON.stringify`, aucune injection HTML.
- HTML : présence des identifiants du lab, absence de mots d'un ancien sujet, absence de texte non anglais.
- Appels réels : lancer le vrai serveur en local et exécuter chaque étape du lab, plus une commande modifiée.
