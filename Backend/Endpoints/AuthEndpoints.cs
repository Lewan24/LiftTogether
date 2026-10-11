using System.Security.Cryptography;
using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace LiftTogether.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuth(this WebApplication app)
    {
        var secure = !app.Environment.IsDevelopment();
        var g = app.MapGroup("/api/auth");
        g.MapGet("/csrf", (HttpContext context, IAntiforgery af) => new
        {
            token = af.GetAndStoreTokens(context).RequestToken
        });
        g.MapGet("/me", async (HttpContext context) => await context.Response.WriteAsJsonAsync(context.Items["member"] is Member u ? Dto.User(u) : null));
        g.MapPost("/login", async (
LoginInput input,
HttpContext context,
GymDb db,
IPasswordHasher<Member> hasher,
CancellationToken cancellationToken
) =>
        {
            Rules.Require(input.Password != null && input.Password.Length <= 128 && input.Password.Length > 0);
            var email = Rules.Email(input.Email);
            var user = await db.Members.SingleOrDefaultAsync(x => x.Email == email, cancellationToken);
            var candidate = user ?? new Member
            {
                PasswordHash = DummyHash.Value
            };
            var result = hasher.VerifyHashedPassword(candidate, candidate.PasswordHash, input.Password!);
            if (user == null || result == PasswordVerificationResult.Failed)
            {
                db.Record(null, "auth.login.failed", "redacted");
                await db.SaveChangesAsync(cancellationToken);
                throw new ApiFault(401, "INVALID_CREDENTIALS");
            }
            if (result == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = hasher.HashPassword(user, input.Password!);
            db.Record(user.Id, "auth.login", user.Id);
            await SessionAuth.SignIn(context, db, user, secure);
            return Dto.User(user);
        })
            .RequireRateLimiting("auth");
        g.MapPost("/register", async (
RegisterInput input,
HttpContext context,
GymDb db,
IPasswordHasher<Member> hasher,
CancellationToken cancellationToken
) =>
        {
            var settings = await db.Settings.AsNoTracking().SingleAsync(cancellationToken);
            Rules.Require(settings.RegistrationEnabled, "REGISTRATION_DISABLED", 403);
            Rules.Password(input.Password);
            var user = new Member();
            Rules.Profile(user, input.FirstName, input.LastName, input.Email, input.Dormitory, input.Room, input.FacebookUrl, "");
            Rules.Require(!await db.Members.AnyAsync(x => x.Email == user.Email, cancellationToken), "REGISTRATION_FAILED", 409);
            user.PasswordHash = hasher.HashPassword(user, input.Password);
            db.Members.Add(user);
            db.Record(user.Id, "auth.register", user.Id);
            await db.SaveChangesAsync(cancellationToken);
            await SessionAuth.SignIn(context, db, user, secure);
            return Dto.User(user);
        })
            .RequireRateLimiting("auth");
        g.MapPost("/logout", async (HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                db.Record(context.User.UserId(), "auth.logout", context.User.UserId());
                await db.SaveChangesAsync(cancellationToken);
            }
            if (context.Items["session"] is string hash) await db.Sessions.Where(s => s.Id == hash).ExecuteDeleteAsync(cancellationToken);
            context.Response.Cookies.Delete(SessionAuth.Cookie, new CookieOptions
            {
                Path = "/api",
                Secure = secure,
                SameSite = SameSiteMode.Strict
            });
            return Results.NoContent();
        });
        g.MapPatch("/profile", async (ProfileInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var user = await db.Members.SingleAsync(x => x.Id == context.User.UserId(), cancellationToken);
            Rules.Version(input.Version, user.Version);
            Rules.Profile(user, input.FirstName, input.LastName, input.Email, input.Dormitory, input.Room, input.FacebookUrl, input.Phone);
            db.Record(user.Id, "profile.update", user.Id);
            await db.SaveChangesAsync(cancellationToken);
            return Dto.User(user);
        })
            .RequireAuthorization();
        g.MapPost("/password", async (
PasswordInput input,
HttpContext context,
GymDb db,
IPasswordHasher<Member> hasher,
CancellationToken cancellationToken
) =>
        {
            Rules.Password(input.NewPassword);
            Rules.Require(input.CurrentPassword != null && input.CurrentPassword.Length <= 128);
            var user = await db.Members.SingleAsync(x => x.Id == context.User.UserId(), cancellationToken);
            Rules.Require(hasher.VerifyHashedPassword(user, user.PasswordHash, input.CurrentPassword!) != PasswordVerificationResult.Failed, "INVALID_CREDENTIALS", 400);
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            user.PasswordHash = hasher.HashPassword(user, input.NewPassword);
            await db.Sessions.Where(s => s.UserId == user.Id).ExecuteDeleteAsync(cancellationToken);
            db.Record(user.Id, "password.change", user.Id);
            await SessionAuth.SignIn(context, db, user, secure);
            await tx.CommitAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequireAuthorization()
            .RequireRateLimiting("auth");
    }
    private static readonly Lazy<string> DummyHash = new(() => new PasswordHasher<Member>(Microsoft.Extensions.Options.Options.Create(new PasswordHasherOptions
    {
        IterationCount = 600_000
    })).HashPassword(new Member(), Convert.ToHexString(RandomNumberGenerator.GetBytes(32))));
}
