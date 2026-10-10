using LiftTogether.Api.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace LiftTogether.Api.Data;

public static class DatabaseSetup
{
    public static async Task Seed(GymDb db, IConfiguration config, IPasswordHasher<Member> hasher)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(817001)");
        if (!await db.Settings.AnyAsync()) db.Settings.Add(new GymSettings());
        if (!await db.Categories.AnyAsync()) db.Categories.AddRange(new Category { Name = "Ogólne / General" }, new Category { Name = "Trening / Training" }, new Category { Name = "Sprzęt / Equipment" });
        if (!await db.Members.AnyAsync(x => x.Role == "admin"))
        {
            var password = config["Bootstrap:AdminPassword"] ?? throw new InvalidOperationException("Set Bootstrap__AdminPassword for first initialization."); Rules.Password(password);
            var admin = new Member { Role = "admin", Verified = true }; Rules.Profile(admin, "Gym", "Administrator", config["Bootstrap:AdminEmail"] ?? "", "DS 3", "Administration", "", "");
            admin.PasswordHash = hasher.HashPassword(admin, password); db.Members.Add(admin); db.Record(null, "bootstrap.admin", admin.Id);
        }
        await db.SaveChangesAsync(); await tx.CommitAsync();
        // Init scripts create this role in Compose. Local development can use a single owner role.
        if (await db.Database.SqlQueryRaw<int>("SELECT 1 AS \"Value\" FROM pg_roles WHERE rolname = 'liftapp'").AnyAsync())
        {
            await db.Database.ExecuteSqlRawAsync("REVOKE UPDATE, DELETE ON \"Audit\" FROM liftapp; REVOKE ALL ON \"__EFMigrationsHistory\" FROM liftapp;");
        }
    }
}
public sealed class CleanupService(IServiceScopeFactory factory, ILogger<CleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await using var scope = factory.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<GymDb>();
                await db.Sessions.Where(x => x.ExpiresAt < DateTimeOffset.UtcNow).ExecuteDeleteAsync(stoppingToken);
                var cutoff = DateTimeOffset.UtcNow.AddDays(-1);
                await db.Uploads.Where(x => x.CreatedAt < cutoff && x.DiscussionId == null && x.ReplyId == null).ExecuteDeleteAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { logger.LogError(ex, "Failed to clean expired sessions and orphan uploads"); }
        }
    }
}
