# Design de la page

Thème clair de type Microsoft Fluent : fond presque blanc, cartes blanches à bordure fine, un seul accent bleu-violet, icônes linéaires. Le code et le JSON du lab sont sur fond noir. Les valeurs ci-dessous sont celles de `presentation.css`.

## Variables

```css
:root {
  --bg:#fafafa; --surface:#fff; --border:#e0e0e0; --text:#242424; --muted:#616161;
  --blue:#5b5fc7; --blue-dark:#45499b; --blue-soft:#f0effa;
  --green:#107c10; --green-soft:#f1faf1; --amber:#8a5100; --red:#b10e1c;
  --radius:8px; --shadow:0 2px 4px rgb(0 0 0 / 4%);
  --ease:cubic-bezier(.22,.61,.36,1);
  --font:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  --mono:ui-monospace,"Cascadia Code",Consolas,monospace;
}
```

- Aucune police externe : la pile système suffit.
- Vert = réussite, ambre = attention, rouge = erreur. Ne jamais communiquer un état par la couleur seule : ajouter un texte.
- `--muted` pour le texte secondaire ; vérifier le contraste des petits caractères.

## Composition

| Élément | Traitement |
| --- | --- |
| Page | Dégradé très léger `#f4f3fb` vers `--bg`, surfaces blanches |
| Barre du haut | Collante, 72 px, fond blanc, bordure basse ; contient la marque et le bandeau « Now » |
| Menu de gauche | Collant, 244 px, défile seul si l'agenda est long ; devient une barre horizontale sous 850 px |
| Titres | Interligne 1,25, `letter-spacing:-.02em`, `clamp(1.75rem,3vw,2.5rem)` |
| Eyebrow | Petite ligne bleue avec icône, au-dessus du titre ; le libellé « Your turn » est sur fond bleu |
| Cartes | Bordure 1 px, rayon 8 px, ombre légère, padding 24 px |
| Boutons | Hauteur minimale 44 px ; le bouton principal est plein bleu |
| Icônes | SVG linéaires 24 px (20 px en ligne), trait 1,7, extrémités arrondies, définies une fois dans `<svg class="icon-library">` puis appelées avec `<use href="#i-...">` |
| Lab | Deux colonnes, fond `#0d1117`, texte `#e6edf3`, surlignage jaune translucide pour ce qui change et pour les champs importants |
| Bandeau « Now » | Bloc plein `--blue`, texte blanc, halo et barre de progression ; avant/après en gris sans détails |

## Mouvement

- Les animations montrent un enchaînement (paquets lumineux d'une brique à l'autre) ; pas d'effet décoratif permanent.
- Transitions de 200 à 300 ms avec `--ease`, privilégier opacité et `transform`.
- Sous `prefers-reduced-motion: reduce`, couper les animations : les schémas restent lisibles avec les flèches et les étapes numérotées.

## Responsive et robustesse

- Vers 1100 px : le bandeau ne garde que l'étape en cours.
- Vers 850 px : le menu de gauche devient une barre horizontale ; l'agenda complet est masqué, seuls les chapitres restent.
- Vers 600 px : colonnes du lab empilées, marges réduites, horloge masquée.
- Autoriser le défilement horizontal d'une zone de code, jamais de toute la page ; contrôler à 375, 768 et 1440 px.
- `scroll-padding-top:88px` pour que la barre collante ne cache pas les ancres.
- Focus visible (contour de 2 px), lien d'évitement, titres ordonnés, noms accessibles, `aria-current` sur l'étape courante.
- Sans JavaScript, tout le contenu reste lisible.
- Impression : masquer barre, menu, boutons et panneaux d'agenda ; ouvrir tous les `<details>`.
