# Demo 1 : de l'intention a l'appel d'outil

Support de la [session 1 - Serveur MCP : les fondamentaux](../README.md#session-1---serveur-mcp--les-fondamentaux).

**Duree : 5 minutes.** GitHub Copilot + Azure MCP Server, en lecture seule.

## Message a faire passer

Le modele ne connait pas l'etat courant d'un abonnement. Le client decouvre des
outils, le modele propose un appel, le client l'execute selon ses permissions et
le serveur interroge Azure avec une identite autorisee.

MCP standardise cette interaction ; il ne remplace ni les API Azure ni leurs
regles d'acces.

## Preparation

- Suivre le [guide officiel Azure MCP Server pour VS Code](https://learn.microsoft.com/azure/developer/azure-mcp-server/get-started/tools/visual-studio-code).
- Tester l'authentification avant la session ; ne pas afficher un flux de
  connexion, un jeton ou une adresse personnelle a l'ecran.
- Utiliser un abonnement de demonstration avec des groupes aux noms generiques,
  par exemple `rg-demo-catalog` et `rg-demo-observability`.
- Utiliser une identite avec le role Reader au perimetre de demonstration.
- Ne rendre disponibles au chat que les outils de lecture necessaires.
- Reperer dans la version installee l'outil de listage des groupes de ressources.
  Son nom et son schema peuvent varier selon la version et le client.
- Preparer une capture anonymisee de l'appel et de sa reponse en solution de
  repli ; la presenter comme une capture, pas comme une execution en direct.

## Deroule minute par minute

| Temps | Action | Observation attendue |
| --- | --- | --- |
| 0:00 - 1:00 | Montrer le serveur connecte et le catalogue d'outils | Les capacites sont decouvertes, pas inventees |
| 1:00 - 2:00 | Saisir le prompt ci-dessous | L'intention est exprimee en langage naturel |
| 2:00 - 3:00 | Ouvrir le detail de l'appel avant confirmation | Nom, description et arguments de l'outil |
| 3:00 - 4:00 | Executer et examiner le resultat | Donnees reelles du bac a sable, lecture seule |
| 4:00 - 5:00 | Redessiner la chaine et poser une question | Intention -> outil -> serveur -> API -> resultat |

### Prompt propose

```text
Dans l'abonnement de demonstration indique par l'animation, liste les groupes
de ressources avec Azure MCP Server. N'effectue aucune creation, modification
ou suppression. Si le perimetre est ambigu, demande une precision.
```

Ne pas ajouter d'identifiant d'abonnement dans ce support public.

### Questions au groupe

- Que fournit le modele, et que fournit l'outil ?
- Ou voit-on le schema des arguments ?
- Si l'outil d'ecriture est masque dans ce client, est-il protege contre les
  autres clients ? Non : le serveur doit appliquer sa propre autorisation.

## Criteres de reussite

- Un appel de lecture reel a ete observe avec ses arguments et son resultat.
- Aucune ressource n'a ete modifiee.
- Le public peut distinguer host, client MCP et serveur MCP.
- En cas d'echec, l'erreur est expliquee et le repli est annonce explicitement.

## Transition

Passer a [MCP Inspector](demo-2-inspector.md) pour retrouver la decouverte et
l'appel d'outils sans passer par la selection du modele.
