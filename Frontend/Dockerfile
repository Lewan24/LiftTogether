FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_MODE=http
RUN VITE_API_MODE=$VITE_API_MODE npm run build
# Static demo images need no API upstream, including during Nginx startup.
RUN if [ "$VITE_API_MODE" = "mock" ]; then \
      sed 's@proxy_pass http://api:8080;@return 404;@' nginx.conf > nginx-runtime.conf; \
    else \
      cp nginx.conf nginx-runtime.conf; \
    fi

FROM nginx:1.28-alpine AS runtime
COPY --from=build /app/nginx-runtime.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
