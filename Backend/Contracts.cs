using LiftTogether.Api.Data;
namespace LiftTogether.Api;

public record ProfileInput(string FirstName, string LastName, string Email, string Dormitory, string Room, string FacebookUrl, string? Phone, uint Version);
public record RegisterInput(string FirstName, string LastName, string Email, string Dormitory, string Room, string FacebookUrl, string Password);
public record LoginInput(string Email, string Password);
public record PasswordInput(string CurrentPassword, string NewPassword);
public record VerifyInput(bool Verified, uint Version);
public record BookingInput(string Date, string Start, string End, uint Version = 0);
public record SettingsInput(string GymName, string DormitoryName, int MaxDaily, bool RegistrationEnabled, string DefaultCalendarView, uint Version);
public record PostInput(string TitlePl, string TitleEn, string ContentPl, string ContentEn, string Status, bool Important, uint Version = 0);
public record CommentInput(string Content);
public record ImageDto(Guid Id, string Name, string Src);
public record DiscussionInput(string Title, string Content, Guid CategoryId, List<ImageDto> Images, uint Version = 0);
public record ReplyInput(string Content, List<ImageDto> Images);
public record CategoryInput(string Name, uint Version = 0);
public record DeleteCategoryInput(Guid Replacement, uint Version);
public record PinInput(bool Pinned, uint Version);
public static class Dto
{
    public static object User(Member u) => new { u.Id, u.Role, u.FirstName, u.LastName, u.Email, u.Dormitory, u.Room, u.FacebookUrl, u.Phone, u.Verified, u.Version };
    public static string Name(Member u) => $"{u.FirstName} {u.LastName}";
    public static string Initials(Member u) => $"{u.FirstName[0]}{u.LastName[0]}".ToUpperInvariant();
    public static object Settings(GymSettings s) => new { s.GymName, s.DormitoryName, s.MaxDaily, s.RegistrationEnabled, s.DefaultCalendarView, s.Version };
    public static object Booking(Booking b) => new { b.Id, b.UserId, Date = b.Date.ToString("yyyy-MM-dd"), Name = Name(b.User), Initials = Initials(b.User), Start = Time(b.StartMinute), End = Time(b.EndMinute), Color = "green", b.Cancelled, b.Version };
    private static string Time(int minute) => $"{minute / 60:00}:{minute % 60:00}";
    public static ImageDto Image(Upload i) => new(i.Id, i.Name, $"/api/images/{i.Id}");
    public static object Post(Announcement p, IEnumerable<NewsComment> comments, int commentCount) => new { p.Id, p.TitlePl, p.TitleEn, p.ContentPl, p.ContentEn, p.CreatedAt, Author = Name(p.User), p.Important, p.Status, p.Version, CommentCount = commentCount, Comments = comments.Select(c => new { c.Id, c.UserId, Author = Name(c.User), Initials = Initials(c.User), c.Content, c.CreatedAt }) };
    public static object Discussion(Discussion d, IEnumerable<Upload> images, IEnumerable<object> comments, int commentCount) => new { d.Id, d.UserId, Author = Name(d.User), d.Title, d.Content, d.CategoryId, d.Pinned, d.CreatedAt, d.Version, Images = images.Select(Image), Comments = comments, CommentCount = commentCount };
}
