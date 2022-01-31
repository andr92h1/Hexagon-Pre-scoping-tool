using Microsoft.EntityFrameworkCore.Migrations;

namespace mv.prescoping.db.Migrations
{
    public partial class AddedParentIdAndIsValidationRequiredToStages : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsValidationReqired",
                table: "Stages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "PlannedStageId",
                table: "Stages",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Stages_PlannedStageId",
                table: "Stages",
                column: "PlannedStageId");

            migrationBuilder.AddForeignKey(
                name: "FK_Stages_Stages_PlannedStageId",
                table: "Stages",
                column: "PlannedStageId",
                principalTable: "Stages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Stages_Stages_PlannedStageId",
                table: "Stages");

            migrationBuilder.DropIndex(
                name: "IX_Stages_PlannedStageId",
                table: "Stages");

            migrationBuilder.DropColumn(
                name: "IsValidationReqired",
                table: "Stages");

            migrationBuilder.DropColumn(
                name: "PlannedStageId",
                table: "Stages");
        }
    }
}
