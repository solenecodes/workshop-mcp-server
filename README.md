# Workshop MCP : des fondamentaux a la gouvernance

Supports publics pour decouvrir le Model Context Protocol (MCP), observer ses
echanges et comprendre comment passer d'un serveur de demonstration a un service
gouverne.

Tous les exercices utilisent des donnees fictives. Aucun acces a un environnement
d'entreprise n'est necessaire pour le mini-hack propose.

## Etat du depot

Ce depot contient le programme et une proposition de supports pour la premiere
partie. Il ne contient pas encore de serveur executable ni de deploiement.
Le mini-hack necessite donc la preparation d'un serveur et la communication de
son URL par l'equipe d'animation. Les noms d'outils presentes sont un contrat
pedagogique propose, pas des outils deja disponibles.

## Programme de la journee

Programme de reference ; les sequences optionnelles peuvent etre adaptees.

| Horaire | Duree | Sequence |
| --- | --- | --- |
| 09:00 - 09:20 | 20 min | Accueil, objectifs et tour de table |
| 09:20 - 10:20 | 60 min | Fondamentaux MCP, deux demonstrations et mini-hack |
| 10:20 - 10:35 | 15 min | Pause |
| 10:35 - 11:10 | 35 min | Architecture d'entreprise : API-first, hebergement et passerelle |
| 11:10 - 11:45 | 35 min | Securite et gouvernance : identites, droits et jetons |
| 11:45 - 12:30 | 45 min | Option : gouvernance des agents a l'echelle du tenant |
| 12:30 - 13:30 | 60 min | Dejeuner |
| 13:30 - 14:00 | 30 min | Echanges et selection d'un cas d'usage |
| 14:00 - 15:15 | 75 min | Hands-on : du serveur de demonstration au serveur gouverne |
| 15:15 - 15:30 | 15 min | Pause |
| 15:30 - 16:00 | 30 min | Application au cas d'usage et prochaines etapes |
| 16:00 - 16:30 | 30 min | Option : questions et approfondissement |

## Premiere partie : comprendre, observer, essayer

Objectif a 10:20 : savoir expliquer le role d'un serveur MCP, avoir observe un
echange reel et avoir appele un outil.

Le decoupage ci-dessous est une **proposition d'animation** dans le creneau de
60 minutes.

| Horaire | Duree | Activite |
| --- | --- | --- |
| 09:20 - 09:30 | 10 min | Pourquoi MCP ? Host, client, serveur et comparaison avec API/RAG |
| 09:30 - 09:40 | 10 min | Tools, resources, prompts, JSON-RPC et transports |
| 09:40 - 09:45 | 5 min | Demo 1 : GitHub Copilot et Azure MCP Server |
| 09:45 - 09:50 | 5 min | Demo 2 : les memes mecanismes dans MCP Inspector |
| 09:50 - 10:05 | 15 min | Mini-hack : consulter puis modifier un service fictif |
| 10:05 - 10:15 | 10 min | Debrief : permissions du client et autorisation du serveur |
| 10:15 - 10:20 | 5 min | Questions et transition vers la gouvernance |

## Supports

- [Guide de la premiere demonstration](docs/demo-1.md)
- [Guide MCP Inspector](docs/demo-2-inspector.md)
- [Mini-hack et contrat d'outils propose](docs/mini-hack.md)
- [Configuration VS Code pour un serveur distant](examples/mcp.remote.example.json)

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

1. Cloner ce depot et l'ouvrir dans VS Code.
2. Copier [la configuration d'exemple](examples/mcp.remote.example.json) dans
   `.vscode/mcp.json`, sans ecraser une configuration existante.
3. Remplacer `https://mcp.example.invalid/mcp` par l'URL fournie par l'animation.
   L'URL d'exemple est volontairement non fonctionnelle.
4. Demarrer le serveur depuis la configuration MCP de VS Code et examiner la
   demande de confiance.
5. Dans le chat en mode agent, ouvrir la selection des outils et activer
   uniquement les outils necessaires a l'exercice.

Le dossier `.vscode/` est ignore par Git : la configuration locale et les
eventuels parametres propres a une session ne sont pas publies.

## Suite du parcours

L'apres-midi reprend le meme cas fictif : authentification, autorisation cote
serveur, passerelle, droits delegues ou applicatifs, puis supervision. La
procedure d'hebergement et ces etapes de securisation restent a construire.

Ne pas deployer un serveur d'ecriture anonyme en production. Une confirmation
dans le chat n'est pas une regle d'autorisation.

## References

- [Introduction a MCP](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Configurer MCP dans VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [Bien demarrer avec Azure MCP Server](https://learn.microsoft.com/azure/developer/azure-mcp-server/get-started)
