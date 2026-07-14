FROM postgres:15-alpine
ENV POSTGRES_DB=devops_db
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres
COPY db-init.sql /docker-entrypoint-initdb.d/
EXPOSE 5432
