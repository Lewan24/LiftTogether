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
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
        using var request = new HttpRequestMessage(HttpMethod.Get, "http://127.0.0.1:8080/health/ready");
        var host = Environment.GetEnvironmentVariable("AllowedHosts")?.Split(';')[0];
        if (!string.IsNullOrWhiteSpace(host) && !host.Contains('*')) request.Headers.Host = host;
        Environment.ExitCode = (await http.SendAsync(request)).IsSuccessStatusCode ? 0 : 1;
    }
    catch { Environment.ExitCode = 1; }
    return;
}
var builder = WebApplication.CreateBuilder(args);
if (builder.Configuration["Database:PasswordFile"] is string passwordFile)
{
    var connection = new NpgsqlConnectionStringBuilder(builder.Configuration.GetConnectionString("Database")); connection.Password = File.ReadAllText(passwordFile).Trim(); builder.Configuration["ConnectionStrings:Database"] = connection.ConnectionString;
}
if (builder.Configuration["Bootstrap:AdminPasswordFile"] is string adminPasswordFile) builder.Configuration["Bootstrap:AdminPassword"] = File.ReadAllText(adminPasswordFile).Trim();
builder.WebHost.ConfigureKestrel(o => { o.AddServerHeader = false; o.Limits.MaxRequestBodySize = 3 * 1024 * 1024; o.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(15); });
builder.Services.AddDbContext<GymDb>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Configure ConnectionStrings__Database."), pg => pg.CommandTimeout(15)));
builder.Services.AddDataProtection().SetApplicationName("LiftTogether").PersistKeysToFileSystem(new DirectoryInfo(builder.Configuration["DataProtection:Path"] ?? Path.Combine(builder.Environment.ContentRootPath, ".keys")));
builder.Services.AddAuthentication("session").AddScheme<AuthenticationSchemeOptions, SessionAuth>("session", null);
builder.Services.AddAuthorization(o => { o.AddPolicy("verified", p => p.RequireAuthenticatedUser().RequireAssertion(c => c.User.Admin() || c.User.HasClaim("verified", "true"))); o.AddPolicy("admin", p => p.RequireRole("admin")); });
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-Token"; o.Cookie.Name = "lift-csrf"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict; o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always; o.Cookie.Path = "/api"; });
builder.Services.AddScoped<IPasswordHasher<Member>, PasswordHasher<Member>>();
builder.Services.Configure<PasswordHasherOptions>(o => o.IterationCount = 600_000);
builder.Services.Configure<ForwardedHeadersOptions>(o => { o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto; foreach (var network in builder.Configuration.GetSection("Proxy:TrustedNetworks").Get<string[]>() ?? []) o.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network)); });
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (context, ct) => { context.HttpContext.Response.Headers.RetryAfter = "60"; await context.HttpContext.Response.WriteAsJsonAsync(new { code = "RATE_LIMITED" }, ct); };
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 180, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("auth", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("upload", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 12, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddHostedService<CleanupService>();
var app = builder.Build();
app.UseForwardedHeaders();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.XContentTypeOptions = "nosniff"; ctx.Response.Headers.CacheControl = "no-store"; ctx.Response.Headers["Referrer-Policy"] = "same-origin";
    try { await next(ctx); }
    catch (Exception ex) when (!ctx.Response.HasStarted)
    {
        var (status, code) = ex switch
        {
            ApiFault e => (e.Status, e.Code),
            AntiforgeryValidationException => (400, "INVALID_CSRF"),
            BadHttpRequestException => (400, "INVALID_REQUEST"),
            DbUpdateConcurrencyException => (409, "CONFLICT_REFRESH"),
            DbUpdateException e when e.InnerException is PostgresException { SqlState: "23505" } => (409, "DUPLICATE_RECORD"),
            DbUpdateException e when e.InnerException is PostgresException { SqlState: "23503" } => (409, "REFERENCE_CONFLICT"),
            OperationCanceledException when ctx.RequestAborted.IsCancellationRequested => (499, "CANCELLED"),
            _ => (500, "SERVER_ERROR")
        };
        if (status >= 500) app.Logger.LogError(ex, "API failure {TraceId}", ctx.TraceIdentifier);
        ctx.Response.Clear(); ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(new { code, traceId = ctx.TraceIdentifier });
    }
});
app.UseAuthentication(); app.UseRateLimiter(); app.UseAuthorization();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method)) await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);
    await next(ctx);
});
app.MapGet("/health/live", () => Results.Ok(new { status = "ok" }));
app.MapGet("/health/ready", async (GymDb db, CancellationToken ct) => await db.Database.CanConnectAsync(ct) ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));
app.MapAuth(); app.MapGym(); app.MapNews(); app.MapForum();
if (args.Contains("--migrate"))
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<GymDb>();
    await db.Database.MigrateAsync(); await DatabaseSetup.Seed(db, builder.Configuration, scope.ServiceProvider.GetRequiredService<IPasswordHasher<Member>>());
    return;
}
if (args.Contains("--reset-admin"))
{
    await using var scope = app.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<GymDb>();
    var email = Rules.Email(builder.Configuration["Bootstrap:AdminEmail"]); var password = builder.Configuration["Bootstrap:AdminPassword"] ?? ""; Rules.Password(password);
    await using var tx = await db.Database.BeginTransactionAsync(); var admin = await db.Members.SingleOrDefaultAsync(u => u.Email == email && u.Role == "admin") ?? throw new InvalidOperationException("Administrator not found.");
    admin.PasswordHash = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Member>>().HashPassword(admin, password);
    await db.Sessions.Where(s => s.UserId == admin.Id).ExecuteDeleteAsync(); db.Record(admin.Id, "operator.admin.recovery", admin.Id); await db.SaveChangesAsync(); await tx.CommitAsync(); return;
}
await app.RunAsync();
public partial class Program;
