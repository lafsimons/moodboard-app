# hub-core snapshot

This repository includes the backup helpers from the local sibling `hub-core`
project so clean checkouts and Vercel builds do not depend on another folder on
the developer's computer. The package exports and implementation are unchanged.

The app dependency points to `file:vendor/hub-core`. To update the shared helpers,
copy the reviewed changes from the shared project into this snapshot and run its
tests (`node --test vendor/hub-core/src/backup/primitives.test.js`) and the app tests.
