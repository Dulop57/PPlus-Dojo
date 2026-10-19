# Third-party notices

## Rukaidata and brawllib_rs

Extraction approach and collision conventions: https://github.com/rukai/rukaidata

Parser: https://github.com/rukai/brawllib_rs (version 0.29.0; transitive versions in Cargo.lock)

P+ Dojo vendors the published 0.29.0 parsing source. Cargo.toml and the renderer module gate are changed to make native graphics dependencies optional. All parsing/evaluation code is unchanged; see native/vendor/brawllib_rs/DOJO-PATCH.md.

The MIT License (MIT)

Copyright (c) 2018 Lucas Kent

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Frontend libraries and fonts

React/React DOM, Three.js, fflate, and ts-fsrs: MIT. The Study section uses ts-fsrs by the Open Spaced Repetition project (https://github.com/open-spaced-repetition/ts-fsrs), an independent implementation of FSRS; it does not embed Anki. Lucide: ISC; portions of the inherited icon set carry MIT attribution. Inter and Space Grotesk: SIL Open Font License 1.1. Full notices are bundled under `app/licenses` (or `dist/licenses`) by the build helper. Version pins and transitive dependencies are recorded in package-lock.json.

Raw game inputs, 3D models, and game audio are excluded from source publication.

## Images

The fighter portraits, stock icons, and stage images under `Images/` were
obtained from the [Project+ pages on Dragdown Wiki](https://dragdown.wiki/wiki/PPlus).
Dragdown's wiki text is licensed under CC BY-SA 4.0 unless otherwise noted, but
that site-wide text license does not establish a license for game images. For
example, the [Mario portrait file page](https://dragdown.wiki/wiki/File:PPlus_Mario_Portrait.png)
has a separate copyright and fair-use notice. File histories record uploaders;
an uploader is not necessarily the original artist.

The retained Project+ logo credit record is at
`Images/project-plus-assets-master/logos/credits.md`. Individual artist credits
and redistribution permissions for the fighter, stock, stage, and logo artwork
have not been verified. This source attribution records where the images were
collected; it does not grant permission to redistribute them. These assets are
separate from the MIT-licensed application code and do not imply affiliation
with Nintendo, Project+, or Dragdown. See [Dragdown's copyright notice](https://dragdown.wiki/wiki/Dragdown:Copyrights)
and the relevant file pages before reusing the images.

## Desktop and cloud libraries

Electron: MIT, with Chromium and its third-party notices supplied by the bundled
Electron runtime (`LICENSE` and `LICENSES.chromium.html`). electron-updater:
MIT, by electron-userland. Firebase JavaScript SDK: Apache License 2.0, by Google.
These packages' source notices remain in their distributed modules; dependency
versions are recorded in package-lock.json. electron-builder is a build tool;
fake-indexeddb is used only in storage tests.
