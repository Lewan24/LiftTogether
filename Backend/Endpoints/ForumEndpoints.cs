using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;
namespace LiftTogether.Api.Endpoints;

public static class ForumEndpoints
{
    public static void MapForum(this WebApplication app)
    {
        var g = app.MapGroup("/api/forum").RequireAuthorization("verified");
        g.MapGet("", async (int? page, string? search, Guid? categoryId, GymDb db, CancellationToken ct) =>
        {
            var p = GymEndpoints.Page(page);
            search = Rules.Text(search, 200, false);
            var discussions = await db.Discussions.AsNoTracking().Include(x => x.User).Where(x => (categoryId == null || x.CategoryId == categoryId) && (search == "" || x.Title.ToLower().Contains(search.ToLower()))).OrderByDescending(x => x.Pinned).ThenByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip(p * 50).Take(51).ToListAsync(ct);
            var ids = discussions.Select(x => x.Id).ToArray(); var counts = await db.Replies.Where(x => ids.Contains(x.DiscussionId)).GroupBy(x => x.DiscussionId).Select(x => new { Id = x.Key, Count = x.Count() }).ToDictionaryAsync(x => x.Id, x => x.Count, ct);
            var categories = await db.Categories.AsNoTracking().OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Version, DiscussionCount = db.Discussions.Count(d => d.CategoryId == x.Id) }).ToListAsync(ct);
            return new { categories, discussions = discussions.Take(50).Select(x => Dto.Discussion(x, [], [], counts.GetValueOrDefault(x.Id))), page = p, hasMore = discussions.Count > 50 };
        });
        g.MapGet("/{id:guid}", async (Guid id, int? page, GymDb db, CancellationToken ct) =>
        {
            var d = await Find(id, db, ct); var p = GymEndpoints.Page(page);
            var replies = await db.Replies.AsNoTracking().Include(x => x.User).Where(x => x.DiscussionId == id).OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip(p * 50).Take(50).ToListAsync(ct);
            var replyIds = replies.Select(x => x.Id).ToArray();
            var images = await db.Uploads.AsNoTracking().Where(x => x.DiscussionId == id || (x.ReplyId != null && replyIds.Contains(x.ReplyId.Value))).Select(x => new Upload { Id = x.Id, Name = x.Name, DiscussionId = x.DiscussionId, ReplyId = x.ReplyId }).ToListAsync(ct);
            var count = await db.Replies.CountAsync(x => x.DiscussionId == id, ct);
            var comments = replies.Select(x => new { x.Id, x.UserId, Author = Dto.Name(x.User), x.Content, x.CreatedAt, Images = images.Where(i => i.ReplyId == x.Id).Select(Dto.Image) });
            return new { discussion = Dto.Discussion(d, images.Where(x => x.DiscussionId == id), comments, count), page = p, hasMore = count > (p + 1) * 50 };
        });
        g.MapPost("", async (DiscussionInput input, HttpContext c, GymDb db, CancellationToken ct) => await Save(null, input, c, db, ct));
        g.MapPatch("/{id:guid}", async (Guid id, DiscussionInput input, HttpContext c, GymDb db, CancellationToken ct) => await Save(id, input, c, db, ct));
        g.MapPatch("/{id:guid}/pin", async (Guid id, PinInput input, HttpContext c, GymDb db, CancellationToken ct) => { var d = await Find(id, db, ct); Rules.Version(input.Version, d.Version); d.Pinned = input.Pinned; db.Record(c.User.UserId(), "forum.pin", id); await db.SaveChangesAsync(ct); return Results.NoContent(); }).RequireAuthorization("admin");
        g.MapDelete("/{id:guid}", async (Guid id, HttpContext c, GymDb db, CancellationToken ct) => { var d = await Find(id, db, ct); db.Discussions.Remove(d); db.Record(c.User.UserId(), "forum.delete", id); await db.SaveChangesAsync(ct); return Results.NoContent(); }).RequireAuthorization("admin");
        g.MapPost("/{id:guid}/comments", async (Guid id, ReplyInput input, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct); await Find(id, db, ct);
            var reply = new ForumReply { UserId = c.User.UserId(), DiscussionId = id, Content = Rules.Html(input.Content) }; var images = await Images(input.Images, c, db, null, null, ct); Content(reply.Content, images.Count); db.Replies.Add(reply); foreach (var i in images) i.ReplyId = reply.Id;
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.NoContent();
        });
        g.MapDelete("/{id:guid}/comments/{replyId:guid}", async (Guid id, Guid replyId, HttpContext c, GymDb db, CancellationToken ct) => { var reply = await db.Replies.SingleOrDefaultAsync(x => x.Id == replyId && x.DiscussionId == id, ct) ?? throw new ApiFault(404, "NOT_FOUND"); Rules.Require(c.User.Admin() || reply.UserId == c.User.UserId(), "FORBIDDEN", 403); db.Replies.Remove(reply); db.Record(c.User.UserId(), "forum.reply.delete", replyId); await db.SaveChangesAsync(ct); return Results.NoContent(); });
        var categories = app.MapGroup("/api/categories").RequireAuthorization("admin");
        categories.MapPost("", async (CategoryInput input, HttpContext c, GymDb db, CancellationToken ct) => await SaveCategory(null, input, c, db, ct));
        categories.MapPatch("/{id:guid}", async (Guid id, CategoryInput input, HttpContext c, GymDb db, CancellationToken ct) => await SaveCategory(id, input, c, db, ct));
        categories.MapDelete("/{id:guid}", async (Guid id, [Microsoft.AspNetCore.Mvc.FromBody] DeleteCategoryInput input, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct); await CategoryLock(db, ct);
            var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiFault(404, "NOT_FOUND"); Rules.Version(input.Version, category.Version); Rules.Require(id != input.Replacement && await db.Categories.AnyAsync(x => x.Id == input.Replacement, ct));
            await db.Discussions.Where(x => x.CategoryId == id).ExecuteUpdateAsync(x => x.SetProperty(d => d.CategoryId, input.Replacement), ct); db.Categories.Remove(category); db.Record(c.User.UserId(), "category.delete", id); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.NoContent();
        });
        app.MapPost("/api/images", UploadImage).RequireAuthorization("verified").RequireRateLimiting("upload");
        app.MapGet("/api/images/{id:guid}", async (Guid id, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            var image = await db.Uploads.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && (x.UserId == c.User.UserId() || x.DiscussionId != null || x.ReplyId != null), ct) ?? throw new ApiFault(404, "NOT_FOUND");
            c.Response.Headers.ContentDisposition = "inline; filename=\"image.jpg\""; return Results.File(image.Bytes, "image/jpeg");
        }).RequireAuthorization("verified");
        app.MapDelete("/api/images/{id:guid}", async (Guid id, HttpContext c, GymDb db, CancellationToken ct) => { var image = await db.Uploads.SingleOrDefaultAsync(x => x.Id == id && x.UserId == c.User.UserId() && x.DiscussionId == null && x.ReplyId == null, ct) ?? throw new ApiFault(404, "NOT_FOUND"); db.Uploads.Remove(image); await db.SaveChangesAsync(ct); return Results.NoContent(); }).RequireAuthorization("verified");
    }
    private static Task<Discussion> Find(Guid id, GymDb db, CancellationToken ct) => FindCore(id, db, ct);
    private static async Task<Discussion> FindCore(Guid id, GymDb db, CancellationToken ct) => await db.Discussions.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiFault(404, "NOT_FOUND");
    private static Task CategoryLock(GymDb db, CancellationToken ct) => db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(817002)", ct);
    private static void Content(string html, int images) => Rules.Require(!string.IsNullOrWhiteSpace(System.Net.WebUtility.HtmlDecode(System.Text.RegularExpressions.Regex.Replace(html, "<[^>]*>", "", System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromMilliseconds(100)))) || images > 0, "EMPTY_CONTENT");
    private static async Task<IResult> Save(Guid? id, DiscussionInput input, HttpContext c, GymDb db, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct); await CategoryLock(db, ct);
        var d = id.HasValue ? await Find(id.Value, db, ct) : new Discussion { UserId = c.User.UserId() };
        Rules.Require(c.User.Admin() || d.UserId == c.User.UserId(), "FORBIDDEN", 403); if (id.HasValue) Rules.Version(input.Version, d.Version);
        Rules.Require(await db.Categories.AnyAsync(x => x.Id == input.CategoryId, ct), "INVALID_CATEGORY");
        d.Title = Rules.Text(input.Title, 200); d.Content = Rules.Html(input.Content); d.CategoryId = input.CategoryId;
        var images = await Images(input.Images, c, db, id, null, ct); Content(d.Content, images.Count);
        if (!id.HasValue) db.Discussions.Add(d);
        var removed = await db.Uploads.Where(x => x.DiscussionId == d.Id).ToListAsync(ct); foreach (var old in removed.Where(x => images.All(i => i.Id != x.Id))) db.Uploads.Remove(old); foreach (var image in images) image.DiscussionId = d.Id;
        db.Record(c.User.UserId(), id.HasValue ? "forum.edit" : "forum.create", d.Id); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(new { d.Id });
    }
    private static async Task<List<Upload>> Images(List<ImageDto>? input, HttpContext c, GymDb db, Guid? discussionId, Guid? replyId, CancellationToken ct)
    {
        Rules.Require(input != null && input.Count <= 4 && input.Select(x => x.Id).Distinct().Count() == input.Count, "INVALID_IMAGES");
        var ids = input!.Select(x => x.Id).ToArray();
        var images = await db.Uploads.Where(x => ids.Contains(x.Id) && ((x.UserId == c.User.UserId() && x.DiscussionId == null && x.ReplyId == null) || (discussionId != null && x.DiscussionId == discussionId) || (replyId != null && x.ReplyId == replyId))).ToListAsync(ct);
        Rules.Require(images.Count == ids.Length, "INVALID_IMAGES", 403); return images;
    }
    private static async Task<IResult> SaveCategory(Guid? id, CategoryInput input, HttpContext c, GymDb db, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct); await CategoryLock(db, ct);
        var cat = id.HasValue ? await db.Categories.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiFault(404, "NOT_FOUND") : new Category();
        if (id.HasValue) Rules.Version(input.Version, cat.Version); var name = Rules.Text(input.Name, 80); Rules.Require(!await db.Categories.AnyAsync(x => x.Id != cat.Id && x.Name.ToLower() == name.ToLower(), ct), "DUPLICATE_CATEGORY", 409); cat.Name = name; if (!id.HasValue) db.Categories.Add(cat); db.Record(c.User.UserId(), "category.save", cat.Id); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(new { cat.Id, cat.Name, cat.Version });
    }
    private static async Task<IResult> UploadImage(HttpContext c, GymDb db, CancellationToken ct)
    {
        Rules.Require(c.Request.HasFormContentType, "INVALID_IMAGE"); var form = await c.Request.ReadFormAsync(ct); Rules.Require(form.Files.Count == 1, "INVALID_IMAGE"); var file = form.Files[0]; Rules.Require(file.Length is > 0 and <= 2097152, "IMAGE_TOO_LARGE");
        var cutoff = DateTimeOffset.UtcNow.AddDays(-1); Rules.Require(await db.Uploads.CountAsync(x => x.UserId == c.User.UserId() && x.CreatedAt > cutoff, ct) < 48, "UPLOAD_QUOTA", 429);
        var bytes = new MemoryStream(); await file.CopyToAsync(bytes, ct); bytes.Position = 0;
        await ImageSlots.WaitAsync(ct);
        try
        {
            using var codec = SKCodec.Create(bytes) ?? throw new ApiFault(400, "INVALID_IMAGE");
            Rules.Require(codec.EncodedFormat is SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp, "INVALID_IMAGE");
            Rules.Require(codec.Info.Width <= 6000 && codec.Info.Height <= 6000 && (long)codec.Info.Width * codec.Info.Height <= 16000000, "IMAGE_DIMENSIONS");
            using var bitmap = new SKBitmap(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
            Rules.Require(codec.GetPixels(bitmap.Info, bitmap.GetPixels()) == SKCodecResult.Success, "INVALID_IMAGE");
            var ratio = Math.Min(1d, 1600d / Math.Max(bitmap.Width, bitmap.Height));
            using var resized = bitmap.Resize(new SKImageInfo(Math.Max(1, (int)(bitmap.Width * ratio)), Math.Max(1, (int)(bitmap.Height * ratio))), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None)) ?? throw new ApiFault(400, "INVALID_IMAGE");
            using var image = SKImage.FromBitmap(resized); using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, 85);
            var upload = new Upload { UserId = c.User.UserId(), Name = "image.jpg", Bytes = encoded.ToArray() }; db.Uploads.Add(upload); await db.SaveChangesAsync(ct); return Results.Ok(Dto.Image(upload));
        }
        finally { ImageSlots.Release(); await bytes.DisposeAsync(); }
    }
    private static readonly SemaphoreSlim ImageSlots = new(2);
}
