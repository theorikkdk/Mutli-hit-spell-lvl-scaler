# Multi-Hit Spell Level Scaler

Module Foundry VTT V13 pour le systeme `dnd5e`.

Ce module permet de faire evoluer certains sorts en ajoutant des hits supplementaires quand le niveau d'emplacement augmente, au lieu d'augmenter les degats d'un seul hit. Il est pense pour des sorts comme Rayon ardent et Projectile magique.

## Ce Que Fait Le Module

- Ajoute une configuration Multi-Hit directement sur la fiche du sort.
- Permet de definir une activite unique reutilisee pour chaque hit.
- Gere un pool total de hits pour le cast.
- Lance les hits en workflows mono-cible separes.
- Ne change rien aux sorts non configures.

## Prerequis Et Compatibilite

- Foundry VTT V13
- Systeme `dnd5e`
- Module standalone

Notes sur Midi-QOL :

- Le module ne depend pas de Midi-QOL.
- Le chemin actuel est base sur les activites `dnd5e` natives.
- Si Midi-QOL est actif dans votre table, faites un test sur les sorts configures dans votre configuration reelle avant usage regulier.

## Installation Et Distribution

- Le module peut etre installe localement comme un module Foundry standard.
- Pour une future distribution GitHub / Foundry, les metadonnees de release sont preparees dans `module.json`.
- Pour preparer un zip propre de release, voir `RELEASE.md`.

## Fonctionnement General

Le module fonctionne avec un pool total de hits.

- `1 hit = 1 cible = 1 workflow`
- Cette regle vaut pour le cast initial comme pour les hits resolves ensuite.
- Le premier hit du cast initial consomme normalement l'emplacement du sort.
- Tous les hits suivants sont relances sans reconsommer d'emplacement.

Apres le cast initial, si des hits restent a resoudre :

- `Next Hit` lance exactement 1 hit sur la cible actuellement selectionnee.
- `Resolve All` consomme 1 hit par cible selectionnee, sans depasser le nombre de hits restants.

## Configuration D'un Sort

1. Ouvrir la fiche du sort.
2. Cliquer sur le bouton header Multi-Hit.
3. Activer Multi-Hit.
4. Choisir `hitActivityId` parmi les activites du sort.
5. Definir `baseTotalHits`.
6. Definir `hitsPerSlotLevel`.
7. Enregistrer.

Champs importants :

- `hitActivityId` : activite reutilisee pour chaque hit.
- `baseTotalHits` : nombre total de hits au niveau de base du sort.
- `hitsPerSlotLevel` : hits gagnes par niveau d'emplacement au-dessus du niveau de base.

Le `baseLevel` n'est pas configure manuellement :

- il est derive automatiquement du niveau du sort.

## Exemples Concrets

### Rayon Ardent

- Sort de niveau 2
- `baseTotalHits = 3`
- `hitsPerSlotLevel = 1`

Exemple :

- lance au niveau 2 : 3 hits
- lance au niveau 3 : 4 hits
- lance au niveau 4 : 5 hits

### Projectile Magique

- Sort de niveau 1
- `baseTotalHits = 3`
- `hitsPerSlotLevel = 1`

Exemple :

- lance au niveau 1 : 3 hits
- lance au niveau 2 : 4 hits
- lance au niveau 3 : 5 hits

## Limitations Actuelles

- Les activites a gabarit / template ne sont pas supportees dans ce chemin Multi-Hit.
- Le prompt de resolution est encore generique.
- L'UI de configuration est volontairement legere.
- Le module suppose un usage mono-cible par hit, meme si l'activite d'origine supporte plusieurs cibles.

## Notes De Developpement

- La configuration est stockee sur l'item dans `flags.multi-hit-spell-lvl-scaler.spellConfig`.
- Le niveau de base est derive automatiquement du niveau du sort.
- Le bouton header relit l'etat directement depuis les flags du sort.
