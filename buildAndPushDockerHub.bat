docker build -t lewan24/lifttogether-api:latest ./Backend --no-cache
docker build -t lewan24/lifttogether-web:latest ./Frontend --no-cache

docker push lewan24/lifttogether-api:latest
docker push lewan24/lifttogether-web:latest
