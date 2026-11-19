#!/bin/sh
# À lancer une fois à la racine du projet : active les hooks Git du projet.
git config core.hooksPath .githooks
chmod +x .githooks/commit-msg
echo "Hooks Git actives (core.hooksPath = .githooks)"
