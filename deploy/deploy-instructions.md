# Deploy Instructions

This document provides instructions to deploy the FribbleQuibble backend server to a VPS provider.

## Prerequisites

It is assumed that a Linux VPS service has been obtained to publish the backend server. The VPS must have Docker and Certbox installed with an SSL certificate generated. Find instructions on how to install Certbot and its dependencies [here](https://certbot.eff.org/). Set the Software option as "Other".

When generating an SSL certificate for the first time, use the --standalone flag. This method temorarily creates a webserver to accept the Let's Encrypt challenge responses. The renewal settings will be modified in later steps to use the running Nginx webserver instead. Have Certbot place the generated SSL certificate in the default location (/etc/letsencrypt).

## Deploy Process

### Compress Backend Folder

To deploy the backend service to a VPS provider, the backend folder will need to be transferred. To simplify the process and to exclude certain files, the entire folder needs to be archived and compressed using tar.gz.

1. Open a terminal
2. Navigate to the root backend folder
3. Run the following command:
   - tar --exclude=node_modules --exclude=.git -cvz -f ./deploy/backend.tar.gz .

### Transfer Backend Archive

The backend archive needs to be transferred to the remote VPS. This will be accomplished using SCP.

1. Open an ssh and scp-capable terminal in the root backend folder
2. Run the following commands in the terminal:
   - scp ./deploy/backend.tar.gz username@host:~/backend.tar.gz

Replace usename and host in the command with the corresponding username and host from the VPS. Host should be an IPv4 address.

### Extract and Start Backend

To execute the transferred backend API, it must first be extracted and launched using Docker Compose.

1. Login to the remote VPS through ssh
2. Navigate to the backend archive location
3. Run the following commands:
   - tar -xvzf backend.tar.gz --one-top-level
   - cd backend
   - docker compose up -d
4. Pray

### Update Certbot Renewal

When first generating SSL certificated through Certbot, the --standalone flag is used. This works by creating a temporary webserver. However, the backend server already has the Nginx webserver running, which will prevent Certbot from creating its own webserver. This will cause the renewal process to fail. The process needs to be updated to use a webroot instead.

1. Run the following command:
   - sudo certbot renew --webroot --webroot-path /usr/share/nginx/html -d backend.fribblequibble.com --dry-run

This command tests the ability for the server to generate an SSL certificate. On success, the certificate renewal method will be updated for webroot.
