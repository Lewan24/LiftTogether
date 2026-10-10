using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;
namespace LiftTogether.Api.Endpoints;

public static class NewsEndpoints
{
    public static void MapNews(this WebApplication app)
    {
        var g = app.MapGroup("/api/posts").RequireAuthorization("verified");
        g.MapGet("", async (int? page, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            var p = GymEndpoints.Page(page); var admin = c.User.Admin();
            var posts = await db.Posts.AsNoTracking().Include(x => x.User).Where(x => admin || x.Status == "published").OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip(p * 50).Take(51).ToListAsync(ct);
            var ids = posts.Select(x => x.Id).ToArray(); var counts = await db.NewsComments.Where(x => ids.Contains(x.PostId)).GroupBy(x => x.PostId).Select(x => new { Id = x.Key, Count = x.Count() }).ToDictionaryAsync(x => x.Id, x => x.Count, ct);
            return new { posts = posts.Take(50).Select(x => Dto.Post(x, [], counts.GetValueOrDefault(x.Id))), page = p, hasMore = posts.Count > 50 };
        });
        g.MapGet("/{id:long}", async (long id, int? page, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            var post = await Visible(id, c, db, ct); var p = GymEndpoints.Page(page);
            var count = await db.NewsComments.CountAsync(x => x.PostId == id, ct);
            var comments = await db.NewsComments.AsNoTracking().Include(x => x.User).Where(x => x.PostId == id).OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id).Skip(p * 50).Take(50).ToListAsync(ct);
            return new { post = Dto.Post(post, comments, count), page = p, hasMore = count > (p + 1) * 50 };
        });
        g.MapPost("", async (PostInput input, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            var post = new Announcement { UserId = c.User.UserId(), User = (Member)c.Items["member"]! }; db.Attach(post.User); Set(post, input); db.Posts.Add(post); db.Record(c.User.UserId(), "post.create", post.CreatedAt); await db.SaveChangesAsync(ct); return Dto.Post(post, [], 0);
        }).RequireAuthorization("admin");
        g.MapPatch("/{id:long}", async (long id, PostInput input, HttpContext c, GymDb db, CancellationToken ct) => { var post = await Visible(id, c, db, ct); Rules.Version(input.Version, post.Version); Set(post, input); db.Record(c.User.UserId(), "post.edit", id); await db.SaveChangesAsync(ct); return Dto.Post(post, [], await db.NewsComments.CountAsync(x => x.PostId == id, ct)); }).RequireAuthorization("admin");
        g.MapDelete("/{id:long}", async (long id, HttpContext c, GymDb db, CancellationToken ct) => { var post = await Visible(id, c, db, ct); db.Posts.Remove(post); db.Record(c.User.UserId(), "post.delete", id); await db.SaveChangesAsync(ct); return Results.NoContent(); }).RequireAuthorization("admin");
        g.MapPost("/{id:long}/comments", async (long id, CommentInput input, HttpContext c, GymDb db, CancellationToken ct) => { await Visible(id, c, db, ct); db.NewsComments.Add(new NewsComment { PostId = id, UserId = c.User.UserId(), Content = Rules.Text(input.Content, 2000) }); await db.SaveChangesAsync(ct); return Results.NoContent(); });
        g.MapDelete("/{id:long}/comments/{commentId:long}", async (long id, long commentId, HttpContext c, GymDb db, CancellationToken ct) =>
        {
            await Visible(id, c, db, ct); var reply = await db.NewsComments.SingleOrDefaultAsync(x => x.Id == commentId && x.PostId == id, ct) ?? throw new ApiFault(404, "NOT_FOUND"); Rules.Require(c.User.Admin() || reply.UserId == c.User.UserId(), "FORBIDDEN", 403); db.NewsComments.Remove(reply); db.Record(c.User.UserId(), "post.comment.delete", commentId); await db.SaveChangesAsync(ct); return Results.NoContent();
        });
    }
    private static async Task<Announcement> Visible(long id, HttpContext c, GymDb db, CancellationToken ct)
    {
        var post = await db.Posts.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new ApiFault(404, "NOT_FOUND"); Rules.Require(c.User.Admin() || post.Status == "published", "NOT_FOUND", 404); return post;
    }
    private static void Set(Announcement post, PostInput input) { post.TitlePl = Rules.Text(input.TitlePl, 200); post.TitleEn = Rules.Text(input.TitleEn, 200); post.ContentPl = Rules.Text(input.ContentPl, 10000); post.ContentEn = Rules.Text(input.ContentEn, 10000); Rules.Require(input.Status is "published" or "draft"); post.Status = input.Status; post.Important = input.Important; }
}
