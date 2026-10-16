# Référence visuelle

## Origine et portée

Style extrait des pages Insurance et Banque privée du projet
`accelerate-with-foundry`. Les pages racine et Claims sont des redirections :
elles ne constituent pas la référence graphique.

La signature est celle d'une présentation métier interactive, pas d'un diaporama
plein écran : sections à ancres, cartes SaaS, schémas, comparatifs et parcours.
Les règles d'accessibilité ci-dessous renforcent le modèle ; elles ne constituent
pas une déclaration de conformité des pages d'origine.

## Tokens exacts

```css
:root {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-2: #fafbfc;
  --border: #e4e7ec;
  --border-strong: #d0d5dd;
  --text: #101828;
  --text-2: #475467;
  --text-3: #8a94a6;
  --azure: #0078d4;
  --azure-dark: #005a9e;
  --azure-50: #eff6fc;
  --azure-100: #deecf9;
  --green: #0f7b3f;
  --green-500: #1f9d55;
  --green-50: #ecf8f1;
  --amber: #a15c00;
  --amber-500: #d98b00;
  --amber-50: #fff6e5;
  --radius: 14px;
  --radius-sm: 10px;
  --radius-xs: 6px;
  --shadow-sm: 0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06);
  --shadow-md: 0 6px 16px rgba(16,24,40,.07), 0 2px 4px rgba(16,24,40,.04);
  --shadow-lg: 0 18px 44px rgba(16,24,40,.12), 0 4px 10px rgba(16,24,40,.05);
  --ease: cubic-bezier(.22,.61,.36,1);
  --container: 1200px;
  --nav-h: 60px;
  --font: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
}
```

Inter est seulement le premier choix de la pile : aucune police externe n'est
nécessaire. Ne pas ajouter un téléchargement Google Fonts pour la reproduire.
`--text-3` est réservé aux détails non essentiels ; utiliser `--text-2` pour le
texte à lire et vérifier le contraste des petits caractères et badges.

## Composition

| Élément | Traitement |
| --- | --- |
| Page | Fond gris clair, surfaces blanches, accents bleus |
| Conteneur | `width: min(var(--container), 100% - 48px)` ; centré |
| Navigation | Sticky, 60 px, fond translucide, `blur(14px) saturate(180%)` |
| Hero | `padding: 72px 0 56px`, halos radiaux bleu/vert, points discrets |
| Titres | `letter-spacing: -.02em`, interligne `1.2` |
| Texte | Interligne `1.55`, couleur secondaire pour les descriptions |
| Eyebrow | `0.75rem`, gras, capitales, espacement `0.08em` |
| Boutons | Pilules, min. 40 px de haut, `0.9rem`, graisse 600 |
| Cartes | Bordure 1 px, rayon 14 px, ombre légère, padding 24 px conseillé |
| Icônes | SVG linéaire, 20 px, trait 1.75, extrémités arrondies |
| Badges | Petits fonds Azure/vert/ambre pâles ; sens explicite par texte |

Le vert indique une réussite ou un bénéfice. L'ambre indique une attention ou une
contrainte, pas une erreur fatale. Ne jamais utiliser uniquement la couleur pour
communiquer un état.

## Composants à choisir selon le sujet

- Navigation par ancres et liens actifs en pilules.
- Cartes de capacités avec icône sur fond coloré.
- Comparaison avant/après avec deux panneaux.
- Indicateurs et tableaux compacts, accompagnés de leur source ou hypothèse.
- Parcours métier : contexte, étapes sélectionnables et panneau explicatif.
- Écosystème : services et outils sous forme de chips ou logos autorisés.
- Simulateur : contrôles étiquetés, unités et hypothèses visibles, résultat mis à jour.
- Drawer : explication détaillée, seulement si la page le justifie.

Le modèle utilise des boutons d'étapes avec `aria-pressed`, pas de faux onglets
ARIA. Si de vrais onglets sont requis, implémenter le pattern complet :
`tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls` et navigation
clavier avec flèches/Home/End et tabulation cohérente.

## Mouvement

| Effet | Valeurs de référence | Usage |
| --- | --- | --- |
| `revealUp` | Opacité 0 → 1, `translate: 0 16px` → `0 0`, 500 ms | Entrée unique au scroll |
| Stagger | `index * 100ms` | Cartes d'un même groupe |
| Hover bouton | `translateY(-1px)`, 200 ms | Souris fine uniquement |
| Hover icône | `scale(1.06) rotate(-4deg)`, 350 ms | Accent léger |
| Navigation | Couleurs 200 ms, fond/bordure 300 ms | État scrolled |
| `boxIn` | `scale(1.08)` → `1`, 500 ms ; délai `350ms + index * 110ms` | Simulation documentaire optionnelle |
| `livePulse` | Halo vert jusqu'à 7 px, cycle 2 s | Seulement pour un état réellement actif |
| `spin` | Rotation `-360deg`, 600 ms | Action de relance explicite |

Easing commun : `cubic-bezier(.22,.61,.36,1)`. Privilégier opacité et transforms.
Ne pas animer la hauteur d'une longue section ni imposer des effets infinis.
Le modèle omet volontairement pulsation et lecture automatique : elles ne sont
pas nécessaires pour reproduire l'identité visuelle.

## Responsive et robustesse

- Vers 1100 px : réduire les grilles et les compositions côte à côte.
- Vers 760 px : adapter la navigation, garder les destinations accessibles.
- Vers 640 px : cartes sur une colonne, contrôles empilés, padding réduit.
- Autoriser le scroll horizontal d'un tableau ou d'une rangée d'onglets, pas de
  toute la page. Préserver des cibles tactiles confortables.
- Ancres : `scroll-padding-top: calc(var(--nav-h) + 16px)`.
- Focus visible : contour Azure de 2 px avec décalage.
- Prévoir un lien d'évitement, des titres ordonnés et des noms accessibles.
- Sans JS, montrer le contenu et les étapes sous forme lisible.
- Sous `prefers-reduced-motion: reduce`, désactiver les effets et le scroll doux ;
  rendre immédiatement visibles les éléments déjà en attente de révélation.
