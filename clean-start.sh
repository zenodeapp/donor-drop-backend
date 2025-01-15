#!/bin/bash
# Useful for a quick reset and reboot of the current project's container

# Stop and remove containers, networks, and volumes only for the current project
docker-compose down -v

# Prune containers, images, and volumes only related to the current project (not globally)
docker container prune -f --filter "label=com.docker.compose.project=$(basename $PWD)"
docker image prune -f --filter "label=com.docker.compose.project=$(basename $PWD)"
docker volume prune -f --filter "label=com.docker.compose.project=$(basename $PWD)"

# Rebuild the Docker image for the current project
docker-compose build

# Start the services in detached mode
docker-compose up -d
