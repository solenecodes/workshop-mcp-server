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

### Matin — Comprendre et découvrir

| Horaire | Durée | Session | Format |
| --- | ---: | --- | --- |
| 09:00–09:20 | 20 min | Accueil et objectifs | Tour de table |
| **09:20–10:20** | **60 min** | [**1 · Serveur MCP : les fondamentaux**](sessions/01-mcp-fondamentaux/README.md) | **2 démos + cas pratique** |
| 10:20–10:35 | 15 min | *Pause* | — |
| **10:35–11:10** | **35 min** | [**2 · Architecture d'entreprise**](sessions/02-architecture/README.md) | **Démo API REST → MCP** |
| **11:10–11:45** | **35 min** | [**3 · Sécurité et gouvernance**](sessions/03-securite-gouvernance/README.md) | **Démo de lecture d'un jeton** |
| 11:45–12:30 | 45 min | 4 · Gouvernance des agents | Présentation · **optionnel** |

**12:30–13:30 — Déjeuner (1 h)**

### Après-midi — Pratiquer et se projeter

| Horaire | Durée | Session | Format |
| --- | ---: | --- | --- |
| 13:30–14:00 | 30 min | 5 · Échanges et choix d'un cas d'usage | Discussion |
| **14:00–15:15** | **75 min** | [**6 · Du serveur de démonstration au serveur gouverné**](sessions/06-hands-on/README.md) | **Hands-on** |
| 15:15–15:30 | 15 min | *Pause* | — |
| 15:30–16:00 | 30 min | 7 · Cas d'usage et prochaines étapes | Restitution |
| 16:00–16:30 | 30 min | 8 · Questions et approfondissement | Échanges · **optionnel** |

Les liens en gras donnent acces aux dossiers des sessions avec demonstration
ou pratique. Les autres sequences restent uniquement dans ce programme.

## Organisation du depot

Seules les sessions avec demonstration ou hands-on disposent d'un dossier dans
[sessions/](sessions/). Leur numerotation reste celle du programme.

| Dossier | Contenu |
| --- | --- |
| [01-mcp-fondamentaux](sessions/01-mcp-fondamentaux/README.md) | Deroule, deux demos, mini-hack et configuration d'exemple |
| [02-architecture](sessions/02-architecture/README.md) | Cadrage de la demo API REST vers MCP ; supports a preparer |
| [03-securite-gouvernance](sessions/03-securite-gouvernance/README.md) | Cadrage de la demo de lecture d'un jeton ; supports a preparer |
| [06-hands-on](sessions/06-hands-on/README.md) | Cadrage du hands-on de securisation ; implementation a construire |

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
