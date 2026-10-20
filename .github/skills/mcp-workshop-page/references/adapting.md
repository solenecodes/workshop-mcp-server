# Adapter la page à un autre workshop

## 1. Le lab

1. Dans `presentation-lab.mjs`, remplacer `defaultEndpoint` et `defaultProtectedEndpoint` par les vraies adresses HTTPS (`.../mcp`). Elles sont publiques dans la page.
2. Réécrire `labSteps` : une étape pour découvrir les outils (`method: 'tools/list'`), puis une étape par appel utile. Trois étapes suffisent souvent : découvrir, lister, lire un élément.
3. Dans `mcp-console.mjs`, mettre à jour l'ensemble `tools` avec les noms d'outils **en lecture seule** autorisés depuis la page.
4. Dans `presentation.html`, adapter le chapitre `#lab` : scénario (une phrase qui dit qui demande quoi à l'assistant), carte(s) de source de données, correspondance « outil → opération REST » (`.tool-map`).
5. Adapter `securityCode` (commande protégée) à un outil réel.

## 2. L'agenda

- Dans le `<ol class="agenda">`, un `li` par étape avec `data-key`, `data-short`, `data-start`, `data-end`, un émoji en rapport avec le thème, l'intitulé et la durée.
- Pour chaque étape sans contenu dans la page, ajouter une `section.chapter.agenda-panel` `id="day-<clé>"` (horaire, description, étape suivante).
- Le `li` de la session de la page contient le menu des chapitres (`.agenda-sub`). Mettre à jour `data-key="session-1"` et le test de la session 3 dans `showChapter` si les numéros changent.
- Conserver des intitulés neutres : pas de nom de client sur une page publique sans demande explicite.

## 3. Le cours

Les chapitres 1 à 4 du modèle parlent de MCP. Pour un autre sujet : garder la structure (une idée par chapitre, un schéma, une phrase de conclusion), réécrire les textes, et adapter les scénarios des flux dans `callSteps` et `authSteps` (`presentation.js`). Éviter le texte inutile.

## 4. Le style

- Thème clair, accent bleu, icônes SVG linéaires, cartes avec bordure fine. Réutiliser les variables CSS existantes.
- Code et JSON sur fond noir uniquement dans le lab.
- Pas d'animation permanente ; respecter `prefers-reduced-motion`.

## 5. Vérifications avant de livrer

- Tests : copier `tests/presentation.test.mjs`, adapter les noms d'outils et d'étapes, lancer `node --import tsx --test` (ou le lanceur du projet).
- Navigateur : 375, 768 et 1440 px, chaque étape du lab exécutée pour de vrai, une commande modifiée puis exécutée, `?time=` avant 9h, pendant la journée, après la fin.
- Publication : changer les suffixes `?v=`, pousser, attendre la mise en ligne, retester sur l'adresse publique.
- Dire clairement au participant l'adresse à utiliser ; recommander un test depuis le réseau du lieu (certains réseaux bloquent `github.io` ou l'hébergeur du serveur).
