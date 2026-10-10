FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY LiftTogether.Api.csproj packages.lock.json ./
RUN dotnet restore --locked-mode
COPY . .
RUN dotnet publish -c Release --no-restore -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080 DataProtection__Path=/app/keys
COPY --from=build /out .
RUN mkdir -p /app/keys && chown -R $APP_UID:$APP_UID /app
USER $APP_UID
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s CMD dotnet LiftTogether.Api.dll --healthcheck
ENTRYPOINT ["dotnet", "LiftTogether.Api.dll"]
