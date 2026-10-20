# Skills du projet

Ce dépôt contient **un seul skill**, partagé avec le dépôt.

## MCP Workshop Page

Le skill [mcp-workshop-page](mcp-workshop-page/SKILL.md) crée ou adapte une page
web de workshop interactive, en anglais : cours animé, lab en direct (commande
`curl` modifiable à gauche, vraie réponse JSON surlignée sur fond noir à droite),
agenda de la journée cliquable et bandeau « Now » en heure de Paris.

Il contient :

- [la procédure et les règles](mcp-workshop-page/SKILL.md) ;
- [le design](mcp-workshop-page/references/design.md) et
  [l'architecture](mcp-workshop-page/references/architecture.md) ;
- [la checklist d'adaptation](mcp-workshop-page/references/adapting.md) ;
- [un modèle prêt à copier](mcp-workshop-page/assets/starter/), basé sur la page
  de ce dépôt (`sessions/01-mcp-fondamentaux/`), avec son test.

### Appel explicite dans le chat Copilot

Ouvrir la racine du dépôt dans VS Code, puis saisir :

```text
/mcp-workshop-page Crée une page de workshop sur <sujet>. Agenda : <horaires et
étapes>. Serveur MCP public : <URL>. Lab en <n> étapes : <étapes>.
```

Le skill est aussi chargé automatiquement quand une demande correspond à sa
description (workshop, lab en direct, serveur MCP appelé depuis le navigateur,
page à partager aux participants).

### Le réutiliser dans un autre dépôt

Copier le dossier `mcp-workshop-page/` dans `.github/skills/` de l'autre dépôt, ou
dans `~/.copilot/skills/` pour l'avoir dans tous les dépôts.

### Vérifier sa détection

- Le fichier doit se trouver dans `.github/skills/mcp-workshop-page/SKILL.md`.
- Le champ `name` doit correspondre au nom du dossier.
- Dans le chat, saisir `/` et rechercher `mcp-workshop-page`.
- Si le skill n'apparaît pas, consulter les diagnostics de personnalisation de
  Copilot et recharger la fenêtre VS Code. Une conversation déjà ouverte peut
  conserver une ancienne liste de skills.
