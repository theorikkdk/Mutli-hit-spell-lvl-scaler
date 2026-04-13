# Multi-Hit Spell Level Scaler

Module Foundry VTT V13 pour `dnd5e` qui permet a certains sorts de gagner des hits supplementaires quand le niveau d'emplacement augmente.

Le module est pense pour des sorts comme Rayon ardent et Projectile magique, avec une configuration simple directement depuis la fiche du sort.

## Ce Que Fait Le Module

- Gere un pool total de hits pour le sort.
- Applique la regle `1 hit = 1 cible = 1 workflow`.
- Consomme un seul emplacement au premier hit du cast initial.
- Relance les hits suivants sans reconsommer d'emplacement.
- Ne change rien aux sorts qui ne sont pas configures.

## Compatibilite

- Foundry VTT V13
- Systeme `dnd5e`
- Module standalone

Note sur Midi-QOL :

- Le module ne depend pas de Midi-QOL.
- Le chemin principal utilise les activites natives `dnd5e`.
- Si Midi-QOL est actif dans votre table, faites un test sur vos sorts configures avant usage regulier.

## Installation

- Release GitHub : [theorikkdk/multi-hit-spell-lvl-scaler](https://github.com/theorikkdk/multi-hit-spell-lvl-scaler)
- Manifest URL : [module.json](https://github.com/theorikkdk/multi-hit-spell-lvl-scaler/releases/latest/download/module.json)

Dans Foundry :

1. Ouvrir l'installation des modules.
2. Coller l'URL du manifest.
3. Installer le module.
4. Activer le module dans votre monde.

## Configuration D'Un Sort

1. Ouvrir la fiche du sort.
2. Cliquer sur le bouton header Multi-Hit.
3. Activer Multi-Hit.
4. Choisir l'activite a reutiliser pour chaque hit.
5. Definir `baseTotalHits`.
6. Definir `hitsPerSlotLevel`.
7. Enregistrer.

Le niveau de base du sort est derive automatiquement depuis la fiche du sort.

## Utilisation

### Cast Initial

- Au lancement du sort, vous pouvez selectionner de `1` a `totalHits` cibles.
- Chaque cible lance un workflow mono-cible separe.
- Les hits non utilises restent disponibles apres le cast initial.

### Next Hit

- Utilise exactement `1` hit restant.
- Exige exactement `1` cible selectionnee.

### Resolve All

- Utilise `1` hit par cible selectionnee.
- Ne peut pas depasser le nombre de hits restants.

## Exemples

### Rayon Ardent

- Sort de niveau 2
- `baseTotalHits = 3`
- `hitsPerSlotLevel = 1`

Exemples :

- niveau 2 : 3 hits
- niveau 3 : 4 hits
- niveau 4 : 5 hits

### Projectile Magique

- Sort de niveau 1
- `baseTotalHits = 3`
- `hitsPerSlotLevel = 1`

Exemples :

- niveau 1 : 3 hits
- niveau 2 : 4 hits
- niveau 3 : 5 hits

## Limitations Actuelles

- Les activites a gabarit / template ne sont pas supportees dans ce chemin.
- L'interface de configuration est volontairement legere.

## Licence

Ce projet est distribue sous licence custom non commerciale. Voir [LICENSE](LICENSE).
