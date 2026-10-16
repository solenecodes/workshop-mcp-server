# Workshop MCP : des fondamentaux a la gouvernance

Supports publics pour decouvrir le Model Context Protocol (MCP), observer ses
echanges et comprendre comment passer d'un serveur de demonstration a un service
gouverne.

Tous les exercices utilisent des donnees fictives. Aucun acces a un environnement
d'entreprise n'est necessaire pour le mini-hack propose.

## Etat du depot

Ce depot contient les supports proposes pour la session 1 et le cadrage des
sessions 2 et 6 autour d'un meme serveur MCP fil rouge. Il ne contient pas encore
de serveur executable ni de deploiement.
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
| **10:35–11:10** | **35 min** | [**2 · Architecture d'entreprise**](sessions/02-architecture/README.md) | **Démo sur le serveur fil rouge (ex. APIM)** |
| 11:10–11:45 | 35 min | 3 · Sécurité et gouvernance | Séquence indépendante |
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
ou pratique sur le serveur fil rouge. La session 3 est independante de ce depot ;
son contenu est gere separement. Les autres sequences restent uniquement dans
ce programme.

## Organisation du depot

Seules les sessions qui utilisent et font evoluer le serveur fil rouge disposent
d'un dossier dans [sessions/](sessions/). Leur numerotation reste celle du programme.

| Dossier | Contenu |
| --- | --- |
| [01-mcp-fondamentaux](sessions/01-mcp-fondamentaux/README.md) | [Presentation web](sessions/01-mcp-fondamentaux/presentation.html), deux demos, mini-hack et configuration d'exemple |
| [02-architecture](sessions/02-architecture/README.md) | Evolution du meme serveur, par exemple avec APIM ; scenario au choix de l'intervenant |
| [06-hands-on](sessions/06-hands-on/README.md) | Complement pratique des briques non couvertes en session 2 |

Le [skill Azure Showcase Web](.github/skills/README.md), installe dans
`.github/skills/`, permet de generer et d'adapter les presentations web du depot.

## Fil rouge : un serveur, des briques successives

Les participants rappellent les memes outils sur les memes donnees fictives
pour observer ce que chaque nouvelle brique change.

| Etape | Evolution | Verification |
| --- | --- | --- |
| Session 1 | Serveur MCP de demonstration et outils de lecture/ecriture | Decouvrir, appeler, modifier puis relire |
| Session 2 | Briques au choix de l'intervenant, par exemple une passerelle APIM devant le serveur existant | Rejouer les appels et relever les controles effectivement actifs |
| Session 6 | Completer ce qui n'a pas ete traite ou termine en session 2 | Rejouer les memes appels autorises et refuses |

Le serveur et le contrat des outils restent le socle commun. L'URL d'acces et
l'authentification peuvent changer, notamment lors de l'ajout d'APIM : la
configuration du client est alors mise a jour, pas le cas pratique reconstruit.
La premiere demo avec Azure MCP Server reste une introduction distincte ;
le serveur fil rouge est celui d'Inspector et du mini-hack.

Le contenu de la session 6 depend de l'etat reel laisse par la session 2, et non
d'une limite supposee d'APIM. La procedure d'hebergement et ces evolutions restent
a construire.

Ne pas deployer un serveur d'ecriture anonyme en production. Une confirmation
dans le chat n'est pas une regle d'autorisation.

## References

- [Introduction a MCP](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Configurer MCP dans VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)
- [Bien demarrer avec Azure MCP Server](https://learn.microsoft.com/azure/developer/azure-mcp-server/get-started)
