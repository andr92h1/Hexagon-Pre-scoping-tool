using Microsoft.EntityFrameworkCore.Migrations;

namespace mv.prescoping.db.Migrations
{
    public partial class AddedRelationEntityAnnotations : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "EntityId",
                table: "Annotations",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Annotations_EntityId",
                table: "Annotations",
                column: "EntityId");

            migrationBuilder.AddForeignKey(
                name: "FK_Annotations_Entities_EntityId",
                table: "Annotations",
                column: "EntityId",
                principalTable: "Entities",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Annotations_Entities_EntityId",
                table: "Annotations");

            migrationBuilder.DropIndex(
                name: "IX_Annotations_EntityId",
                table: "Annotations");

            migrationBuilder.DropColumn(
                name: "EntityId",
                table: "Annotations");
        }
    }
}
