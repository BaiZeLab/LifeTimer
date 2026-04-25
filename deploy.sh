#!/bin/zsh
echo deploy start ...

docker rm -f life-timer
docker compose up --build -d

docker image prune -f
