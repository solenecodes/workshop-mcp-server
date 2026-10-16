# Session 2 - Architecture d'entreprise

[Retour au programme](../../README.md)

**Horaire : 10:35 - 11:10 (35 minutes).**

## Objectif

Positionner MCP dans une architecture d'entreprise en faisant evoluer le
serveur fil rouge de la [session 1](../01-mcp-fondamentaux/README.md).

## Socle commun, scenario libre

L'intervenant choisit les briques et la demonstration de sa partie. APIM est une
possibilite, pas un scenario impose. Le point de depart reste le serveur MCP
existant, ses outils `list_services` et `set_service_status`, et ses donnees
fictives.

Par exemple, APIM peut exposer ce serveur MCP existant : il n'est pas necessaire
de le remplacer par un nouveau serveur genere a partir d'une API REST.

```text
Client MCP -> passerelle APIM -> serveur MCP fil rouge -> donnees fictives
```

Ce schema est une option d'architecture a preparer, pas un deploiement disponible.
Voir la [documentation officielle sur l'exposition d'un serveur MCP existant](https://learn.microsoft.com/azure/api-management/expose-existing-mcp-server).

## Demonstration proposee

1. Rejouer une lecture et une ecriture sur le serveur de la session 1.
2. Ajouter la brique choisie et expliquer son role dans le chemin d'appel.
3. Mettre a jour l'URL et les parametres d'authentification du client si necessaire.
4. Rejouer les memes outils et observer le comportement obtenu.

Si APIM est retenu, verifier la compatibilite du transport et de la version MCP,
la connectivite vers le backend et les controles effectivement configures.
Ne pas presenter la seule presence de la passerelle comme une autorisation metier.

## Passage de relais a la session 6

Consigner dans ce dossier, apres preparation :

- les briques ajoutees et les controles testes ;
- le point d'acces et le mode d'authentification a communiquer aux participants,
  sans publier de secret ni d'URL interne ;
- les changements apportes au serveur et la procedure pour reproduire cet etat ;
- les points non couverts ou non termines a reprendre en
  [session 6](../06-hands-on/README.md).

La session 6 complete cet etat, sans refaire par defaut la demonstration APIM.

**Etat : supports et demonstration a preparer.**
