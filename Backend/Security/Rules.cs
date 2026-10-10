using System.Globalization;
using System.Net.Mail;
using System.Security.Claims;
using Ganss.Xss;
using LiftTogether.Api.Data;
namespace LiftTogether.Api.Security;

public sealed class ApiFault(int status, string code) : Exception(code) { public int Status { get; } = status; public string Code { get; } = code; }
public static class Rules
{
    public static Guid UserId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static bool Admin(this ClaimsPrincipal user) => user.IsInRole("admin");
    public static void Require(bool valid, string code = "INVALID_INPUT", int status = 400) { if (!valid) throw new ApiFault(status, code); }
    public static void Version(uint supplied, uint current) => Require(supplied == current, "CONFLICT_REFRESH", 409);
    public static string Text(string? text, int max, bool required = true) { text = text?.Trim() ?? ""; Require(text.Length <= max && (!required || text.Length > 0)); return text; }
    public static string Email(string? value) { var email = Text(value, 254).ToLowerInvariant(); Require(MailAddress.TryCreate(email, out var parsed) && parsed.Address == email); return email; }
    public static string Facebook(string? value) { var url = Text(value, 254, false); if (url.Length == 0) return url; Require(Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.UserInfo == "" && (uri.Host == "facebook.com" || uri.Host == "www.facebook.com")); return url; }
    public static void Profile(Member user, string first, string last, string email, string dorm, string room, string facebook, string? phone) { user.FirstName = Text(first, 100); user.LastName = Text(last, 100); user.Email = Email(email); user.Dormitory = Text(dorm, 100); user.Room = Text(room, 100); user.FacebookUrl = Facebook(facebook); user.Phone = Text(phone, 100, false); }
    public static void Password(string? password) => Require(password != null && password.Length is >= 12 and <= 128, "PASSWORD_LENGTH");
    public static DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Europe/Warsaw").DateTime);
    public static bool CurrentWeek(DateOnly date) { var today = Today(); var monday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7)); return date >= monday && date <= monday.AddDays(6); }
    public static (DateOnly Date, int Start, int End) Booking(BookingInput input, bool admin)
    {
        Require(DateOnly.TryParseExact(input.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date));
        int ParseTime(string value) { if (value == "24:00") return 1440; Require(TimeOnly.TryParseExact(value, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time)); return time.Hour * 60 + time.Minute; }
        var start = ParseTime(input.Start); var end = ParseTime(input.End);
        Require(start >= 360 && end <= 1440 && end - start is >= 30 and <= 180 && start % 30 == 0 && end % 30 == 0, "INVALID_BOOKING_TIME");
        Require(admin || CurrentWeek(date), "CURRENT_WEEK_ONLY", 403); return (date, start, end);
    }
    public static string Html(string? html)
    {
        html = Text(html, 50000, false);
        var sanitizer = new HtmlSanitizer(); sanitizer.AllowedTags.Clear(); sanitizer.AllowedAttributes.Clear(); sanitizer.AllowedCssProperties.Clear();
        foreach (var tag in new[] { "p", "br", "h2", "h3", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "pre", "code" }) sanitizer.AllowedTags.Add(tag);
        return sanitizer.Sanitize(html);
    }
}
