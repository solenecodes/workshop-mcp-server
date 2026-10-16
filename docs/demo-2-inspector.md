# Demo 2 : voir les echanges MCP

**Duree : 5 minutes.** Utiliser le futur serveur fictif du mini-hack, pas les
ressources Azure de la premiere demo.

## Avant la session

Le serveur de cet exercice reste a implementer. Verifier qu'il expose le
[contrat propose](mini-hack.md#contrat-propose-pour-le-futur-serveur).

Installer une version de Node.js compatible avec la version d'Inspector choisie,
puis lancer l'outil officiel :

```sh
npx @modelcontextprotocol/inspector
```

L'animation doit tester et figer la version utilisee avant l'atelier. Cette
commande peut telecharger le paquet npm ; verifier que le reseau l'autorise.
Ouvrir uniquement l'URL locale affichee par Inspector. Ne pas partager son
jeton de session ni exposer son proxy sur Internet.

## Scenario

1. Dans Inspector, choisir **Streamable HTTP** et saisir l'URL HTTPS du serveur
   d'atelier fournie par l'animation.
2. Se connecter et montrer l'initialisation et la negociation des capacites.
3. Ouvrir la liste des outils et observer `tools/list`.
4. Selectionner `list_services`, renseigner `team_id` avec `team-demo` et
   executer l'appel.
5. Afficher la requete `tools/call`, puis sa reponse. Faire remarquer l'identifiant
   de requete JSON-RPC et la correspondance avec la reponse.

Exemple **illustratif**, pas une requete HTTP autonome ni un resultat deja obtenu :

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_services",
    "arguments": {
      "team_id": "team-demo"
    }
  }
}
```

Laisser Inspector gerer l'initialisation et les en-tetes du transport. Montrer
un appel MCP ne consiste pas a envoyer ce JSON seul a n'importe quelle URL.

## Messages cles

- Sans modele, on peut toujours decouvrir et appeler un outil.
- `tools/list` decrit les outils ; `tools/call` en execute un.
- Le transport est distinct du protocole : stdio pour un processus local,
  Streamable HTTP pour ce serveur distant.
- Tools, resources et prompts sont des capacites differentes. Un serveur n'est
  pas oblige de toutes les proposer.
- Une erreur de validation doit etre visible, pas transformee en faux succes.

## Repli

Si le serveur ou Inspector n'est pas disponible, utiliser une capture preparee
des echanges du meme scenario. Signaler que la demonstration n'est pas en direct.
Ne pas annoncer que le mini-hack est executable si son endpoint n'a pas ete teste.
