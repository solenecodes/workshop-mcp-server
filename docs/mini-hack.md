# Cas pratique guide (mini-hack) : qui peut modifier mon service ?

Exercice participant de la [session 1 - Serveur MCP : les fondamentaux](../README.md#session-1---serveur-mcp--les-fondamentaux),
a realiser apres les deux demonstrations. Il ne s'agit pas du hands-on de
securisation de l'apres-midi.

**Duree : 15 minutes.** Proposition a preparer, pas un exercice executable dans
l'etat actuel du depot.

## Fil rouge

Un catalogue de services entierement fictif expose deux operations : consulter
des services et modifier leur statut. Chaque binome dispose de deux espaces
jetables, par exemple `team-07-a` et `team-07-b`.

Le serveur pedagogique initial n'identifie pas les participants et ne controle
pas la propriete de ces espaces. Le binome constate qu'il peut modifier les
deux espaces qui lui ont ete attribues. Il ne cible jamais ceux d'un autre
binome ni un service reel.

Le constat est volontairement limite : **les outils exposes n'ont pas de
controle d'autorisation par equipe**. Cela ne prouve pas que tous les serveurs
MCP sont ouverts, ni que l'ensemble du cloud est accessible.

## Contrat propose pour le futur serveur

Ces outils restent a implementer et a valider.

| Outil | Arguments | Resultat attendu |
| --- | --- | --- |
| `list_services` | `team_id` : chaine non vide | `{ "services": [{ "service_id": "...", "team_id": "...", "name": "...", "status": "healthy" }] }` |
| `set_service_status` | `team_id`, `service_id` : chaines non vides ; `status` : `healthy`, `degraded` ou `maintenance` | `{ "service_id": "...", "team_id": "...", "previous_status": "...", "status": "..." }` |

Les objets ci-dessus decrivent le contenu metier du resultat. L'implementation
devra les retourner dans une reponse MCP valide, avec un schema de sortie
documente si elle utilise `structuredContent`.

Meme dans la version pedagogique sans authentification :

- valider les entrees et refuser un statut inconnu ;
- refuser une equipe ou un service inexistant avec une erreur explicite ;
- ne jamais interpreter une entree comme une commande, un chemin ou une URL ;
- ne donner acces qu'aux donnees fictives chargees pour la session ;
- ne pas proposer de suppression, d'execution de code ni d'acces a des secrets.

Un `team_id` fourni par l'appelant n'est **pas** une preuve d'identite. L'apres-midi,
l'identite authentifiee devra etre associee a ses equipes autorisees cote serveur.

## Preparation par l'animation

- Implementer les deux outils sur un serveur Streamable HTTP de demonstration.
- Creer les espaces de chaque binome et distribuer leurs identifiants hors du depot.
- Heberger le serveur dans un bac a sable sans donnees reelles, sans permission
  sur des ressources metier et avec duree de vie limitee.
- Restreindre l'acces reseau aux participants ; ne pas laisser une ecriture
  anonyme accessible sans restriction sur Internet.
- Limiter le volume de requetes et la taille des entrees, tracer les erreurs et
  prevoir une coupure immediate du service.
- Prevoir une remise a zero reservee a l'animation, non exposee comme outil public.
- Tester depuis un poste participant les politiques MCP, le proxy et le reseau.
- Tester aussi avec deux clients separes : masquer un outil dans un client ne
  doit pas etre presente comme une protection du serveur.
- Preparer Inspector comme repli pour les appels directs. Une interface web de
  chat est une autre option, uniquement si elle est preparee et testee.

L'ouverture pedagogique concerne l'absence de controle par equipe dans ce bac
a sable, pas la mise a disposition d'un service de production sans protection.

## Parcours participant

| Temps | Action | Preuve a relever |
| --- | --- | --- |
| 0 - 3 min | Configurer et demarrer la connexion MCP dans VS Code | Serveur connecte, deux outils visibles |
| 3 - 6 min | Lister les services du premier espace attribue | Identifiant du service et statut initial |
| 6 - 10 min | Modifier le statut, puis relire | Nouveau statut effectivement persiste |
| 10 - 13 min | Refaire l'operation dans le second espace attribue | Pas de controle de propriete cote serveur |
| 13 - 15 min | Restaurer les statuts initiaux et debriefer | Resultats verifies par une nouvelle lecture |

Les confirmations d'outils restent actives. Ne pas demander aux participants
de desactiver les protections du client.

### 1. Se connecter

Suivre les [instructions du README](../README.md#connexion-au-futur-serveur-datelier)
avec l'URL distribuee pendant la session. Ne pas reutiliser l'URL d'exemple.

### 2. Decouvrir et lire

```text
Utilise uniquement le serveur MCP d'atelier.
Liste ses outils puis consulte les services de l'espace qui m'a ete attribue.
Demande-moi son identifiant si je ne l'ai pas encore fourni.
Ne modifie rien pour le moment.
```

Verifier le catalogue dans la selection des outils ou dans Inspector. Une liste
redigee par le modele seule n'est pas la preuve d'un appel `tools/list`.

### 3. Ecrire puis verifier

```text
Sur le service fictif que je viens de selectionner, propose de passer le statut
a maintenance. Montre-moi les arguments et attends ma confirmation.
Apres execution, relis le service et compare son statut au resultat precedent.
```

Noter le statut initial pour pouvoir le restaurer. La relecture est necessaire :
une phrase du modele affirmant que la modification a reussi n'est pas une preuve.

### 4. Observer l'absence de controle par equipe

Sur le second espace du meme binome, refaire une lecture puis une modification
confirmee. Cet espace represente une autre equipe uniquement dans le scenario.
Ne pas explorer d'autres identifiants.

### 5. Nettoyer

Restaurer chaque statut initial et le verifier par lecture. En cas d'erreur,
la signaler a l'animation ; ne pas masquer l'echec et ne pas multiplier les appels.

## Debrief et lien avec l'apres-midi

- Qui a confirme l'appel ? L'utilisateur dans son client.
- Qui aurait du decider des equipes accessibles ? Le serveur.
- Une description d'outil ou une consigne de prompt est-elle une autorisation ?
  Non.
- Que doit apporter la suite ? Une identite verifiee, une politique
  d'autorisation cote serveur et une trace exploitable.
- Une passerelle seule remplace-t-elle l'autorisation metier ? Non.

## Critere de reussite

Chaque binome peut montrer un appel de lecture, un appel d'ecriture confirme,
une relecture qui prouve le changement et une restauration verifiee.

## Validation avant d'annoncer l'exercice disponible

- [ ] Le serveur est implemente et son URL testee depuis un poste participant.
- [ ] Les schemas d'entree et les resultats correspondent au contrat.
- [ ] Un statut invalide et un service inconnu produisent des erreurs visibles.
- [ ] Deux clients distincts permettent d'observer le comportement prevu.
- [ ] Les donnees sont isolees par binome, synthetiques et reinitialisables.
- [ ] Les limites reseau, de volume et de duree de vie sont verifiees.
- [ ] La restauration et le repli ont ete testes.
- [ ] La version securisee refuse une ecriture hors equipe cote serveur,
      meme lorsque l'outil est appele directement.
