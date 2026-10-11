using LiftTogether.Api.Data;
using LiftTogether.Api.Security;
using Microsoft.EntityFrameworkCore;
namespace LiftTogether.Api.Endpoints;

public static class NewsEndpoints
{
    public static void MapNews(this WebApplication app)
    {
        var newsRoutes = app.MapGroup("/api/posts").RequireAuthorization("verified");
        newsRoutes.MapGet("", async (int? page, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var pageNumber = GymEndpoints.Page(page);
            var admin = context.User.Admin();
            var posts = await db.Posts.AsNoTracking().Include(x => x.User).Where(x => admin || x.Status == "published")
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .Skip(pageNumber * 50)
                .Take(51)
                .ToListAsync(cancellationToken);
            var ids = posts.Select(x => x.Id).ToArray();
            var counts = await db.NewsComments.Where(x => ids.Contains(x.PostId)).GroupBy(x => x.PostId)
                .Select(x => new
{
    Id = x.Key,
    Count = x.Count()
})
    .ToDictionaryAsync(x => x.Id, x => x.Count, cancellationToken);
            return new
            {
                posts = posts.Take(50).Select(x => Dto.Post(x, [], counts.GetValueOrDefault(x.Id))),
                page = pageNumber,
                hasMore = posts.Count > 50
            };
        });
        newsRoutes.MapGet("/{id:long}", async (long id, int? page, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var post = await Visible(id, context, db, cancellationToken);
            var pageNumber = GymEndpoints.Page(page);
            var count = await db.NewsComments.CountAsync(x => x.PostId == id, cancellationToken);
            var comments = await db.NewsComments.AsNoTracking().Include(x => x.User).Where(x => x.PostId == id)
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .Skip(pageNumber * 50)
                .Take(50)
                .ToListAsync(cancellationToken);
            return new
            {
                post = Dto.Post(post, comments, count),
                page = pageNumber,
                hasMore = count > (pageNumber + 1) * 50
            };
        });
        newsRoutes.MapPost("", async (PostInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var post = new Announcement
            {
                UserId = context.User.UserId(),
                User = (Member)context.Items["member"]!
            };
            db.Attach(post.User);
            Set(post, input);
            db.Posts.Add(post);
            db.Record(context.User.UserId(), "post.create", post.CreatedAt);
            await db.SaveChangesAsync(cancellationToken);
            return Dto.Post(post, [], 0);
        })
            .RequireAuthorization("admin");
        newsRoutes.MapPatch("/{id:long}", async (long id, PostInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var post = await Visible(id, context, db, cancellationToken);
            Rules.Version(input.Version, post.Version);
            Set(post, input);
            db.Record(context.User.UserId(), "post.edit", id);
            await db.SaveChangesAsync(cancellationToken);
            return Dto.Post(post, [], await db.NewsComments.CountAsync(x => x.PostId == id, cancellationToken));
        })
            .RequireAuthorization("admin");
        newsRoutes.MapDelete("/{id:long}", async (long id, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            var post = await Visible(id, context, db, cancellationToken);
            db.Posts.Remove(post);
            db.Record(context.User.UserId(), "post.delete", id);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        })
            .RequireAuthorization("admin");
        newsRoutes.MapPost("/{id:long}/comments", async (long id, CommentInput input, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            await Visible(id, context, db, cancellationToken);
            db.NewsComments.Add(new NewsComment
            {
                PostId = id,
                UserId = context.User.UserId(),
                Content = Rules.Text(input.Content, 2000)
            });
            db.Record(context.User.UserId(), "post.comment.create", id);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
        newsRoutes.MapDelete("/{id:long}/comments/{commentId:long}", async (long id, long commentId, HttpContext context, GymDb db, CancellationToken cancellationToken) =>
        {
            await Visible(id, context, db, cancellationToken);
            var reply = await db.NewsComments.SingleOrDefaultAsync(x => x.Id == commentId && x.PostId == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
            Rules.Require(context.User.Admin() || reply.UserId == context.User.UserId(), "FORBIDDEN", 403);
            db.NewsComments.Remove(reply);
            db.Record(context.User.UserId(), "post.comment.delete", commentId);
            await db.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });
    }
    private static async Task<Announcement> Visible(long id, HttpContext context, GymDb db, CancellationToken cancellationToken)
    {
        var post = await db.Posts.Include(x => x.User).SingleOrDefaultAsync(x => x.Id == id, cancellationToken) ?? throw new ApiFault(404, "NOT_FOUND");
        Rules.Require(context.User.Admin() || post.Status == "published", "NOT_FOUND", 404);
        return post;
    }
    private static void Set(Announcement post, PostInput input)
    {
        post.TitlePl = Rules.Text(input.TitlePl, 200);
        post.TitleEn = Rules.Text(input.TitleEn, 200);
        post.ContentPl = Rules.Text(input.ContentPl, 10000);
        post.ContentEn = Rules.Text(input.ContentEn, 10000);
        Rules.Require(input.Status is "published" or "draft");
        post.Status = input.Status;
        post.Important = input.Important;
    }
}
