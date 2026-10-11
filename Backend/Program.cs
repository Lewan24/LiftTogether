using System.Security.Claims;
using System.Threading.RateLimiting;
using LiftTogether.Api.Data;
using LiftTogether.Api.Endpoints;
using LiftTogether.Api.Security;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

if (args.Contains("--healthcheck"))
{
    try
    {
        using var http = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(3)
        };
        using var request = new HttpRequestMessage(HttpMethod.Get, "http://127.0.0.1:8080/health/ready");
        var host = Environment.GetEnvironmentVariable("AllowedHosts")?.Split(';')[0];
        if (!string.IsNullOrWhiteSpace(host) && !host.Contains('*')) request.Headers.Host = host;
        Environment.ExitCode = (await http.SendAsync(request)).IsSuccessStatusCode ? 0 : 1;
    }
    catch
    {
        Environment.ExitCode = 1;
    }
    return;
}
var builder = WebApplication.CreateBuilder(args);
if (builder.Configuration["Database:PasswordFile"] is string passwordFile)
{
    var connection = new NpgsqlConnectionStringBuilder(builder.Configuration.GetConnectionString("Database"));
    connection.Password = File.ReadAllText(passwordFile).Trim();
    builder.Configuration["ConnectionStrings:Database"] = connection.ConnectionString;
}
if (builder.Configuration["Bootstrap:AdminPasswordFile"] is string adminPasswordFile) builder.Configuration["Bootstrap:AdminPassword"] = File.ReadAllText(adminPasswordFile).Trim();
builder.WebHost.ConfigureKestrel(options =>
{
    options.AddServerHeader = false;
    options.Limits.MaxRequestBodySize = 3 * 1024 * 1024;
    options.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddDbContext<GymDb>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Configure ConnectionStrings__Database."), pg => pg.CommandTimeout(15)));
builder.Services.AddDataProtection().SetApplicationName("LiftTogether")
    .PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["DataProtection:Path"] ?? Path.Combine(builder.Environment.ContentRootPath, ".keys")));
builder.Services.AddAuthentication("session")
    .AddScheme<AuthenticationSchemeOptions, SessionAuth>("session", null);
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("verified", p => p.RequireAuthenticatedUser()
        .RequireAssertion(context => context.User.Admin() || context.User.HasClaim("verified", "true")));
    options.AddPolicy("admin", p => p.RequireRole("admin"));
});
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-Token";
    options.Cookie.Name = "lift-csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.Cookie.Path = "/api";
});
builder.Services.AddScoped<IPasswordHasher<Member>, PasswordHasher<Member>>();
builder.Services.Configure<PasswordHasherOptions>(options => options.IterationCount = 600_000);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    foreach (var network in builder.Configuration.GetSection("Proxy:TrustedNetworks").Get<string[]>() ?? []) options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            code = "RATE_LIMITED"
        }, cancellationToken);
    };
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context => RateLimitPartition.GetFixedWindowLimiter(context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = 180,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0
    }));
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = 10,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0
    }));
    options.AddPolicy("upload", context => RateLimitPartition.GetFixedWindowLimiter(context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown", _ => new FixedWindowRateLimiterOptions
    {
        PermitLimit = 12,
        Window = TimeSpan.FromMinutes(1),
        QueueLimit = 0
    }));
});
builder.Services.AddHostedService<CleanupService>();
var app = builder.Build();
app.UseForwardedHeaders();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    try
    {
        await next(context);
    }
    catch (Exception ex) when (!context.Response.HasStarted)
    {
        var (status, code) = ex switch
        {
            ApiFault e => (e.Status, e.Code),
            PostgresException
            {
                SqlState: "42P01"
            }
=> (503, "DATABASE_NOT_INITIALIZED"),
            AntiforgeryValidationException => (400, "INVALID_CSRF"),
            BadHttpRequestException => (400, "INVALID_REQUEST"),
            DbUpdateConcurrencyException => (409, "CONFLICT_REFRESH"),
            DbUpdateException e when e.InnerException is PostgresException
            {
                SqlState: "23505"
            }
=> (409, "DUPLICATE_RECORD"),
            DbUpdateException e when e.InnerException is PostgresException
            {
                SqlState: "23503"
            }
=> (409, "REFERENCE_CONFLICT"),
            OperationCanceledException when context.RequestAborted.IsCancellationRequested => (499, "CANCELLED"),
            _ => (500, "SERVER_ERROR")
        };
        if (status >= 500) app.Logger.LogError(ex, "API failure {TraceId}", context.TraceIdentifier);
        context.Response.Clear();
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new
        {
            code,
            traceId = context.TraceIdentifier
        });
    }
});
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method)) await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
    await next(context);
});
app.MapGet("/health/live", () => Results.Ok(new
{
    status = "ok"
}));
app.MapGet("/health/ready", async (GymDb db, CancellationToken cancellationToken) =>
{
    // A listening database alone is insufficient: migrations and bootstrap must be complete.
    try
    {
        return await db.Settings.AsNoTracking().AnyAsync(x => x.Id == 1, cancellationToken) ? Results.Ok(new
        {
            status = "ok"
        }) : Results.StatusCode(503);
    }
    catch (Exception ex) when (ex is NpgsqlException or InvalidOperationException)
    {
        app.Logger.LogWarning("Database readiness check failed: {Type}", ex.GetType().Name);
        return Results.StatusCode(503);
    }
});
app.MapAuth();
app.MapGym();
app.MapDashboard();
app.MapNews();
app.MapForum();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<GymDb>();
    await db.Database.MigrateAsync();
    await DatabaseSetup.Seed(db, builder.Configuration, scope.ServiceProvider.GetRequiredService<IPasswordHasher<Member>>());
    return;
}
if (args.Contains("--reset-admin"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<GymDb>();
    var email = Rules.Email(builder.Configuration["Bootstrap:AdminEmail"]);
    var password = builder.Configuration["Bootstrap:AdminPassword"] ?? "";
    Rules.Password(password);
    await using var tx = await db.Database.BeginTransactionAsync();
    var admin = await db.Members.SingleOrDefaultAsync(u => u.Email == email && u.Role == "admin") ?? throw new InvalidOperationException("Administrator not found.");
    admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Member>>().HashPassword(admin, password);
    await db.Sessions.Where(s => s.UserId == admin.Id).ExecuteDeleteAsync();
    db.Record(admin.Id, "operator.admin.recovery", admin.Id);
    await db.SaveChangesAsync();
    await tx.CommitAsync();
    return;
}
if (app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Database:AutoInitialize"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<GymDb>();
    await db.Database.MigrateAsync();
    await DatabaseSetup.Seed(db, builder.Configuration, scope.ServiceProvider.GetRequiredService<IPasswordHasher<Member>>(), requireAdmin: false);
    if (!await db.Members.AnyAsync(x => x.Role == "admin"))
        app.Logger.LogWarning("Development database initialized without an administrator. Set Bootstrap__AdminEmail and Bootstrap__AdminPassword and restart the API to create one.");
}
await app.RunAsync();
public partial class Program;
