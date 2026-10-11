using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiftTogether.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class BookingWeekRelease : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "NextWeekReleaseDay",
                table: "Settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "NextWeekReleaseTime",
                table: "Settings",
                type: "character varying(5)",
                maxLength: 5,
                nullable: false,
                defaultValue: "18:00");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Settings_ReleaseDay",
                table: "Settings",
                sql: "\"NextWeekReleaseDay\" BETWEEN 0 AND 6");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Settings_ReleaseTime",
                table: "Settings",
                sql: "\"NextWeekReleaseTime\" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Settings_ReleaseDay",
                table: "Settings");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Settings_ReleaseTime",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "NextWeekReleaseDay",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "NextWeekReleaseTime",
                table: "Settings");
        }
    }
}
