using System;
using Microsoft.EntityFrameworkCore.Migrations;

namespace mv.prescoping.db.Migrations
{
    public partial class AddedValidFromAndValidToToStages : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ValidFrom",
                table: "Stages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ValidTo",
                table: "Stages",
                type: "timestamp with time zone",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ValidFrom",
                table: "Stages");

            migrationBuilder.DropColumn(
                name: "ValidTo",
                table: "Stages");
        }
    }
}
