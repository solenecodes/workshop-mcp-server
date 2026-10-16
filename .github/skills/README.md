# Skills du projet

## Azure Showcase Web

Le skill [azure-showcase-web](azure-showcase-web/SKILL.md) permet de créer une
présentation web interactive au thème clair Azure/Foundry. Il contient ses
[règles visuelles](azure-showcase-web/references/design-system.md) et son
[modèle HTML autonome](azure-showcase-web/assets/starter.html).

### Appel explicite dans le chat Copilot

Ouvrir la racine du dépôt dans VS Code, puis saisir :

```text
/azure-showcase-web Crée la présentation web de la session 1 « Serveur MCP :
les fondamentaux » dans sessions/01-mcp-fondamentaux/presentation.html.
Appuie-toi sur le README de la session et ses guides de démo et de mini-hack.
Garde le serveur fil rouge des sessions 1, 2 et 6. Utilise le thème clair,
des schémas et un parcours interactif. Aucun nom de client ou de personne.
Ne présente pas les exemples comme des appels réels.
```

Le skill peut aussi être sélectionné automatiquement lorsqu'une demande
correspond à sa description. Pour le demander sans commande slash :

```text
Utilise le skill azure-showcase-web de .github/skills/ pour générer la
présentation web interactive de la session 1.
```

### Vérifier sa détection

- Le fichier doit se trouver dans `.github/skills/azure-showcase-web/SKILL.md`.
- Le champ `name` doit correspondre au nom du dossier.
- Le frontmatter YAML doit contenir `name` et une `description` explicite.
- Les ressources du skill doivent rester à leurs chemins relatifs.
- Dans le chat, saisir `/` et rechercher `azure-showcase-web`.
- Si le skill n'apparaît pas, consulter les diagnostics de personnalisation
  de Copilot et recharger la fenêtre VS Code après le déplacement.

La présence des fichiers et leur format peuvent être vérifiés dans le dépôt ;
la disponibilité de la commande dépend aussi de la version de VS Code/Copilot
et des politiques de l'environnement. Une conversation déjà ouverte peut
conserver une ancienne liste de skills.
