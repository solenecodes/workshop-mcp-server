# Session 1 - Serveur MCP : les fondamentaux

[Retour au programme](../../README.md)

**Horaire : 09:20 - 10:20 (60 minutes).**

Cette session comprend les explications, les deux demonstrations de l'animation,
puis le cas pratique guide (mini-hack) realise par les participants. Ce cas
pratique fait partie de la session 1 ; il est distinct du hands-on de l'apres-midi.

Objectif a 10:20 : savoir expliquer le role d'un serveur MCP, avoir observe un
echange reel et avoir appele un outil.

## Serveur fil rouge

Le serveur utilise dans Inspector et le mini-hack sert aussi de base aux
[sessions 2](../02-architecture/README.md) et [6](../06-hands-on/README.md).
On conserve les outils et les donnees fictives ; les sessions suivantes ajoutent
leurs briques autour de ce socle, sans demander de reconstruire le cas pratique.

La demo 1 avec Azure MCP Server est une introduction distincte. Elle n'est pas
le serveur pedagogique a faire evoluer.

## Deroule

Le decoupage ci-dessous est une **proposition d'animation** dans le creneau de
60 minutes.

| Horaire | Duree | Activite |
| --- | --- | --- |
| 09:20 - 09:30 | 10 min | Pourquoi MCP ? Host, client, serveur et comparaison avec API/RAG |
| 09:30 - 09:40 | 10 min | Tools, resources, prompts, JSON-RPC et transports |
| 09:40 - 09:45 | 5 min | Demo 1 : GitHub Copilot et Azure MCP Server |
| 09:45 - 09:50 | 5 min | Demo 2 : les memes mecanismes dans MCP Inspector |
| 09:50 - 10:05 | 15 min | Cas pratique guide (mini-hack) : consulter puis modifier un service fictif |
| 10:05 - 10:15 | 10 min | Debrief : permissions du client et autorisation du serveur |
| 10:15 - 10:20 | 5 min | Questions et transition vers la gouvernance |

## Supports

- [Presentation web interactive](presentation.html) : fondamentaux, schemas,
  echanges illustratifs, transitions vers les demos et consigne du cas pratique.
- [Guide de la premiere demonstration](demo-1.md)
- [Guide MCP Inspector](demo-2-inspector.md)
- [Cas pratique guide (mini-hack) et contrat d'outils propose](mini-hack.md)
- [Configuration VS Code pour un serveur distant](examples/mcp.remote.example.json)

### Ouvrir la presentation

Ouvrir `presentation.html` dans un navigateur, ou utiliser un serveur statique
depuis la racine du depot :

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Puis ouvrir <http://localhost:8000/sessions/01-mcp-fondamentaux/presentation.html>.
Garder les trois fichiers `presentation.html`, `presentation.css` et
`presentation.js` ensemble pour une utilisation locale ou hors ligne.

La page ne charge aucune dependance distante. Les parcours sont selectionnables,
les notes d'animation sont repliables et un bouton permet d'imprimer ou
d'enregistrer en PDF via le navigateur. Les echanges affiches sont illustratifs :
la page ne se connecte pas au serveur MCP et ne remplace pas les demonstrations.
Sans JavaScript, les contenus des parcours restent tous lisibles.

Pour regenerer ou adapter la page avec le meme style, utiliser le
[skill du projet](../../.github/skills/README.md).

## Prerequis

### Participants

- VS Code a jour et GitHub Copilot utilisable en mode agent.
- Autorisation d'ajouter un serveur MCP distant et d'activer ses outils.
- Acces reseau HTTPS a l'endpoint d'atelier.
- Aucune donnee personnelle, aucun secret et aucune ressource de production.

### Animation

- Pour la demo 1 uniquement : Azure MCP Server configure et acces en lecture a un
  abonnement de demonstration ne contenant que des ressources fictives.
- Pour la demo 2 : MCP Inspector et une version de Node.js compatible avec la
  [version d'Inspector retenue](https://modelcontextprotocol.io/docs/tools/inspector).
- Pour le mini-hack : serveur de demonstration isole, donnees synthetiques,
  remise a zero et solution de repli testees.

## Connexion au futur serveur d'atelier

Le serveur reste a implementer et a deployer ; l'exercice n'est pas encore
executable dans l'etat actuel du depot.

1. Cloner ce depot et ouvrir sa racine dans VS Code.
2. Copier [la configuration d'exemple](examples/mcp.remote.example.json) dans
   `.vscode/mcp.json` a la racine du depot, sans ecraser une configuration existante.
3. Remplacer `https://mcp.example.invalid/mcp` par l'URL fournie par l'animation.
   L'URL d'exemple est volontairement non fonctionnelle.
4. Demarrer le serveur depuis la configuration MCP de VS Code et examiner la
   demande de confiance.
5. Dans le chat en mode agent, ouvrir la selection des outils et activer
   uniquement les outils necessaires a l'exercice.

Le dossier `.vscode/` est ignore par Git : la configuration locale et les
eventuels parametres propres a une session ne sont pas publies.
