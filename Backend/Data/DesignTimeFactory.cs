using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace LiftTogether.Api.Data;

public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<GymDb>
{
    public GymDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<GymDb>().UseNpgsql(Environment.GetEnvironmentVariable("ConnectionStrings__Database") ?? "Host=localhost;Database=lift;Username=lift;Password=design-time-only").Options);
}
