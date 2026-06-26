# Ares PT Exclusive Iframes v1.0

Script indépendant du JS principal.

## But

Éviter de charger 3 flux HLS en iframe en même temps.

Quand tu sélectionnes un player PT, le script active seulement celui-là et met les deux autres sur `about:blank`.

## Cibles incluses

- `/pages/cmtvpt.html` ou `/pages/cmtvpt`
- `/pages/rtp1.html` ou `/pages/rtp1`
- `/pages/rtp2.html` ou `/pages/rtp2`

## Installation

Copie le fichier :

```text
js/ares-pt-exclusive-iframes.js
```

Puis ajoute ce script à la fin de `index.html`, après tes autres scripts :

```html
<script defer src="js/ares-pt-exclusive-iframes.js?v=1"></script>
```

## Utilisation

Le script ajoute un petit panneau flottant :

- CMTVPT
- RTP1
- RTP2

Quand tu cliques sur un bouton, il active le flux choisi et désactive les deux autres.

## Option conteneur autonome

Si tu veux que le script crée lui-même les trois emplacements iframe, ajoute dans ta page :

```html
<div id="aresPtExclusivePlayers"></div>
```

Le script créera les 3 iframes automatiquement.
