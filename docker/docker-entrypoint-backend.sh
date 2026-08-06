#!/bin/sh
# Entrypoint script for backend container
# Runs as root to fix volume permissions, then drops to appuser

# Ensure data directory exists and set proper ownership
mkdir -p /app/data
chown -R appuser:appgroup /app/data

# Fix Docker socket permissions for docker-in-docker access
if [ -S /var/run/docker.sock ]; then
  DOCKER_GID=$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo "0")
  if [ "$DOCKER_GID" != "0" ]; then
    # Create group with matching GID and add appuser
    groupadd -g "$DOCKER_GID" docker_host 2>/dev/null || true
    usermod -a -G "$DOCKER_GID" appuser 2>/dev/null || true
  else
    # Socket owned by root:root (Docker Desktop), allow all users
    chmod 666 /var/run/docker.sock 2>/dev/null || true
  fi
fi

# Drop privileges and run the application
exec gosu appuser "$@"