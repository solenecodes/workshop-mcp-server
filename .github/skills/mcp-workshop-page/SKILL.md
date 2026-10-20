---
name: mcp-workshop-page
description: "Créer ou adapter une page web de workshop ou de formation interactive, en anglais, avec un cours animé, un lab en direct (commande curl modifiable à gauche, vraie réponse JSON surlignée sur fond noir à droite), un menu d'agenda de la journée cliquable et un bandeau « Now » en heure de Paris. Utiliser pour un workshop MCP, une démo d'API ou de serveur MCP appelé pour de vrai depuis le navigateur, une page à partager aux participants (GitHub Pages), ou pour reproduire cette page dans un autre dépôt."
argument-hint: "Sujet du workshop, agenda de la journée, URL du serveur MCP ou de l'API, et étapes du lab souhaitées"
user-invocable: true
disable-model-invocation: false
---

# Page de workshop interactive (cours + lab en direct + agenda)

## Ce que fait la page

Une page statique (HTML, CSS et JavaScript natifs, aucune dépendance) pour animer un workshop :

- **Cours** en chapitres courts avec schémas animés (flux d'un appel, comparaisons, étapes numérotées).
- **Lab en direct** : des étapes où le participant voit la **commande `curl`** à gauche (valeur par défaut, **modifiable**) et la **vraie réponse JSON** à droite. Le texte qui change d'une étape à l'autre est surligné, tout comme les champs importants de la réponse. Un bouton exécute la même requête depuis le navigateur.
- **Menu de gauche** : l'agenda complet de la journée, chaque étape est cliquable. Les chapitres de la session en cours sont rangés sous leur étape.
- **Bandeau du haut** : l'étape « Now » en heure de Paris, avec l'étape d'avant et celle d'après en gris.
- **Chapitre sécurité** : une animation qui montre 401, 403 et l'accès autorisé du serveur protégé.

Le thème visuel (clair, cartes, bleu Fluent, code et JSON sur fond noir) est décrit dans [design.md](./references/design.md).

## Quand l'utiliser

- Un workshop ou une formation où les participants doivent appeler une API ou un serveur MCP pour de vrai, sans rien installer.
- Une page à donner aux participants avec un simple lien.
- **Ne pas l'utiliser** pour une simple vitrine sans appels réels : la structure du lab n'a alors pas d'intérêt.

## Ressources

- [Design](./references/design.md) : variables CSS, composition, mouvement, responsive, accessibilité.
- [Architecture et composants](./references/architecture.md) : rôle de chaque fichier, modèle de données, routage, sécurité.
- [Checklist d'adaptation](./references/adapting.md) : quoi changer pour un autre sujet, serveur, agenda.
- [Modèle de départ](./assets/starter/) : les 5 fichiers de la page et un test, prêts à copier.

## Procédure

1. **Cadrer.** Demander (outil de questions) le sujet, le public, l'agenda (horaires, durées, intitulés), l'URL publique du serveur et le serveur protégé s'il y en a un. Ne jamais mettre le nom d'un client sur une page publique sans qu'il le demande.
2. **Copier le modèle** [assets/starter](./assets/starter/) dans le projet, par exemple `sessions/<nom>/` pour la page et `tests/` pour le test. Ajuster les chemins d'import du test si l'arborescence change.
3. **Adapter** en suivant la [checklist](./references/adapting.md) : étapes du lab (`labSteps`), outils autorisés (`mcp-console.mjs`), URL par défaut, agenda et horaires, chapitres du cours, textes. Tout le texte visible est en **anglais**, court et clair.
4. **Vérifier que le serveur accepte le navigateur** : transport JSON sans session, CORS limité à l'origine exacte de la page, aucun jeton envoyé par le navigateur. Détails dans [l'architecture](./references/architecture.md).
5. **Valider** : lancer les tests, puis ouvrir la page dans un vrai navigateur à 375, 768 et 1440 px. Contrôler : aucune erreur de console, pas de débordement horizontal, lab exécuté pour de vrai (chaque étape), commande modifiée puis exécutée, bandeau et agenda avec `?time=HH:MM`, clavier et mouvement réduit.
6. **Publier** (GitHub Pages par exemple) en changeant le suffixe de cache `?v=...` des fichiers modifiés, attendre la mise en ligne, puis refaire le test sur l'adresse publique.
7. **Résumer** : fichiers changés, adresses, ce qui a été vérifié pour de vrai.

## Règles à ne pas casser

- **Vérité d'abord** : la réponse affichée est celle du serveur. En cas d'échec, afficher l'erreur réelle, jamais une réponse de démonstration. Limite de 60 s par appel, message explicite en cas de dépassement.
- **Lecture seule depuis la page** : le bouton n'envoie que les méthodes et outils de la liste autorisée (`tools/list` et les outils déclarés). Une commande modifiée est relue : seul le JSON après `-d` compte, **l'adresse tapée dans le texte est ignorée**.
- **Jamais de jeton dans la page.** Le navigateur appelle l'endpoint public sans identifiants. Les endpoints protégés se testent dans un terminal.
- **Texte non fiable** : afficher les valeurs dynamiques avec `textContent`, jamais `innerHTML`. Le JSON coloré est construit avec des `span`.
- **Accessibilité** : liens et boutons réels, focus visible, `aria-current` sur l'étape courante, mouvement réduit respecté, émojis décoratifs en `aria-hidden`.
- **Sans JavaScript** le contenu reste lisible ; le lab indique qu'il faut JavaScript.

## Pièges déjà rencontrés

- Une règle `@media` placée **avant** les règles de base est écrasée : mettre les surcharges mobiles **après**.
- La barre de chapitres mobile utilise `display:contents` : ne pas imbriquer d'éléments qui doivent rester visibles dans un parent masqué.
- Le raccourci clavier flèche gauche/droite doit ignorer `[contenteditable]` et les champs de saisie, sinon éditer la commande change de chapitre.
- Après un test à 375 px, **remettre la fenêtre du navigateur partagé en 1440 px**.
- Les captures d'écran du navigateur peuvent être en retard : relire le DOM pour confirmer.
- Changer les suffixes `?v=` en même temps dans le HTML et dans les `import` du JavaScript, sinon le navigateur garde l'ancien module.
