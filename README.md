# FribbleQuibble Backend
Backend repository for the FribbleQuibble discussion website.

### Responsibilities
The backend is responsible for the following components for website functionality:

- Database for data storage
- API for database access
- Reverse proxy for handling API access, rate limiting, and HTTPS security

### Dependencies/Tech Stack
The backend responsibilities are implemented using a variety of technologies.

- [MariaDB](https://mariadb.org/) for DBMS
- [Express.js](https://expressjs.com/) for API framework
- [NGINX](https://www.nginx.com/) for reverse proxy and rate limiting
- [Certbot](https://certbot.eff.org/)+NGINX for HTTPS security
- [Docker Compose](https://docs.docker.com/compose/) for deployment

### Database Structure

Conceptual Model:
![Conceptual model of the FribbleQuibble backend database](./readme-src/conceptual-model.png)

Logical Model:
![Logical model of the FribbleQuibble backend database](./readme-src/logical-model.png)

The physical model can be found [here](https://github.com/Ringman3640/fribblequibble-backend/blob/main/mariadb/fribblequibble_db.sql).
