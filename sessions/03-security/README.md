# Session 3 - Identity, permissions and control

[Workshop](../../README.md) · **11:00–11:15 · 15 minutes**

[Open the four slides](../01-mcp-fondamentaux/presentation.html#rights).
The slides are in English; the presenter notes below are in French.
The website timetable remains authoritative. No APIM or new tenant setup is
required for this presentation.

| Time | Duration | Slide |
| --- | ---: | --- |
| 11:00–11:03 | 3 min | [Whose rights?](../01-mcp-fondamentaux/presentation.html#rights) |
| 11:03–11:07 | 4 min | [OBO or service access?](../01-mcp-fondamentaux/presentation.html#token-hops) |
| 11:07–11:11 | 4 min | [Risks and controls](../01-mcp-fondamentaux/presentation.html#mcp-threats) |
| 11:11–11:15 | 4 min | [Entra Agent ID](../01-mcp-fondamentaux/presentation.html#agent-identities) |

There are exactly four slides, with at most 115 words per slide and 400 words
across the course. Dense explanations, quizzes, expandable panels, token claims,
animations and the duplicate security lab have been removed from the page.
The original Session 1 real browser lab remains unchanged.

## Presenter notes - French

### 1. Qui porte les droits ? - 3 minutes

Ouverture : « Olivier a explique les controles d'acces. Maintenant, choisissons
de qui sont les droits, jusqu'a l'API metier. »

- Alice demande CT-1001 : si le resultat doit respecter ses droits, partir sur
  un acces delegue. Le LLM propose une action ; il ne s'attribue pas de droits.
- Un traitement tourne la nuit : utiliser une identite applicative dediee et
  limiter ses permissions. Ne pas emprunter le compte d'un ingenieur.
- Un agent a besoin de sa propre boite mail : envisager un agent user account
  lie a son identite. Ce compte est optionnel, pas cree automatiquement par
  Agent ID, et ce n'est pas le compte d'Alice. Verifier Frontier preview,
  licences, provisionnement des ressources, support du produit et consent.

Faire choisir le public : « Le meme agent repond a Alice puis prepare un bilan
nocturne. Faut-il forcement le meme modele d'acces pour les deux operations ? »
Reponse : non, le choix depend de l'operation et des droits a respecter.

### 2. Quels droits arrivent jusqu'a l'API ? - 4 minutes

Suivre les deux chemins dessines, sans refaire l'animation OAuth de la session 2.

- Delegation / OBO : lorsque l'API aval doit appliquer les droits d'Alice,
  l'application obtient un nouveau jeton pour cette API dans son contexte.
  Les registrations, permissions deleguees, consentements et le code doivent
  permettre cet echange. OBO ne cree pas de droits supplementaires pour Alice.
- Service : le serveur MCP utilise sa propre identite pour acceder a un jeu
  de donnees autorise. Dans notre hebergement, l'API Tickets est appelee avec
  l'identite managee du service et le role Mcp.Backend.Read.

Le jeton destine a MCP n'est pas automatiquement valable pour une autre API :
les ressources et audiences doivent correspondre. Un transfert APIM vers MCP
pour la meme ressource logique n'est pas un echange OBO vers une autre API.

Question : « Alice donne l'identifiant d'un ticket d'une autre equipe. Qui
verifie son droit sur ce ticket ? » Reponse : le service/API qui applique la
politique d'acces au record. Un scope de lecture ne suffit pas.

Limite de la demo : les appelants autorises voient les memes tickets fictifs.
Pas d'OBO, de per-ticket ACLs ou de filtrage propre a Alice. Le sandbox local
utilise une API loopback synthetique, pas un echange Entra reel.

### 3. Quels risques MCP et quelles reponses ? - 4 minutes

Presenter une seule situation par ligne :

- Texte de ticket non fiable : une phrase demandant une autre action reste
  une donnee, pas une autorisation. L'authentification ne neutralise pas une
  injection de prompt ; ne pas executer une attaque pour illustrer ce point.
- Service trop puissant : expliquer le confused deputy. Le service ne doit
  pas preter ses droits plus larges a un appelant pour une action non autorisee.
  Appliquer le moindre privilege et les controles sur les donnees cibles.
- Action sensible : comparer get_ticket, implemente en lecture seule, avec
  close_ticket, hypothetique. Il faudrait un droit d'ecriture, une approval
  humaine liee a l'acteur, l'outil, la cible et au contenu exact de l'action,
  puis une nouvelle verification avant execution.
- Serveur inconnu : approuver les serveurs et revoir dependances, versions et
  changements de descriptions d'outils. Une annotation readOnlyHint ne remplace
  pas un controle d'autorisation cote serveur.

Faire participer : « Un utilisateur a approuve la fermeture de CT-1001.
L'agent change la cible en CT-1002. L'accord reste-t-il valable ? » Non.

Pour l'audit, garder des metadonnees minimales : acteur, outil, decision,
correlation et reference d'approbation si applicable. Jamais de jetons, secrets,
prompts ou resultats bruts. Notre serveur journalise userId, methode, outil et
decision ; pas une piste complete Agent ID/blueprint/approval.

### 4. Qu'apporte Entra Agent ID ? - 4 minutes

Utiliser Tickets helper comme exemple de blueprint, tickets-helper-network
comme instance et le responsable reseau comme sponsor. Ce sont des exemples
de conception, pas des objets provisionnes par la page.

- Blueprint : type d'agent et frontiere de credentials partages. Les
  credentials sont portes ici, pas individuellement par chaque agent.
- Agent identity : instance distincte, identifiable et attribuable.
- Sponsor : responsable qui connait le besoin et revoit les acces.
- Lifecycle : creer, autoriser, revoir, retirer les acces et mettre a la retraite.

Declarer une permission ne l'accorde pas. Le consentement et les grants restent
necessaires. L'heritage concerne uniquement les permissions compatibles et
explicitement configurees ; les roles Azure RBAC sont affectes aux identites
individuelles. Un nom different ne cree pas un filtrage par equipe.

En OBO, distinguer l'utilisateur concerne de l'agent acteur ; en autonome,
l'identite d'agent agit pour elle-meme. Agent ID ne bloque pas a lui seul les
injections et ne remplace pas l'autorisation sur les donnees.

Question de cloture : « Le sponsor quitte l'equipe : qui revoit l'agent et ses
droits ? » Prevoir un processus de revue et de retrait. Des issued tokens
peuvent rester valides : verifier la revocation effective. Desactiver un
blueprint partage peut affecter toutes ses instances.

Transition : « Nous avons choisi l'identite, limite l'action et identifie un
responsable. Agent 365 passe a la gouvernance a l'echelle du tenant. »

## Delivery boundaries

- Session 2 retains token validation, scopes/roles, 401/403 and gateway mechanics.
- Session 3 explains decisions; no authentication switch or fake live response.
- Agent 365 starts at 11:15 and covers tenant-wide governance.
- No Agent ID objects, mailbox, OBO exchange, write tool or approval queue are
  deployed. Managed identity hosting is not an Agent ID deployment.
- For a real tool call, return to [Session 1's lab](../01-mcp-fondamentaux/presentation.html#lab).
  Protected calls remain terminal-only; follow the repository's existing setup.
- Old links to auth, tokens, security-lab and tool-policy resolve to the new
  slides, without adding old chapters or extra sidebar entries.

## References

- [Blueprints and credentials](https://learn.microsoft.com/entra/agent-id/agent-blueprint)
- [Declared, granted and inherited permissions](https://learn.microsoft.com/entra/agent-id/concept-inheritable-permissions)
- [Agent identity and agent user accounts](https://learn.microsoft.com/microsoft-agent-365/developer/identity)
- [OAuth OBO](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
- [MCP security best practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)

Agent ID teaching references checked on 2026-10-20. Verify current product,
license and tenant support before a real deployment.
