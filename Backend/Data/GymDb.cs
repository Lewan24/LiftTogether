using Microsoft.EntityFrameworkCore;
namespace LiftTogether.Api.Data;

public sealed class GymDb(DbContextOptions<GymDb> options) : DbContext(options)
{
    public DbSet<Member> Members => Set<Member>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<GymSettings> Settings => Set<GymSettings>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Announcement> Posts => Set<Announcement>();
    public DbSet<NewsComment> NewsComments => Set<NewsComment>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Discussion> Discussions => Set<Discussion>();
    public DbSet<ForumReply> Replies => Set<ForumReply>();
    public DbSet<Upload> Uploads => Set<Upload>();
    public DbSet<AuditEvent> Audit => Set<AuditEvent>();
    protected override void OnModelCreating(ModelBuilder m)
    {
        m.Entity<Member>().HasIndex(x => x.Email).IsUnique();
        m.Entity<Member>().Property(x => x.Email).HasMaxLength(254);
        foreach (var field in new[] { "FirstName", "LastName", "Dormitory", "Room", "Phone" }) m.Entity<Member>().Property<string>(field).HasMaxLength(100);
        m.Entity<Member>().Property(x => x.FacebookUrl).HasMaxLength(254);
        m.Entity<Member>().Property(x => x.Role).HasMaxLength(10);
        m.Entity<Member>().ToTable(t => t.HasCheckConstraint("CK_Member_Role", "\"Role\" IN ('user','admin')"));
        m.Entity<Session>().Property(x => x.Id).HasMaxLength(64);
        m.Entity<Session>().HasIndex(x => x.ExpiresAt);
        m.Entity<Booking>().HasIndex(x => new { x.UserId, x.Date }).IsUnique();
        m.Entity<Booking>().HasIndex(x => x.Date);
        m.Entity<Booking>().ToTable(t => t.HasCheckConstraint("CK_Booking_Time", "\"StartMinute\" >= 360 AND \"EndMinute\" <= 1440 AND \"EndMinute\" - \"StartMinute\" BETWEEN 30 AND 180 AND \"StartMinute\" % 30 = 0 AND \"EndMinute\" % 30 = 0"));
        m.Entity<GymSettings>().ToTable(t => { t.HasCheckConstraint("CK_Settings_Capacity", "\"MaxDaily\" BETWEEN 1 AND 100"); t.HasCheckConstraint("CK_Settings_Id", "\"Id\" = 1"); });
        m.Entity<Category>().Property(x => x.Name).HasMaxLength(80);
        m.Entity<Category>().HasIndex(x => x.Name).IsUnique();
        m.Entity<Discussion>().Property(x => x.Title).HasMaxLength(200);
        m.Entity<Discussion>().Property(x => x.Content).HasMaxLength(50000);
        m.Entity<Discussion>().HasIndex(x => new { x.Pinned, x.CreatedAt, x.Id });
        m.Entity<Discussion>().HasOne(x => x.Category).WithMany().OnDelete(DeleteBehavior.Restrict);
        m.Entity<ForumReply>().HasIndex(x => new { x.DiscussionId, x.CreatedAt });
        m.Entity<ForumReply>().Property(x => x.Content).HasMaxLength(50000);
        m.Entity<Announcement>().HasIndex(x => new { x.CreatedAt, x.Id });
        m.Entity<Announcement>().Property(x => x.TitlePl).HasMaxLength(200);
        m.Entity<Announcement>().Property(x => x.TitleEn).HasMaxLength(200);
        m.Entity<Announcement>().Property(x => x.ContentPl).HasMaxLength(10000);
        m.Entity<Announcement>().Property(x => x.ContentEn).HasMaxLength(10000);
        m.Entity<Announcement>().ToTable(t => t.HasCheckConstraint("CK_Post_Status", "\"Status\" IN ('published','draft')"));
        m.Entity<NewsComment>().HasIndex(x => new { x.PostId, x.CreatedAt });
        m.Entity<NewsComment>().Property(x => x.Content).HasMaxLength(2000);
        m.Entity<Upload>().Property(x => x.Name).HasMaxLength(100);
        m.Entity<Upload>().HasIndex(x => new { x.UserId, x.CreatedAt });
        m.Entity<Upload>().HasOne(x => x.Discussion).WithMany().HasForeignKey(x => x.DiscussionId).OnDelete(DeleteBehavior.Cascade);
        m.Entity<Upload>().HasOne(x => x.Reply).WithMany().HasForeignKey(x => x.ReplyId).OnDelete(DeleteBehavior.Cascade);
        m.Entity<Upload>().ToTable(t => t.HasCheckConstraint("CK_Upload_Target", "NOT (\"DiscussionId\" IS NOT NULL AND \"ReplyId\" IS NOT NULL)"));
        m.Entity<AuditEvent>().HasIndex(x => x.CreatedAt);
        foreach (var entity in m.Model.GetEntityTypes().Where(e => e.FindProperty("Version") != null)) m.Entity(entity.ClrType).Property<uint>("Version").IsRowVersion();
    }
    public void Record(Guid? actor, string action, object target) => Audit.Add(new AuditEvent { ActorId = actor, Action = action, Target = target.ToString() ?? "" });
}
