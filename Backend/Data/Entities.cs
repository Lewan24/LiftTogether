namespace LiftTogether.Api.Data;

public sealed class Member
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Role { get; set; } = "user";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Dormitory { get; set; } = "";
    public string Room { get; set; } = "";
    public string FacebookUrl { get; set; } = "";
    public string Phone { get; set; } = "";
    public bool Verified { get; set; }
    public uint Version { get; set; }
}
public sealed class Session
{
    public string Id { get; set; } = ""; // SHA-256 of a cryptographically random cookie token.
    public Guid UserId { get; set; }
    public Member User { get; set; } = null!;
    public DateTimeOffset ExpiresAt { get; set; }
}
public sealed class GymSettings
{
    public int Id { get; set; } = 1;
    public string GymName { get; set; } = "Siłownia DS 3";
    public string DormitoryName { get; set; } = "Dom Studencki nr 3";
    public int MaxDaily { get; set; } = 12;
    public bool RegistrationEnabled { get; set; } = true;
    public string DefaultCalendarView { get; set; } = "week";
    public uint Version { get; set; }
}
public sealed class Booking
{
    public long Id { get; set; }
    public Guid UserId { get; set; }
    public Member User { get; set; } = null!;
    public DateOnly Date { get; set; }
    public int StartMinute { get; set; }
    public int EndMinute { get; set; }
    public bool Cancelled { get; set; }
    public uint Version { get; set; }
}
public sealed class Announcement
{
    public long Id { get; set; }
    public string TitlePl { get; set; } = "";
    public string TitleEn { get; set; } = "";
    public string ContentPl { get; set; } = "";
    public string ContentEn { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid UserId { get; set; }
    public Member User { get; set; } = null!;
    public bool Important { get; set; }
    public string Status { get; set; } = "published";
    public uint Version { get; set; }
}
public sealed class NewsComment
{
    public long Id { get; set; }
    public long PostId { get; set; }
    public Announcement Post { get; set; } = null!;
    public Guid UserId { get; set; }
    public Member User { get; set; } = null!;
    public string Content { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public uint Version { get; set; }
}
public sealed class Discussion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Member User { get; set; } = null!;
    public Guid CategoryId { get; set; }
    public Category Category { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public bool Pinned { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public uint Version { get; set; }
}
public sealed class ForumReply
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DiscussionId { get; set; }
    public Discussion Discussion { get; set; } = null!;
    public Guid UserId { get; set; }
    public Member User { get; set; } = null!;
    public string Content { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Upload
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Member User { get; set; } = null!;
    public string Name { get; set; } = "image.jpg";
    public byte[] Bytes { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? DiscussionId { get; set; }
    public Discussion? Discussion { get; set; }
    public Guid? ReplyId { get; set; }
    public ForumReply? Reply { get; set; }
}
public sealed class AuditEvent
{
    public long Id { get; set; }
    public Guid? ActorId { get; set; }
    public string Action { get; set; } = "";
    public string Target { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
