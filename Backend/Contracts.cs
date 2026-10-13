using LiftTogether.Api.Data;
namespace LiftTogether.Api;

public record ProfileInput(
string FirstName,
string LastName,
string Email,
string Dormitory,
string Room,
string FacebookUrl,
string? Phone,
uint Version
);
public record RegisterInput(
string FirstName,
string LastName,
string Email,
string Dormitory,
string Room,
string FacebookUrl,
string Password
);
public record LoginInput(string Email, string Password);
public record PasswordInput(string CurrentPassword, string NewPassword);
public record VerifyInput(bool Verified, uint Version);
public record AdminMemberInput(
    string FirstName,
    string LastName,
    string Email,
    string Dormitory,
    string Room,
    string FacebookUrl,
    string? Phone,
    bool Verified,
    string? Password,
    uint Version = 0,
    string? AdminNotes = null
);
public record BookingInput(string Date, string Start, string End, uint Version = 0);
public record VersionInput(uint Version);
public record SettingsInput(
string GymName,
string DormitoryName,
int MaxDaily,
bool RegistrationEnabled,
string DefaultCalendarView,
uint Version,
int NextWeekReleaseDay = 0,
string NextWeekReleaseTime = "18:00"
);
public record PostInput(
string TitlePl,
string TitleEn,
string ContentPl,
string ContentEn,
string Status,
bool Important,
uint Version = 0
);
public record CommentInput(string Content);
public record ImageDto(Guid Id, string Name, string Src);
public record DiscussionInput(string Title, string Content, Guid CategoryId, List<ImageDto> Images, uint Version = 0);
public record ReplyInput(string Content, List<ImageDto> Images);
public record CategoryInput(string Name, uint Version = 0);
public record DeleteCategoryInput(Guid Replacement, uint Version);
public record PinInput(bool Pinned, uint Version);
public static class Dto
{
    public static object User(Member member) => new
    {
        member.Id,
        member.Role,
        member.FirstName,
        member.LastName,
        member.Email,
        member.Dormitory,
        member.Room,
        member.FacebookUrl,
        member.Phone,
        member.Verified,
        member.Version
    };
    public static object AdminUser(Member member) => new
    {
        member.Id, member.Role, member.FirstName, member.LastName, member.Email,
        member.Dormitory, member.Room, member.FacebookUrl, member.Phone,
        member.Verified, member.Version, member.AdminNotes
    };
    public static string Name(Member member) => $"{member.FirstName} {member.LastName}";
    public static string Initials(Member member) => $"{member.FirstName[0]}{member.LastName[0]}".ToUpperInvariant();
    public static object Settings(GymSettings settings) => new
    {
        settings.GymName,
        settings.DormitoryName,
        settings.MaxDaily,
        settings.RegistrationEnabled,
        settings.DefaultCalendarView,
        settings.NextWeekReleaseDay,
        settings.NextWeekReleaseTime,
        settings.Version
    };
    public static object Booking(Booking booking) => new
    {
        booking.Id,
        booking.UserId,
        Date = booking.Date.ToString("yyyy-MM-dd"),
        Name = Name(booking.User),
        Initials = Initials(booking.User),
        Start = Time(booking.StartMinute),
        End = Time(booking.EndMinute),
        Color = "green",
        booking.Cancelled,
        booking.Version
    };
    private static string Time(int minute) => $"{minute / 60:00}:{minute % 60:00}";
    public static ImageDto Image(Upload image) => new(image.Id, image.Name, $"/api/images/{image.Id}");
    public static object Post(Announcement post, IEnumerable<NewsComment> comments, int commentCount) => new
    {
        post.Id,
        post.TitlePl,
        post.TitleEn,
        post.ContentPl,
        post.ContentEn,
        post.CreatedAt,
        Author = Name(post.User),
        post.Important,
        post.Status,
        post.Version,
        CommentCount = commentCount,
        Comments = comments.Select(comment => new
        {
            comment.Id,
            comment.UserId,
            Author = Name(comment.User),
            Initials = Initials(comment.User),
            comment.Content,
            comment.CreatedAt
        })
    };
    public static object Discussion(Discussion discussion, IEnumerable<Upload> images, IEnumerable<object> comments, int commentCount) => new
    {
        discussion.Id,
        discussion.UserId,
        Author = Name(discussion.User),
        discussion.Title,
        discussion.Content,
        discussion.CategoryId,
        discussion.Pinned,
        discussion.CreatedAt,
        discussion.Version,
        Images = images.Select(Image),
        Comments = comments,
        CommentCount = commentCount
    };
}
