using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiftTogether.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class CascadeForumAttachments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Uploads_Discussions_DiscussionId",
                table: "Uploads");

            migrationBuilder.DropForeignKey(
                name: "FK_Uploads_Replies_ReplyId",
                table: "Uploads");

            migrationBuilder.AddForeignKey(
                name: "FK_Uploads_Discussions_DiscussionId",
                table: "Uploads",
                column: "DiscussionId",
                principalTable: "Discussions",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Uploads_Replies_ReplyId",
                table: "Uploads",
                column: "ReplyId",
                principalTable: "Replies",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Uploads_Discussions_DiscussionId",
                table: "Uploads");

            migrationBuilder.DropForeignKey(
                name: "FK_Uploads_Replies_ReplyId",
                table: "Uploads");

            migrationBuilder.AddForeignKey(
                name: "FK_Uploads_Discussions_DiscussionId",
                table: "Uploads",
                column: "DiscussionId",
                principalTable: "Discussions",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Uploads_Replies_ReplyId",
                table: "Uploads",
                column: "ReplyId",
                principalTable: "Replies",
                principalColumn: "Id");
        }
    }
}
