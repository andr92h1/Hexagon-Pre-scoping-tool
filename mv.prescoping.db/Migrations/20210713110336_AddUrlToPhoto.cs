using Microsoft.EntityFrameworkCore.Migrations;

namespace mv.prescoping.db.Migrations
{
    public partial class AddUrlToPhoto : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Scale",
                table: "Photos");

            migrationBuilder.AddColumn<string>(
                name: "Url",
                table: "Photos",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Url",
                table: "Photos");

            migrationBuilder.AddColumn<float>(
                name: "Scale",
                table: "Photos",
                type: "real",
                nullable: true);
        }
    }
}
