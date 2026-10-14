using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LiftTogether.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class TrainingCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                table: "Bookings",
                type: "timestamp with time zone",
                nullable: true);
            migrationBuilder.AddCheckConstraint(
                name: "CK_Booking_Completed",
                table: "Bookings",
                sql: "\"CompletedAt\" IS NULL OR NOT \"Cancelled\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(name: "CK_Booking_Completed", table: "Bookings");
            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Bookings");
        }
    }
}
