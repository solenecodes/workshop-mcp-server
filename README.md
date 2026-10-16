# Workshop MCP : des fondamentaux a la gouvernance

Supports publics pour decouvrir le Model Context Protocol (MCP), observer ses
echanges et comprendre comment passer d'un serveur de demonstration a un service
gouverne.

Tous les exercices utilisent des donnees fictives. Aucun acces a un environnement
d'entreprise n'est necessaire pour le mini-hack propose.

## Etat du depot

Ce depot contient le programme et une proposition de supports pour la session 1,
« Serveur MCP : les fondamentaux ». Il ne contient pas encore de serveur executable ni de deploiement.
Le mini-hack necessite donc la preparation d'un serveur et la communication de
son URL par l'equipe d'animation. Les noms d'outils presentes sont un contrat
pedagogique propose, pas des outils deja disponibles.

## Programme de la journee

Programme de reference ; les sequences optionnelles peuvent etre adaptees.

| Horaire | Duree | Sequence |
| --- | --- | --- |
| 09:00 - 09:20 | 20 min | Accueil, objectifs et tour de table |
| 09:20 - 10:20 | 60 min | [Session 1 - Serveur MCP : les fondamentaux](sessions/01-mcp-fondamentaux/README.md) |
| 10:20 - 10:35 | 15 min | Pause |
| 10:35 - 11:10 | 35 min | [Session 2 - Architecture d'entreprise](sessions/02-architecture/README.md) |
| 11:10 - 11:45 | 35 min | [Session 3 - Securite et gouvernance](sessions/03-securite-gouvernance/README.md) |
| 11:45 - 12:30 | 45 min | [Session 4 - Gouvernance des agents (option)](sessions/04-gouvernance-agents/README.md) |
| 12:30 - 13:30 | 60 min | Dejeuner |
| 13:30 - 14:00 | 30 min | [Session 5 - Echanges et selection d'un cas d'usage](sessions/05-echanges/README.md) |
| 14:00 - 15:15 | 75 min | [Session 6 - Hands-on : du serveur de demonstration au serveur gouverne](sessions/06-hands-on/README.md) |
| 15:15 - 15:30 | 15 min | Pause |
| 15:30 - 16:00 | 30 min | [Session 7 - Cas d'usage et prochaines etapes](sessions/07-cas-usage/README.md) |
| 16:00 - 16:30 | 30 min | [Session 8 - Questions et approfondissement (option)](sessions/08-questions/README.md) |

## Organisation du depot

Chaque session dispose de son dossier dans [sessions/](sessions/).
L'accueil, les pauses et le dejeuner restent dans le programme general.

La [session 1](sessions/01-mcp-fondamentaux/README.md) regroupe son deroule,
ses deux demonstrations, le mini-hack et sa configuration d'exemple.
Les dossiers des sessions 2 a 8 contiennent pour l'instant leur cadrage ;
leurs supports restent a preparer.

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
