# Deploy Instructions

This document provides instructions to deploy the FribbleQuibble backend server to a VPS provider.

## Prerequisites

It is assumed that a VPS service has been obtained to publish the backend server. The VPS must have Docker and Certbox installed with an SSL certificate generated. Find instructions on how to install Certbot and its dependencies [here](https://certbot.eff.org/).

## Update ENV Values

Before deploying, ensure that the API environment variables are set for deployment. Specifically, make sure that DB_HOST is set to 'mariadb'. Additionally, update the backend login information and JWT secret token for security.

## Compress Backend Folder

To deploy the backend service to a VPS provider, the backend folder will need to be transferred. To simplify the process and to exclude certain filed, the entire folder needs to be archived and compressed using tar.gz.

1. Open a terminal
2. Navigate to the root backend folder
3. Run the following command:
   - tar --exclude=node_modules --exclude=.git -cvz -f ./deploy/backend.tar.gz .

## Transfer Backend Archive

The backend archive needs to be transferred to the remote VPS. This will be accomplished using SCP.

1. Open an ssh and scp-capable terminal in the root backend folder
2. Run the following commands in the terminal:
   - scp ./deploy/backend.tar.gz username@host:~/backend.tar.gz

Replace usename and host in the command with the corresponding username and host from the VPS. Host should be an IPv4 address.

## Extract and Start Backend

To execute the transferred backend API, it must first be extracted and launched using Docker Compose.

1. Login to the remote VPS through ssh
2. Navigate to the backend archive location
3. Run the following commands:
   - tar -xvzf backend.tar.gz --one-top-level
   - cd backend
   - docker compose up -d
4. Pray
