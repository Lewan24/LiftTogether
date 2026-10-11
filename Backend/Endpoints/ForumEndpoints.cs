using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;
namespace LiftTogether.Api.Endpoints;

public static class ForumEndpoints
{
    public static void MapForum(this WebApplication app)
    {
        var forumRoutes = app.MapGroup("/api/forum").RequireAuthorization("verified");
        forumRoutes.MapGet("", async (int? page, string? search, Guid? categoryId, GymDb db, CancellationToken cancellationToken) =>
        {
            var pageNumber = GymEndpoints.Page(page);
            search = Rules.Text(search, 200, false);
            var discussions = await db.Discussions.AsNoTracking().Include(x => x.User)
                .Where(x => (categoryId == null || x.CategoryId == categoryId) && (search == "" || x.Title.ToLower().Contains(search.ToLower())))
                .OrderByDescending(x => x.Pinned)
                .ThenByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .Skip(pageNumber * 50)
                .Take(51)
                .ToListAsync(cancellationToken);
            var ids = discussions.Select(x => x.Id).ToArray();
            var counts = await db.Replies.Where(x => ids.Contains(x.DiscussionId)).GroupBy(x => x.DiscussionId)
                .Select(x => new
{
    Id = x.Key,
    Count = x.Count()
})
    .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            var categories = await db.Categories.AsNoTracking().OrderBy(x => x.Name)
                .Select(x => new
{
    x.Id,
    x.Name,
    x.Version,
    DiscussionCount = db.Discussions.Count(discussion => discussion.CategoryId == x.Id)
})
    .ToListAsync(cancellationToken);
            return new
            {
                categories,
                discussions = discussions.Take(50).Select(x => Dto.Discussion(x, [], [], counts.GetValueOrDefault(x.Id))),
                page = pageNumber,
                hasMore = discussions.Count > 50
            };
        });
        forumRoutes.MapGet("/{id:guid}", async (Guid id, int? page, GymDb db, CancellationToken cancellationToken) =>
        {
            var discussion = await Find(id, db, cancellationToken);
            var pageNumber = GymEndpoints.Page(page);
            var replies = await db.Replies.AsNoTracking().Include(x => x.User).Where(x => x.DiscussionId == id)
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .Skip(pageNumber * 50)
                .Take(50)
                .ToListAsync(cancellationToken);
            var replyIds = replies.Select(x => x.Id).ToArray();
            var images = await db.Uploads.AsNoTracking()
                .Where(x => x.DiscussionId == id || (x.ReplyId != null && replyIds.Contains(x.ReplyId.Value)))
                .Select(x => new Upload
{
    Id = x.Id,
    Name = x.Name,
    DiscussionId = x.DiscussionId,
    ReplyId = x.ReplyId
})
    .ToListAsync(cancellationToken);
            var count = await db.Replies.CountAsync(x => x.DiscussionId == id, cancellationToken);
            var comments = replies.Select(x => new
            {
                x.Id,
                x.UserId,
                Author = Dto.Name(x.User),
                x.Content,
                x.CreatedAt,
                Images = images.Where(i => i.ReplyId == x.Id).Select(Dto.Image)
            });
            return new
            {
                discussion = Dto.Discussion(discussion, images.Where(x => x.DiscussionId == id), comments, count),
                page = pageNumber,
                hasMore = count > (pageNumber + 1) * 50
            };
        });
        forumRoutes.MapPost("", async (DiscussionInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) => await Save(null, input, context, db, cancellationToken));
        forumRoutes.MapPatch("/{id:guid}", async (Guid id, DiscussionInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) => await Save(id, input, context, db, cancellationToken));
        forumRoutes.MapPatch("/{id:guid}/pin", async (Guid id, PinInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var discussion = await Find(id, db, cancellationToken);
            Rules.Version(input.Version, discussion.Version);
            discussion.Pinned = input.Pinned;
            db.Record(context.User.UserId(), "forum.pin", id);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequireAuthorization("admin");
        forumRoutes.MapDelete("/{id:guid}", async (Guid id, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var discussion = await Find(id, db, cancellationToken);
            db.Discussions.Remove(discussion);
            db.Record(context.User.UserId(), "forum.delete", id);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequireAuthorization("admin");
        forumRoutes.MapPost("/{id:guid}/comments", async (Guid id, ReplyInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            await Find(id, db, cancellationToken);
            var reply = new ForumReply
            {
                UserId = context.User.UserId(),
                DiscussionId = id,
                Content = Rules.Html(input.Content)
            };
            var images = await Images(input.Images, context, db, null, null, cancellationToken);
            Content(reply.Content, images.Count);
            db.Replies.Add(reply);
            db.Record(context.User.UserId(), "forum.reply.create", id);
            foreach (var i in images) i.ReplyId = reply.Id;
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return Results.NoContent();
        });
        forumRoutes.MapDelete("/{id:guid}/comments/{replyId:guid}", async (Guid id, Guid replyId, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var reply = await db.Replies.SingleOrDefaultAsync(x => x.Id == replyId && x.DiscussionId == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            Rules.Require(context.User.Admin() || reply.UserId == context.User.UserId(), "FORBIDDEN", 403);
            db.Replies.Remove(reply);
            db.Record(context.User.UserId(), "forum.reply.delete", replyId);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
        var categories = app.MapGroup("/api/categories").RequireAuthorization("admin");
        categories.MapPost("", async (CategoryInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) => await SaveCategory(null, input, context, db, cancellationToken));
        categories.MapPatch("/{id:guid}", async (Guid id, CategoryInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) => await SaveCategory(id, input, context, db, cancellationToken));
        categories.MapDelete("/{id:guid}", async (
Guid id,
[Microsoft.AspNetCore.Mvc.FromBody] DeleteCategoryInput input,
HttpContext context,
GymDb db,
CancellationToken cancellationToken
) =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            await CategoryLock(db, cancellationToken);
            var category = await db.Categories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            Rules.Version(input.Version, category.Version);
            Rules.Require(id != input.Replacement && await db.Categories.AnyAsync(x => x.Id == input.Replacement, cancellationToken));
            await db.Discussions.Where(x => x.CategoryId == id)
                .ExecuteUpdateAsync(x => x.SetProperty(discussion => discussion.CategoryId, input.Replacement), cancellationToken);
            db.Categories.Remove(category);
            db.Record(context.User.UserId(), "category.delete", id);
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return Results.NoContent();
        });
        app.MapPost("/api/images", UploadImage).RequireAuthorization("verified")
            .RequireRateLimiting("upload");
        app.MapGet("/api/images/{id:guid}", async (Guid id, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var image = await db.Uploads.AsNoTracking()
                .SingleOrDefaultAsync(x => x.Id == id && (x.UserId == context.User.UserId() || x.DiscussionId != null || x.ReplyId != null), cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            context.Response.Headers.ContentDisposition = "inline; filename=\"image.jpg\"";
            return Results.File(image.Bytes, "image/jpeg");
        })
            .RequireAuthorization("verified");
        app.MapDelete("/api/images/{id:guid}", async (Guid id, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var image = await db.Uploads.SingleOrDefaultAsync(x => x.Id == id && x.UserId == context.User.UserId() && x.DiscussionId == null && x.ReplyId == null, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            db.Uploads.Remove(image);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequireAuthorization("verified");
    }
    private static Task<Discussion> Find(Guid id, GymDb db, CancellationToken cancellationToken) => FindCore(id, db, cancellationToken);
    private static async Task<Discussion> FindCore(Guid id, GymDb db, CancellationToken cancellationToken) => await db.Discussions.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
    private static Task CategoryLock(GymDb db, CancellationToken cancellationToken) => db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(817002)", cancellationToken);
    private static void Content(string html, int images) => Rules.Require(!string.IsNullOrWhiteSpace(System.Net.WebUtility.HtmlDecode(System.Text.RegularExpressions.Regex.Replace(html, "<[^>]*>", "", System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromMilliseconds(100)))) || images > 0, "EMPTY_CONTENT");
    private static async Task<IResult> Save(
Guid? id,
DiscussionInput input,
HttpContext context,
GymDb db,
CancellationToken cancellationToken
)
    {
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await CategoryLock(db, cancellationToken);
        var discussion = id.HasValue ? await Find(id.Value, db, cancellationToken) : new Discussion
        {
            UserId = context.User.UserId()
        };
        Rules.Require(context.User.Admin() || discussion.UserId == context.User.UserId(), "FORBIDDEN", 403);
        if (id.HasValue) Rules.Version(input.Version, discussion.Version);
        Rules.Require(await db.Categories.AnyAsync(x => x.Id == input.CategoryId, cancellationToken), "INVALID_CATEGORY");
        discussion.Title = Rules.Text(input.Title, 200);
        discussion.Content = Rules.Html(input.Content);
        discussion.CategoryId = input.CategoryId;
        var images = await Images(input.Images, context, db, id, null, cancellationToken);
        Content(discussion.Content, images.Count);
        if (!id.HasValue) db.Discussions.Add(discussion);
        var removed = await db.Uploads.Where(x => x.DiscussionId == discussion.Id).ToListAsync(cancellationToken);
        foreach (var old in removed.Where(x => images.All(i => i.Id != x.Id))) db.Uploads.Remove(old);
        foreach (var image in images) image.DiscussionId = discussion.Id;
        db.Record(context.User.UserId(), id.HasValue ? "forum.edit" : "forum.create", discussion.Id);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return Results.Ok(new
        {
            discussion.Id
        });
    }
    private static async Task<List<Upload>> Images(
List<ImageDto>? input,
HttpContext context,
GymDb db,
Guid? discussionId,
Guid? replyId,
CancellationToken cancellationToken
)
    {
        Rules.Require(input != null && input.Count <= 4 && input.Select(x => x.Id).Distinct().Count() == input.Count, "INVALID_IMAGES");
        var ids = input!.Select(x => x.Id).ToArray();
        var images = await db.Uploads.Where(x => ids.Contains(x.Id) && ((x.UserId == context.User.UserId() && x.DiscussionId == null && x.ReplyId == null) || (discussionId != null && x.DiscussionId == discussionId) || (replyId != null && x.ReplyId == replyId)))
            .ToListAsync(cancellationToken);
        Rules.Require(images.Count == ids.Length, "INVALID_IMAGES", 403);
        return images;
    }
    private static async Task<IResult> SaveCategory(Guid? id, CategoryInput input, HttpContext context, GymDb db, CancellationToken cancellationToken)
    {
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
        await CategoryLock(db, cancellationToken);
        var category = id.HasValue ? await db.Categories.SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND") : new Category();
        if (id.HasValue) Rules.Version(input.Version, category.Version);
        var name = Rules.Text(input.Name, 80);
        Rules.Require(!await db.Categories.AnyAsync(x => x.Id != category.Id && x.Name.ToLower() == name.ToLower(), cancellationToken), "DUPLICATE_CATEGORY", 409);
        category.Name = name;
        if (!id.HasValue) db.Categories.Add(category);
        db.Record(context.User.UserId(), "category.save", category.Id);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);
        return Results.Ok(new
        {
            category.Id,
            category.Name,
            category.Version
        });
    }
    private static async Task<IResult> UploadImage(HttpContext context, GymDb db, CancellationToken cancellationToken)
    {
        Rules.Require(context.Request.HasFormContentType, "INVALID_IMAGE");
        var form = await context.Request.ReadFormAsync(cancellationToken);
        Rules.Require(form.Files.Count == 1, "INVALID_IMAGE");
        var file = form.Files[0];
        Rules.Require(file.Length is > 0 and <= 2097152, "IMAGE_TOO_LARGE");
        var cutoff = DateTimeOffset.UtcNow.AddDays(-1);
        Rules.Require(await db.Uploads.CountAsync(x => x.UserId == context.User.UserId() && x.CreatedAt > cutoff, cancellationToken) < 48, "UPLOAD_QUOTA", 429);
        using var bytes = new MemoryStream();
        await file.CopyToAsync(bytes, cancellationToken);
        bytes.Position = 0;
        await ImageSlots.WaitAsync(cancellationToken);
        try
        {
            using var codec = SKCodec.Create(bytes) ?? throw new ApiFault(400, "INVALID_IMAGE");
            Rules.Require(codec.EncodedFormat is SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp, "INVALID_IMAGE");
            Rules.Require(codec.Info.Width <= 6000 && codec.Info.Height <= 6000 && (long)codec.Info.Width * codec.Info.Height <= 16000000, "IMAGE_DIMENSIONS");
            using var bitmap = new SKBitmap(codec.Info.Width, codec.Info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
            Rules.Require(codec.GetPixels(bitmap.Info, bitmap.GetPixels()) == SKCodecResult.Success, "INVALID_IMAGE");
            var ratio = Math.Min(1d, 1600d / Math.Max(bitmap.Width, bitmap.Height));
            using var resized = bitmap.Resize(new SKImageInfo(Math.Max(1, (int)(bitmap.Width * ratio)), Math.Max(1, (int)(bitmap.Height * ratio))), new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None)) ?? throw new ApiFault(400, "INVALID_IMAGE");
            using var image = SKImage.FromBitmap(resized);
            using var encoded = image.Encode(SKEncodedImageFormat.Jpeg, 85);
            // Serialize quota checks across API instances before persisting the decoded image.
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);
            var quotaLock = $"upload:{context.User.UserId()}";
            await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({quotaLock}, 0))", cancellationToken);
            Rules.Require(await db.Uploads.CountAsync(x => x.UserId == context.User.UserId() && x.CreatedAt > cutoff, cancellationToken) < 48, "UPLOAD_QUOTA", 429);
            var upload = new Upload
            {
                UserId = context.User.UserId(),
                Name = "image.jpg",
                Bytes = encoded.ToArray()
            };
            db.Uploads.Add(upload);
            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return Results.Ok(Dto.Image(upload));
        }
        finally
        {
            ImageSlots.Release();
        }
    }
    private static readonly SemaphoreSlim ImageSlots = new(2);
}
