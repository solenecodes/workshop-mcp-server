# Session 6 - Du serveur de demonstration au serveur gouverne

[Retour au programme](../../README.md)

**Horaire : 14:00 - 15:15 (75 minutes).**

## Objectif

Reprendre le meme serveur et le cas fictif de la
[session 1](../01-mcp-fondamentaux/README.md), dans l'etat laisse par la
[session 2](../02-architecture/README.md), puis completer les briques restantes.

## Point de depart

Avant le hands-on, verifier ce qui a effectivement ete mis en place et teste en
session 2. Si APIM est deja configure, le reutiliser plutot que le reconstruire.
Si une brique est restee au stade de demonstration ou n'a pas ete terminee, elle
peut etre reprise ici.

Il s'agit de completer le perimetre couvert en session 2, pas d'affirmer qu'APIM
ne sait pas assurer ces fonctions. Le contenu exact reste a coordonner entre
les intervenants.

## Briques possibles, selon les points restants

- Authentification avec une identite verifiee.
- Autorisation metier cote serveur.
- Integration ou finalisation de la passerelle APIM, si elle reste a faire.
- Droits delegues/OBO ou identite applicative.
- Supervision et registre.

Ces briques sont des options a selectionner selon l'avancement et le temps
disponible, pas un engagement a toutes les implementer en 75 minutes.

## Boucle pratique apres chaque evolution

1. Mettre a jour la connexion du client si l'URL ou l'authentification change.
2. Retrouver les memes outils et les memes donnees fictives.
3. Rejouer une lecture puis une ecriture autorisee et verifier le resultat.
4. Si un controle d'acces a ete ajoute, tester aussi un appel non autorise
   et verifier son refus explicite.
5. Verifier qu'un acces direct au backend ne contourne pas les protections
   revendiquees : restreindre cet acces ou y appliquer les controles necessaires.
6. Relever le comportement avant/apres et restaurer les donnees de demonstration.

Ce hands-on est distinct du mini-hack de 15 minutes de la session 1.
La session 3 est independante de ce parcours et n'est pas un prerequis technique.

**Etat : serveur, infrastructure et instructions a construire.**
