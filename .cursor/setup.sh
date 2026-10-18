#!/usr/bin/env bash
# Compatibility entry point. Dependency setup lives in install.sh.
exec bash "$(dirname "${BASH_SOURCE[0]}")/install.sh"
