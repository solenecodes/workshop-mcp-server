---
name: azure-showcase-web
description: "Créer des sites web, landing pages et présentations interactives dans le style de ce projet : thème clair Azure/Foundry, cartes SaaS, navigation translucide, animations au scroll et parcours métier. Utiliser pour reproduire ce style, ce thème, ces animations, ou créer une vitrine interactive similaire, même dans un autre dépôt."
argument-hint: "Sujet du site, public cible et sections souhaitées"
user-invocable: true
disable-model-invocation: false
---

# Sites interactifs au style Azure Showcase

## Objectif

Créer un site complet dans le langage visuel de cette présentation, sans
reproduire automatiquement son contenu assurance, ses marques ou ses chiffres.
Le résultat doit être élégant, lisible, responsive et réellement interactif.

## Ressources à charger

- Lire [le système de design](./references/design-system.md) avant de concevoir la page.
- Pour un nouveau site statique, partir du [modèle autonome](./assets/starter.html).
  Il contient le thème, la navigation mobile, les cartes, un parcours à étapes,
  les animations et leur variante sans mouvement.
- Le modèle et les références sont autonomes : aucun fichier du dépôt d'origine
  n'est requis. Ne pas copier les chemins absolus de l'environnement.

## Procédure

### 1. Cadrer et inspecter

1. Identifier le sujet, le public, le message principal et l'action attendue.
2. Lire les instructions et la structure du projet cible. Identifier le framework,
   les composants, les assets et les commandes de validation déjà disponibles.
3. Si une décision structurante manque, poser une question ciblée avec l'outil de
   questions disponible. Ne pas bloquer pour des détails purement décoratifs.
4. Préserver les modifications existantes. Ne jamais remplacer une page ou une
   redirection sans que cela fasse partie de la demande.

### 2. Construire la narration

Adapter les sections au besoin ; ne pas toutes les imposer :

1. Hero : eyebrow, promesse claire, description courte, un CTA principal et un secondaire.
2. Vue d'ensemble : trois ou quatre cartes de bénéfices ou de capacités.
3. Fonctionnement : étapes reliées ou schéma explicatif.
4. Cas d'usage : cartes métier, éventuellement comparaison avant/après.
5. Parcours interactif : sélectionner une étape pour afficher son contenu.
6. Valeur : indicateurs sourcés ou explicitement illustratifs.
7. Écosystème, FAQ ou contact selon le sujet.

Écrire le contenu dans la langue demandée. Ne pas inventer de clients, résultats,
prix, témoignages ou promesses de conformité. Signaler les données de démonstration.

### 3. Appliquer le style

- Garder la palette claire, la grille aérée et les accents Azure.
- Réutiliser les tokens, rayons, ombres, tailles et timings de la référence.
- Préférer des pictogrammes SVG linéaires aux emoji décoratifs.
- Utiliser les halos et points seulement comme arrière-plan discret du hero.
- Conserver une hiérarchie nette : titres compacts, textes secondaires sobres,
  petits badges, chiffres lisibles et CTA en pilule.
- Ne pas dériver vers un thème sombre, du glassmorphism omniprésent, des dégradés
  flashy, des animations permanentes ou de grandes illustrations sans rapport.
- Utiliser uniquement des assets disponibles et autorisés. Ne pas imposer le logo
  Foundry ou Microsoft à un sujet qui ne le justifie pas.

### 4. Implémenter sans dépendances inutiles

- Projet existant : traduire le modèle dans sa stack et réutiliser ses composants ;
  ne pas introduire de framework ou de bibliothèque d'animation par défaut.
- Nouveau site simple : HTML sémantique, CSS et JavaScript natifs suffisent.
- Mettre les contenus répétitifs en données seulement si cela apporte une vraie
  simplification. Préférer `textContent` pour les valeurs dynamiques.
- Utiliser de vrais liens et boutons. Chaque CTA doit avoir une destination ou une
  action réelle. Omettre les fonctions non implémentées plutôt que les simuler.
- Faire fonctionner chaque contrôle ajouté : navigation mobile, étapes, onglets,
  filtres, simulateur ou panneau de détail.
- Une lecture automatique est optionnelle et désactivée initialement. Si demandée,
  fournir pause/reprise, arrêter le minuteur au démontage ou changement de contexte,
  et ne pas démarrer automatiquement en mode mouvement réduit.
- Un drawer modal doit gérer Escape, le focus initial, le confinement du focus,
  le retour au déclencheur et un nom accessible. Ne pas copier uniquement son aspect.

### 5. Animer avec sobriété

- Révélation unique au scroll : opacité + `translate` vertical de 16 px, 500 ms.
- Décaler les cartes de 100 ms ; recommencer l'index dans chaque groupe.
- Employer `translate` pour les apparitions et `transform` pour les hovers afin de
  ne pas les faire entrer en conflit.
- Garder le contenu visible sans JavaScript, sans IntersectionObserver et en cas
  d'échec d'initialisation. Ne jamais masquer tout le contenu dès le chargement.
- Respecter `prefers-reduced-motion` pour le CSS **et** les animations/minuteurs JS.
- Ne pas ajouter de parallaxe, curseur personnalisé ou animation lourde sans demande.

### 6. Vérifier et livrer

1. Exécuter la validation pertinente de la stack existante, sans installer d'outils
   supplémentaires si ce n'est pas nécessaire.
2. Si un navigateur est disponible, vérifier au minimum 375, 768 et 1440 px :
   absence de débordement global, lisibilité, navigation, CTA et interactions.
3. Tester le clavier : ordre de tabulation, focus visible, menu mobile, sélection
   des étapes et fermeture des panneaux éventuellement ajoutés.
4. Vérifier mouvement réduit, JavaScript désactivé, liens et assets locaux.
5. Contrôler la console et l'absence d'erreurs de chargement. Pour un mode hors
   ligne demandé, ne charger aucune police, image ou bibliothèque depuis un CDN.
6. Résumer les fichiers créés, les interactions disponibles et les vérifications
   effectivement réalisées. Ne pas annoncer de tests non exécutés.

## Exemples d'invocation

```text
/azure-showcase-web Crée une vitrine pour un cabinet de conseil en cybersécurité.
Garde le thème clair Azure, les cartes animées et un parcours interactif.
```

```text
Utilise azure-showcase-web pour adapter cette application React au même style,
sans changer ses fonctionnalités ni ajouter de bibliothèque d'animation.
```

## Réutilisation

Copier le dossier `azure-showcase-web` entier dans `.github/skills/` d'un autre
projet. Pour une installation personnelle Copilot, le copier dans
`~/.copilot/skills/`. Garder le nom du dossier identique au champ `name`.
