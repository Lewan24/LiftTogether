using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using LiftTogether.Api.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace LiftTogether.Api.Security;

public sealed class SessionAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder, GymDb db) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Cookie = "lift-session";
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Cookies.TryGetValue(Cookie, out var token) || token.Length != 64) return AuthenticateResult.NoResult();
        var hash = Hash(token);
        var session = await db.Sessions.AsNoTracking().Include(s => s.User).SingleOrDefaultAsync(s => s.Id == hash && s.ExpiresAt > DateTimeOffset.UtcNow, Context.RequestAborted);
        if (session == null) return AuthenticateResult.NoResult();
        Context.Items["member"] = session.User; Context.Items["session"] = hash;
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, session.UserId.ToString()), new Claim(ClaimTypes.Role, session.User.Role), new Claim("verified", session.User.Verified ? "true" : "false") };
        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(new ClaimsIdentity(claims, Scheme.Name)), Scheme.Name));
    }
    protected override Task HandleChallengeAsync(AuthenticationProperties properties) { Response.StatusCode = 401; return Response.WriteAsJsonAsync(new { code = "UNAUTHENTICATED" }); }
    protected override Task HandleForbiddenAsync(AuthenticationProperties properties) { Response.StatusCode = 403; return Response.WriteAsJsonAsync(new { code = "FORBIDDEN" }); }
    public static async Task SignIn(HttpContext ctx, GymDb db, Member user, bool secure)
    {
        if (ctx.Items["session"] is string old) await db.Sessions.Where(s => s.Id == old).ExecuteDeleteAsync(ctx.RequestAborted);
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)); var expiry = DateTimeOffset.UtcNow.AddHours(8);
        db.Sessions.Add(new Session { Id = Hash(token), UserId = user.Id, ExpiresAt = expiry }); await db.SaveChangesAsync(ctx.RequestAborted);
        ctx.Response.Cookies.Append(Cookie, token, new CookieOptions { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/api", Expires = expiry, IsEssential = true });
    }
}
