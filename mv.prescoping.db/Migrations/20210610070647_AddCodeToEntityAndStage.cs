using Microsoft.EntityFrameworkCore.Migrations;

namespace mv.prescoping.db.Migrations
{
    public partial class AddCodeToEntityAndStage : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Code",
                table: "Stages",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Code",
                table: "Entities",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Code",
                table: "Stages");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "Entities");
        }
    }
}
